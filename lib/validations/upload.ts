import { z } from "zod";

// D-04: Max 10 MB per PDF; max 25 files per batch.
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_BATCH_FILES = 25;

export const FileInput = z
  .instanceof(File, { message: "invalid_pdf" })
  .refine((f) => f.size > 0, { message: "invalid_pdf" })
  .refine((f) => f.size <= MAX_FILE_BYTES, { message: "file_too_large" })
  // NOTE: f.type is browser-supplied and untrusted — any file can claim this MIME type.
  // The authoritative check is validatePdf() in the Server Action (magic-bytes + pdf-lib parse).
  .refine((f) => f.type === "application/pdf", { message: "invalid_pdf" });
