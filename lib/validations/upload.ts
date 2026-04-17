import { z } from "zod";

// D-04: Max 10 MB per PDF; max 10 files per batch.
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_BATCH_FILES = 10;

export const FileInput = z
  .instanceof(File, { message: "invalid_pdf" })
  .refine((f) => f.size > 0, { message: "invalid_pdf" })
  .refine((f) => f.size <= MAX_FILE_BYTES, { message: "file_too_large" })
  .refine((f) => f.type === "application/pdf", { message: "invalid_pdf" });
