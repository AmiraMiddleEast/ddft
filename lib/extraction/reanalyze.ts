"use server";

import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { document, extraction } from "@/db/schema";
import { extractDocumentAction } from "./actions";

/**
 * Phase 5 Plan 03 — Re-analyze a document after a scan replacement.
 *
 * The base `extractDocumentAction` is idempotent: if status is 'done' or
 * 'extracting' it short-circuits. To force a fresh extraction on the latest
 * version we must:
 *   1. Verify auth + ownership (mirrors existing action).
 *   2. Delete the old `extraction` rows (stale values tied to prior scan).
 *   3. Reset `document.extraction_status` to 'pending' and clear errorCode.
 *   4. Invoke `extractDocumentAction`, which will now run end-to-end.
 *
 * Steps 2+3 happen inside one synchronous better-sqlite3 transaction so we
 * don't race a parallel reader that sees {status:pending, rows:stale}.
 */

export async function reanalyzeDocumentAction(
  documentId: string,
): Promise<
  | { ok: true; documentId: string }
  | { ok: false; documentId: string; error: string }
> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { ok: false, documentId, error: "unauthenticated" };
  }

  const [doc] = await db
    .select()
    .from(document)
    .where(
      and(eq(document.id, documentId), eq(document.userId, session.user.id)),
    )
    .limit(1);
  if (!doc) return { ok: false, documentId, error: "not_found" };

  // Wipe stale extraction rows + reset status so extractDocumentAction actually runs.
  try {
    db.transaction((tx) => {
      tx.delete(extraction)
        .where(eq(extraction.documentId, documentId))
        .run();
      tx.update(document)
        .set({ extractionStatus: "pending", errorCode: null })
        .where(
          and(
            eq(document.id, documentId),
            eq(document.userId, session.user.id),
          ),
        )
        .run();
    });
  } catch (err) {
    console.error("[reanalyzeDocumentAction] reset failed:", err);
    return { ok: false, documentId, error: "db_error" };
  }

  return await extractDocumentAction(documentId);
}
