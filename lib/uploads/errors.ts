export const UPLOAD_ERROR_CODES = [
  "unauthenticated",
  "file_too_large",
  "invalid_pdf",
  "encrypted_pdf",
  "batch_limit",
  "rate_limited",
  // Quick 260626-wou: extraction-specific Anthropic failure codes so the
  // extraction action can persist a richer error (errorCode is free-text TEXT).
  "auth",
  "credit",
  "model_unavailable",
  "too_large",
  "unknown",
] as const;

export type UploadErrorCode = (typeof UPLOAD_ERROR_CODES)[number];
