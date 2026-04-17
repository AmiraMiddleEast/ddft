"use server";

import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import {
  behoerdenAuthority,
  document,
  documentReview,
} from "@/db/schema";
import {
  ApproveSchema,
  ChooseAuthoritySchema,
} from "@/lib/validations/review";
import { resolveAuthority } from "@/lib/behoerden/resolve";
import type { AuthorityRow, ResolverResult } from "@/lib/behoerden/resolve";

/**
 * Phase 3 Plan 04 — review Server Actions.
 *
 * Two entry points:
 *   - approveAndResolve: the primary "Speichern & Behörde ermitteln" action.
 *     Validates input, checks ownership, resolves the Vorbeglaubigung
 *     authority, and persists the review in a single sync SQLite transaction.
 *   - chooseAmbiguousAuthority: follow-up action when the resolver returned
 *     multiple candidates and the operator picks one via the UI.
 *
 * Both return a discriminated union { ok: true, data } | { ok: false, error }.
 * User errors NEVER throw (matches Phase 2 Server Action convention).
 *
 * Transactions use better-sqlite3's SYNCHRONOUS API — the callback is NOT
 * async, and all nested tx calls use .run() / .all(). This is the same
 * constraint the Phase 2 extraction action honors; see its comment header.
 */

type Ok<T> = { ok: true; data: T };
type Err = { ok: false; error: string };
type ActionResult<T> = Ok<T> | Err;

/**
 * approveAndResolve
 *
 * Pipeline:
 *   1. Session check         → unauthorized
 *   2. Zod validation        → invalid_input
 *   3. Ownership check       → not_found
 *   4. Call pure resolver    (no side effects)
 *   5. Transactional persist (upsert document_review + flip document state)
 *
 * Upsert semantics (Must-Have #6): one document_review row per document.
 * A re-approval UPDATEs the existing row instead of inserting a duplicate.
 */
export async function approveAndResolve(input: {
  documentId: string;
  corrected: {
    dokumenten_typ: string;
    ausstellende_behoerde: string;
    ausstellungsort: string;
    bundesland: string;
    ausstellungsdatum: string;
    voller_name: string;
  };
}): Promise<ActionResult<ResolverResult>> {
  // 1. Session gate (cannot be combined with ownership helper because we
  // need to Zod-validate BEFORE touching the DB, per Must-Have truth).
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: "unauthorized" };

  // 2. Zod gate — short-circuits before any DB read.
  const parsed = ApproveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  // 3. Ownership gate.
  const docRows = await db
    .select()
    .from(document)
    .where(
      and(
        eq(document.id, parsed.data.documentId),
        eq(document.userId, session.user.id),
      ),
    )
    .limit(1);
  if (!docRows[0]) return { ok: false, error: "not_found" };

  // 4. Resolve — pure, no persistence, no logging.
  const result = await resolveAuthority(parsed.data.corrected, db);

  const resolvedAuthorityId =
    result.status === "matched" ? result.authority.id : null;
  const lookupStatus = result.status; // 'matched' | 'ambiguous' | 'not_found'

  // 5. Transactional persist — SYNC callback (see file header).
  // Uses onConflictDoUpdate for a true atomic upsert keyed on the unique
  // constraint doc_review_doc_uniq (documentId). This eliminates the TOCTOU
  // race that the previous select-then-insert pattern had.
  // There is intentionally NO await before db.transaction().
  try {
    db.transaction((tx) => {
      tx.insert(documentReview)
        .values({
          id: crypto.randomUUID(),
          documentId: parsed.data.documentId,
          approvedByUserId: session.user.id,
          approvedAt: new Date(),
          correctedFields: parsed.data.corrected,
          resolvedAuthorityId,
          lookupStatus,
        })
        .onConflictDoUpdate({
          target: documentReview.documentId,
          set: {
            approvedByUserId: session.user.id,
            approvedAt: new Date(),
            correctedFields: parsed.data.corrected,
            resolvedAuthorityId,
            lookupStatus,
          },
        })
        .run();

      tx.update(document)
        .set({ reviewStatus: "approved", reviewedAt: new Date() })
        .where(
          and(
            eq(document.id, parsed.data.documentId),
            eq(document.userId, session.user.id),
          ),
        )
        .run();
    });
  } catch (err) {
    console.error("[approveAndResolve] transaction failed:", err);
    return { ok: false, error: "db_error" };
  }

  return { ok: true, data: result };
}

/**
 * chooseAmbiguousAuthority
 *
 * Follow-up to an approveAndResolve that returned status='ambiguous'. The
 * UI surfaces the candidate list; clicking "Diese Behörde übernehmen" calls
 * this action with the chosen authority id.
 *
 * Transitions the existing document_review row from ambiguous → matched and
 * sets resolved_authority_id. Does NOT create a new row.
 *
 * Rejects with invalid_choice if:
 *   - The review row for documentId does not exist
 *   - The review is not currently in 'ambiguous' state
 *   - The authorityId does not reference an existing authority row
 */
export async function chooseAmbiguousAuthority(input: {
  documentId: string;
  authorityId: string;
}): Promise<ActionResult<{ authority: AuthorityRow }>> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: "unauthorized" };

  const parsed = ChooseAuthoritySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  // Ownership gate.
  const docRows = await db
    .select()
    .from(document)
    .where(
      and(
        eq(document.id, parsed.data.documentId),
        eq(document.userId, session.user.id),
      ),
    )
    .limit(1);
  if (!docRows[0]) return { ok: false, error: "not_found" };

  const reviewRows = await db
    .select()
    .from(documentReview)
    .where(eq(documentReview.documentId, parsed.data.documentId))
    .limit(1);
  const review = reviewRows[0];
  if (!review || review.lookupStatus !== "ambiguous") {
    return { ok: false, error: "invalid_choice" };
  }

  const authRows = await db
    .select()
    .from(behoerdenAuthority)
    .where(eq(behoerdenAuthority.id, parsed.data.authorityId))
    .limit(1);
  const chosen = authRows[0];
  if (!chosen) return { ok: false, error: "invalid_choice" };

  // Sync transaction — no async inside.
  try {
    db.transaction((tx) => {
      tx.update(documentReview)
        .set({
          resolvedAuthorityId: chosen.id,
          lookupStatus: "matched",
          approvedAt: new Date(),
          approvedByUserId: session.user.id,
        })
        .where(eq(documentReview.id, review.id))
        .run();
    });
  } catch (err) {
    console.error("[chooseAmbiguousAuthority] transaction failed:", err);
    return { ok: false, error: "db_error" };
  }

  return { ok: true, data: { authority: chosen } };
}
