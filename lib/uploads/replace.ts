"use server";

import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import path from "node:path";
import fs from "node:fs/promises";

import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { document, documentVersion } from "@/db/schema";
import { sha256Hex } from "@/lib/uploads/hash";
import { validatePdf } from "@/lib/uploads/pdf-validate";
import { UPLOADS_DIR } from "@/lib/uploads/storage";
import type { UploadErrorCode } from "@/lib/uploads/errors";

/**
 * Phase 5 Plan 03 — Document re-upload (UPLD-03).
 *
 * Replace the current scan for an existing document while preserving history:
 *   1. Session + ownership gate.
 *   2. PDF validation (magic bytes + pdf-lib encryption check).
 *   3. Archive the CURRENT version into `document_version` BEFORE updating.
 *   4. Write the new file bytes to `data/uploads/{documentId}-v{N}.pdf`.
 *   5. Update `document.storagePath`, sha256, size, and bump `version`.
 *
 * Immutability: the prior file on disk is NOT deleted — a row in
 * `document_version` points back at it for audit / version-history UI.
 *
 * All DB writes run inside ONE synchronous better-sqlite3 transaction so
 * either both (archive + bump) succeed or neither does.
 */

export type ReplaceResult =
  | { ok: true; newVersion: number; storagePath: string }
  | { ok: false; error: ReplaceErrorCode };

export type ReplaceErrorCode =
  | UploadErrorCode
  | "not_found"
  | "no_file"
  | "db_error";

export async function replaceDocumentPdfAction(
  documentId: string,
  formData: FormData,
): Promise<ReplaceResult> {
  // ---- 1. Session ----
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: "unauthenticated" };

  // ---- 2. Ownership + current-state fetch ----
  const [doc] = await db
    .select()
    .from(document)
    .where(
      and(eq(document.id, documentId), eq(document.userId, session.user.id)),
    )
    .limit(1);
  if (!doc) return { ok: false, error: "not_found" };

  // ---- 3. Pull file from FormData ----
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "no_file" };

  const bytes = new Uint8Array(await file.arrayBuffer());

  // ---- 4. PDF validation ----
  const v = await validatePdf(bytes);
  if (!v.ok) return { ok: false, error: v.reason };

  // ---- 5. Compute hash + new version number ----
  const sha = await sha256Hex(bytes);
  const currentVersion = doc.version ?? 1;
  const newVersion = currentVersion + 1;

  // ---- 6. Write new file on disk ----
  const filename = `${documentId}-v${newVersion}.pdf`;
  const absPath = path.join(UPLOADS_DIR, filename);
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  await fs.writeFile(absPath, bytes);

  const newStoragePath = path.relative(process.cwd(), absPath);

  // ---- 7. Transactional DB update ----
  // Archive the OLD version into document_version, then update document.
  // better-sqlite3 transactions are synchronous — no async inside.
  try {
    db.transaction((tx) => {
      tx.insert(documentVersion)
        .values({
          id: crypto.randomUUID(),
          documentId: doc.id,
          versionNumber: currentVersion,
          storagePath: doc.storagePath,
          sha256: doc.sha256,
          size: doc.size,
          uploadedAt: doc.uploadedAt,
        })
        .run();

      tx.update(document)
        .set({
          storagePath: newStoragePath,
          sha256: sha,
          size: bytes.byteLength,
          version: newVersion,
        })
        .where(
          and(
            eq(document.id, documentId),
            eq(document.userId, session.user.id),
          ),
        )
        .run();
    });
  } catch (err) {
    console.error("[replaceDocumentPdfAction] transaction failed:", err);
    // Best effort: don't leave orphan file behind when DB write fails.
    try {
      await fs.unlink(absPath);
    } catch {
      /* ignore */
    }
    return { ok: false, error: "db_error" };
  }

  return { ok: true, newVersion, storagePath: newStoragePath };
}
