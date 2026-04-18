"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { caseTable, laufliste } from "@/db/schema";

import { buildLauflisteInput } from "./build-input";
import { renderLaufliste } from "./pdf/render";
import { writeLauflisteToDisk } from "./storage";
import { countUnapprovedDocsInCase } from "./queries";

/**
 * Phase 4 Plan 04 Task 2 — generateLauflisteAction Server Action.
 *
 * Pipeline:
 *   1. `auth.api.getSession`                    → UNAUTHORIZED
 *   2. `buildLauflisteInput` (ownership + join) → NOT_FOUND  (null)
 *                                                 EMPTY_CASE (0 docs)
 *   3. `countUnapprovedDocsInCase`              → UNREVIEWED_DOCS (D-17)
 *   4. `renderLaufliste`                        → RENDER_FAILED on throw
 *   5. `writeLauflisteToDisk`                   → filesystem write
 *   6. sync `db.transaction`: INSERT laufliste + UPDATE case.status
 *   7. `revalidatePath` for the case detail page + list.
 *
 * Ordering rationale (D-14 + Pitfall "no dangling file"):
 *   - Render BEFORE write: failure aborts without touching disk.
 *   - Write BEFORE transaction: if the DB write fails, the file is a
 *     harmless orphan. The inverse (insert then write) would leave a row
 *     pointing at a non-existent path.
 *
 * All mutations live inside a SYNCHRONOUS better-sqlite3 transaction
 * callback (matches Phase 3 Plan 04 + Phase 4 Plan 02 precedent — async
 * inside a sync tx throws "cannot return a promise from a sync
 * transaction").
 */

type GenerateOk = { ok: true; data: { lauflisteId: string } };
type GenerateErr = {
  ok: false;
  error:
    | "UNAUTHORIZED"
    | "NOT_FOUND"
    | "EMPTY_CASE"
    | "UNREVIEWED_DOCS"
    | "RENDER_FAILED"
    | "DB_ERROR";
  details?: unknown;
};

export type GenerateLauflisteResult = GenerateOk | GenerateErr;

export async function generateLauflisteAction(
  caseId: string,
): Promise<GenerateLauflisteResult> {
  // 1. Auth.
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: "UNAUTHORIZED" };

  // 2. Build render input (this also performs the ownership check + the
  // per-document re-resolve required by D-18).
  const input = await buildLauflisteInput(caseId, session.user.id, db);
  if (!input) return { ok: false, error: "NOT_FOUND" };
  if (input.documents.length === 0) {
    return { ok: false, error: "EMPTY_CASE" };
  }

  // Phase 6: manual review gate removed. CoGS routing + Vorbeglaubigung
  // auto-resolve handle routing. No per-document approval is required before
  // generating the Laufzettel.

  // 4. Render (may throw for font / pagination failures).
  let bytes: Buffer;
  try {
    bytes = await renderLaufliste(input);
  } catch (err) {
    console.error("[generateLauflisteAction] render failed:", err);
    return {
      ok: false,
      error: "RENDER_FAILED",
      details: err instanceof Error ? err.message : String(err),
    };
  }

  // 5. Write bytes to disk — storage module adds its own timestamp suffix.
  let storagePath: string;
  try {
    storagePath = await writeLauflisteToDisk(caseId, bytes);
  } catch (err) {
    console.error("[generateLauflisteAction] disk write failed:", err);
    return {
      ok: false,
      error: "DB_ERROR",
      details: err instanceof Error ? err.message : String(err),
    };
  }

  // 6. Persist laufliste row + flip case.status='pdf_generated' atomically.
  const id = crypto.randomUUID();
  try {
    db.transaction((tx) => {
      tx.insert(laufliste)
        .values({
          id,
          caseId,
          userId: session.user.id,
          pdfStoragePath: storagePath,
          documentCount: input.documents.length,
          fileSize: bytes.byteLength,
        })
        .run();
      tx.update(caseTable)
        .set({ status: "pdf_generated", updatedAt: new Date() })
        .where(eq(caseTable.id, caseId))
        .run();
    });
  } catch (err) {
    console.error("[generateLauflisteAction] transaction failed:", err);
    return {
      ok: false,
      error: "DB_ERROR",
      details: err instanceof Error ? err.message : String(err),
    };
  }

  // 7. Revalidate the case detail page + list so the new Laufliste shows
  // up without a hard refresh. Swallowed outside a render context (tests).
  try {
    revalidatePath(`/cases/${caseId}`);
    revalidatePath("/cases");
  } catch {
    // no Next render context — OK.
  }

  return { ok: true, data: { lauflisteId: id } };
}
