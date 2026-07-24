import type { UploadErrorCode } from "@/lib/uploads/errors";

export const ERROR_COPY: Record<UploadErrorCode | "not_found", string> = {
  unauthenticated: "Analysis failed. Please try again.",
  file_too_large: "File is larger than 10 MB.",
  invalid_pdf: "File is not a valid PDF.",
  encrypted_pdf: "The PDF is password-protected and cannot be analyzed.",
  batch_limit: "Maximal 25 Dateien gleichzeitig.",
  rate_limited: "Too many requests. Please try again in a minute.",
  auth: "Invalid API key. Check it under Settings.",
  credit:
    "No Anthropic credit left. Top up under Settings / console.anthropic.com.",
  model_unavailable: "Model unavailable. Check it under Settings.",
  too_large: "Document too large to analyze.",
  unknown: "Analysis failed. Please try again.",
  not_found: "The document could not be analyzed.",
};
