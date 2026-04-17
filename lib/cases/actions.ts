"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, asc, eq, inArray } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { caseTable, caseDocument, document, documentReview } from "@/db/schema";
import {
  CreateCaseSchema,
  AddDocumentsToCaseSchema,
  RemoveDocumentFromCaseSchema,
  ReorderCaseDocumentsSchema,
} from "@/lib/validations/case";

/**
 * Phase 4 Plan 02 — Cases Server Actions.
 *
 * Pattern (mirrors lib/review/actions.ts):
 *   1. `auth.api.getSession` → UNAUTHORIZED short-circuit
 *   2. Zod safeParse → VALIDATION short-circuit BEFORE any DB read
 *   3. Ownership predicate on the case row (userId = session.user.id)
 *   4. Multi-row mutations inside db.transaction (sync callback — better-sqlite3)
 *   5. Catch SQLITE_CONSTRAINT_UNIQUE on add → DOC_ALREADY_ASSIGNED (D-02)
 *   6. Never throw for user errors; discriminated-union returns
 *   7. revalidatePath('/cases') + '/cases/[id]' after mutations
 *
 * Transactions use better-sqlite3's SYNCHRONOUS API — the callback is NOT
 * async, and nested tx calls use `.run()` / `.all()` / `.get()`. Async inside
 * the tx callback throws "cannot return a promise from a sync transaction"
 * (see Phase 2 Plan 04 STATE.md note).
 */

type Ok<T> = { ok: true; data: T };
type Err<E extends string = string> = {
  ok: false;
  error: E;
  details?: unknown;
};
type ActionResult<T, E extends string = string> = Ok<T> | Err<E>;

/** Narrow guard — better-sqlite3 attaches code="SQLITE_CONSTRAINT_UNIQUE". */
function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: string }).code;
  return (
    code === "SQLITE_CONSTRAINT_UNIQUE" ||
    code === "SQLITE_CONSTRAINT_PRIMARYKEY" ||
    code === "SQLITE_CONSTRAINT"
  );
}

function revalidateCases(caseId?: string) {
  try {
    revalidatePath("/cases");
    if (caseId) revalidatePath(`/cases/${caseId}`);
  } catch {
    // revalidatePath has no render context in tests — swallow.
  }
}

// ========================================================================
// createCaseAction
// ========================================================================

/**
 * Create a new case owned by the session user. Status defaults to 'open'.
 */
export async function createCaseAction(input: {
  personName: string;
  personBirthdate?: string;
  notes?: string;
}): Promise<
  ActionResult<{ caseId: string }, "UNAUTHORIZED" | "VALIDATION" | "DB_ERROR">
> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = CreateCaseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "VALIDATION", details: parsed.error.flatten() };
  }

  const id = crypto.randomUUID();
  try {
    await db.insert(caseTable).values({
      id,
      userId: session.user.id,
      personName: parsed.data.personName,
      personBirthdate: parsed.data.personBirthdate || null,
      notes: parsed.data.notes || null,
      status: "open",
    });
  } catch (err) {
    console.error("[createCaseAction] insert failed:", err);
    return { ok: false, error: "DB_ERROR" };
  }

  revalidateCases();
  return { ok: true, data: { caseId: id } };
}

// ========================================================================
// addDocumentsToCaseAction
// ========================================================================

/**
 * Appends `documentIds` to `caseId` at positions maxExistingPosition+1..+N
 * in a single synchronous transaction. All inserts roll back together if any
 * fail (ownership mismatch, missing review, UNIQUE violation).
 *
 * Errors:
 *   UNAUTHORIZED          — no session
 *   VALIDATION            — Zod
 *   NOT_FOUND             — caseId not owned by caller
 *   FORBIDDEN             — one of documentIds is unowned or unapproved
 *   DOC_ALREADY_ASSIGNED  — unique(case_document.document_id) violation
 *                            (details.documentId identifies the offender)
 *   DB_ERROR              — everything else
 */
export async function addDocumentsToCaseAction(input: {
  caseId: string;
  documentIds: string[];
}): Promise<
  ActionResult<
    { inserted: number },
    | "UNAUTHORIZED"
    | "VALIDATION"
    | "NOT_FOUND"
    | "FORBIDDEN"
    | "DOC_ALREADY_ASSIGNED"
    | "DB_ERROR"
  >
> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = AddDocumentsToCaseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "VALIDATION", details: parsed.error.flatten() };
  }

  // Case ownership gate.
  const [caseRow] = await db
    .select({ id: caseTable.id })
    .from(caseTable)
    .where(
      and(
        eq(caseTable.id, parsed.data.caseId),
        eq(caseTable.userId, session.user.id),
      ),
    )
    .limit(1);
  if (!caseRow) return { ok: false, error: "NOT_FOUND" };

  // Document ownership + approval gate — MUST cover ALL requested ids.
  const docRows = await db
    .select({
      id: document.id,
      userId: document.userId,
      reviewStatus: document.reviewStatus,
    })
    .from(document)
    .where(inArray(document.id, parsed.data.documentIds));

  if (docRows.length !== parsed.data.documentIds.length) {
    return { ok: false, error: "FORBIDDEN" };
  }
  for (const d of docRows) {
    if (d.userId !== session.user.id || d.reviewStatus !== "approved") {
      return { ok: false, error: "FORBIDDEN" };
    }
    // Belt: must have a documentReview row too (data integrity with Phase 3).
  }
  const approvedIds = new Set(
    (
      await db
        .select({ documentId: documentReview.documentId })
        .from(documentReview)
        .where(inArray(documentReview.documentId, parsed.data.documentIds))
    ).map((r) => r.documentId),
  );
  for (const id of parsed.data.documentIds) {
    if (!approvedIds.has(id)) {
      return { ok: false, error: "FORBIDDEN" };
    }
  }

  // Transactional insert — maxPosition must be read inside the transaction
  // to avoid races with another add-docs call from the same session.
  let inserted = 0;
  try {
    db.transaction((tx) => {
      const maxRow = tx
        .select({ position: caseDocument.position })
        .from(caseDocument)
        .where(eq(caseDocument.caseId, parsed.data.caseId))
        .orderBy(asc(caseDocument.position))
        .all();
      const currentMax = maxRow.length
        ? Math.max(...maxRow.map((r) => r.position))
        : 0;

      let pos = currentMax;
      for (const docId of parsed.data.documentIds) {
        pos += 1;
        tx.insert(caseDocument)
          .values({
            id: crypto.randomUUID(),
            caseId: parsed.data.caseId,
            documentId: docId,
            position: pos,
          })
          .run();
        inserted += 1;
      }

      // Touch case.updated_at so list sort reflects the change.
      tx.update(caseTable)
        .set({ updatedAt: new Date() })
        .where(eq(caseTable.id, parsed.data.caseId))
        .run();
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      // Identify the offending documentId so the UI can offer a "move" flow.
      const already = await db
        .select({ documentId: caseDocument.documentId })
        .from(caseDocument)
        .where(inArray(caseDocument.documentId, parsed.data.documentIds));
      const offender = already[0]?.documentId ?? parsed.data.documentIds[0];
      return {
        ok: false,
        error: "DOC_ALREADY_ASSIGNED",
        details: { documentId: offender },
      };
    }
    console.error("[addDocumentsToCaseAction] transaction failed:", err);
    return { ok: false, error: "DB_ERROR" };
  }

  revalidateCases(parsed.data.caseId);
  return { ok: true, data: { inserted } };
}

// ========================================================================
// removeDocumentFromCaseAction
// ========================================================================

/**
 * Deletes a case_document row and renumbers remaining rows contiguously
 * (1..N by prior position order). All changes happen inside one transaction.
 */
export async function removeDocumentFromCaseAction(input: {
  caseId: string;
  caseDocumentId: string;
}): Promise<
  ActionResult<
    { removed: true },
    "UNAUTHORIZED" | "VALIDATION" | "NOT_FOUND" | "DB_ERROR"
  >
> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = RemoveDocumentFromCaseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "VALIDATION", details: parsed.error.flatten() };
  }

  const [caseRow] = await db
    .select({ id: caseTable.id })
    .from(caseTable)
    .where(
      and(
        eq(caseTable.id, parsed.data.caseId),
        eq(caseTable.userId, session.user.id),
      ),
    )
    .limit(1);
  if (!caseRow) return { ok: false, error: "NOT_FOUND" };

  try {
    db.transaction((tx) => {
      // Verify the row belongs to this case before deleting.
      const [target] = tx
        .select({ id: caseDocument.id })
        .from(caseDocument)
        .where(
          and(
            eq(caseDocument.id, parsed.data.caseDocumentId),
            eq(caseDocument.caseId, parsed.data.caseId),
          ),
        )
        .limit(1)
        .all();
      if (!target) {
        throw new Error("NOT_FOUND_ROW");
      }

      tx.delete(caseDocument)
        .where(eq(caseDocument.id, parsed.data.caseDocumentId))
        .run();

      // Renumber remaining rows contiguously 1..N.
      // SQLite: use a temporary parking space to avoid a transient position
      // collision in case a (case_id, position) unique index exists.
      const remaining = tx
        .select({ id: caseDocument.id, position: caseDocument.position })
        .from(caseDocument)
        .where(eq(caseDocument.caseId, parsed.data.caseId))
        .orderBy(asc(caseDocument.position))
        .all();

      // Park every remaining row at a negative sentinel first.
      let sentinel = -1;
      for (const r of remaining) {
        tx.update(caseDocument)
          .set({ position: sentinel })
          .where(eq(caseDocument.id, r.id))
          .run();
        sentinel -= 1;
      }
      // Then place them back contiguously.
      let nextPos = 1;
      for (const r of remaining) {
        tx.update(caseDocument)
          .set({ position: nextPos })
          .where(eq(caseDocument.id, r.id))
          .run();
        nextPos += 1;
      }

      tx.update(caseTable)
        .set({ updatedAt: new Date() })
        .where(eq(caseTable.id, parsed.data.caseId))
        .run();
    });
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND_ROW") {
      return { ok: false, error: "NOT_FOUND" };
    }
    console.error("[removeDocumentFromCaseAction] transaction failed:", err);
    return { ok: false, error: "DB_ERROR" };
  }

  revalidateCases(parsed.data.caseId);
  return { ok: true, data: { removed: true } };
}

// ========================================================================
// reorderCaseDocumentsAction
// ========================================================================

/**
 * Moves the target case_document row up or down by one slot via a three-step
 * dance inside a transaction (Pitfall 4): park the target at -1, move neighbor
 * into its position, move target into neighbor's old position. Works even if
 * a unique (case_id, position) constraint is later added.
 *
 * Returns { noop: true } when the target is already at an edge (first row 'up'
 * or last row 'down').
 */
export async function reorderCaseDocumentsAction(input: {
  caseId: string;
  caseDocumentId: string;
  direction: "up" | "down";
}): Promise<
  ActionResult<
    { noop: boolean },
    "UNAUTHORIZED" | "VALIDATION" | "NOT_FOUND" | "DB_ERROR"
  >
> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = ReorderCaseDocumentsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "VALIDATION", details: parsed.error.flatten() };
  }

  const [caseRow] = await db
    .select({ id: caseTable.id })
    .from(caseTable)
    .where(
      and(
        eq(caseTable.id, parsed.data.caseId),
        eq(caseTable.userId, session.user.id),
      ),
    )
    .limit(1);
  if (!caseRow) return { ok: false, error: "NOT_FOUND" };

  let noop = false;
  try {
    db.transaction((tx) => {
      const rows = tx
        .select({ id: caseDocument.id, position: caseDocument.position })
        .from(caseDocument)
        .where(eq(caseDocument.caseId, parsed.data.caseId))
        .orderBy(asc(caseDocument.position))
        .all();

      const idx = rows.findIndex((r) => r.id === parsed.data.caseDocumentId);
      if (idx === -1) {
        throw new Error("NOT_FOUND_ROW");
      }

      const target = rows[idx];
      const neighborIdx =
        parsed.data.direction === "up" ? idx - 1 : idx + 1;
      if (neighborIdx < 0 || neighborIdx >= rows.length) {
        noop = true;
        return;
      }
      const neighbor = rows[neighborIdx];

      // Three-step swap.
      tx.update(caseDocument)
        .set({ position: -1 })
        .where(eq(caseDocument.id, target.id))
        .run();
      tx.update(caseDocument)
        .set({ position: target.position })
        .where(eq(caseDocument.id, neighbor.id))
        .run();
      tx.update(caseDocument)
        .set({ position: neighbor.position })
        .where(eq(caseDocument.id, target.id))
        .run();

      tx.update(caseTable)
        .set({ updatedAt: new Date() })
        .where(eq(caseTable.id, parsed.data.caseId))
        .run();
    });
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND_ROW") {
      return { ok: false, error: "NOT_FOUND" };
    }
    console.error("[reorderCaseDocumentsAction] transaction failed:", err);
    return { ok: false, error: "DB_ERROR" };
  }

  revalidateCases(parsed.data.caseId);
  return { ok: true, data: { noop } };
}
