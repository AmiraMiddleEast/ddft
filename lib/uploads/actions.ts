"use server";

import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { document } from "@/db/schema";
import { FileInput, MAX_FILE_BYTES } from "@/lib/validations/upload";
import { sha256Hex } from "@/lib/uploads/hash";
import { validatePdf } from "@/lib/uploads/pdf-validate";
import { writeUploadToDisk } from "@/lib/uploads/storage";
import type { UploadErrorCode } from "@/lib/uploads/errors";

export type UploadResult =
  | { ok: true; documentId: string; filename: string; dedup: boolean }
  | { ok: false; error: UploadErrorCode; filename?: string };

export async function uploadSingleDocumentAction(
  _prev: UploadResult | null,
  formData: FormData,
): Promise<UploadResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: "unauthenticated" };

  const file = formData.get("file");
  const parsed = FileInput.safeParse(file);
  if (!parsed.success) {
    const code = parsed.error.issues[0]?.message as UploadErrorCode | undefined;
    return {
      ok: false,
      error:
        code === "file_too_large" || code === "invalid_pdf"
          ? code
          : "invalid_pdf",
      filename: file instanceof File ? file.name : undefined,
    };
  }

  const f = parsed.data;
  // Defense-in-depth: browser-reported size is the one Zod already checked; enforce again after arrayBuffer.
  const bytes = new Uint8Array(await f.arrayBuffer());
  if (bytes.byteLength > MAX_FILE_BYTES) {
    return { ok: false, error: "file_too_large", filename: f.name };
  }

  // PDF structural + encryption check BEFORE any filesystem write.
  const v = await validatePdf(bytes);
  if (!v.ok) {
    return { ok: false, error: v.reason, filename: f.name };
  }

  // Hash FIRST, then dedup-check, THEN write (RESEARCH Pitfall 5).
  const sha = await sha256Hex(bytes);

  const id = crypto.randomUUID();
  const storagePath = `data/uploads/${id}.pdf`;

  // Atomic insert-with-dedup (RESEARCH Pitfall 8).
  const inserted = await db
    .insert(document)
    .values({
      id,
      userId: session.user.id,
      filename: f.name,
      size: bytes.byteLength,
      sha256: sha,
      mime: "application/pdf",
      storagePath,
      extractionStatus: "pending",
    })
    .onConflictDoNothing({ target: [document.userId, document.sha256] })
    .returning();

  if (inserted.length > 0) {
    // Insert won — write bytes to disk.
    await writeUploadToDisk(id, bytes);
    return { ok: true, documentId: id, filename: f.name, dedup: false };
  }

  // Dedup hit — fetch the existing row; DO NOT write to disk.
  const existing = await db
    .select()
    .from(document)
    .where(and(eq(document.userId, session.user.id), eq(document.sha256, sha)))
    .limit(1);

  if (existing.length === 0) {
    // Race we cannot reason about — treat as unknown.
    return { ok: false, error: "unknown", filename: f.name };
  }
  return {
    ok: true,
    documentId: existing[0].id,
    filename: f.name,
    dedup: true,
  };
}
