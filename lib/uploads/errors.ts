export const UPLOAD_ERROR_CODES = [
  "unauthenticated",
  "file_too_large",
  "invalid_pdf",
  "encrypted_pdf",
  "batch_limit",
  "rate_limited",
  "unknown",
] as const;

export type UploadErrorCode = (typeof UPLOAD_ERROR_CODES)[number];
