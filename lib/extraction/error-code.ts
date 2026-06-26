/**
 * Quick 260626-wou: Shared Anthropic error classifier.
 *
 * Pure module — no DB, no env, no logging. SECURITY: this module must NEVER
 * log or include the API key value anywhere.
 *
 * Reused by BOTH the extraction catch block (lib/extraction/actions.ts) and the
 * settings test call (lib/settings/actions.ts) so a single mapping governs all
 * Anthropic failure reasons.
 */

export const EXTRACTION_ERROR_CODES = [
  "auth",
  "credit",
  "rate_limited",
  "model_unavailable",
  "too_large",
  "unknown",
] as const;

export type ExtractionErrorCode = (typeof EXTRACTION_ERROR_CODES)[number];

/**
 * Classify an Anthropic SDK error (or any thrown value) into a stable code.
 *
 * Defensive: reads `.status` and `.message` off the value rather than relying
 * on `instanceof` across the SDK bundle.
 */
export function classifyAnthropicError(e: unknown): ExtractionErrorCode {
  const status = (e as { status?: number } | null | undefined)?.status;
  const rawMessage =
    (e as { message?: string } | null | undefined)?.message ?? String(e);
  const message = rawMessage.toLowerCase();

  switch (status) {
    case 401:
      return "auth";
    case 400:
      // Out-of-credit surfaces as HTTP 400 with a "credit balance" message.
      // A bare 400 (e.g. malformed request) must NOT be mislabeled as credit.
      return message.includes("credit balance") ? "credit" : "unknown";
    case 429:
      return "rate_limited";
    case 404:
      return "model_unavailable";
    case 413:
      return "too_large";
    default:
      return "unknown";
  }
}

/**
 * Map a stored error code (or legacy/null value) to a specific German message.
 *
 * Legacy DB rows may already contain "rate_limited" or "unknown"; both are
 * handled by this same switch, so no migration is required. Any unrecognized
 * value falls through to the generic message.
 */
export function extractionErrorMessageDe(
  code: string | null | undefined,
): string {
  switch (code) {
    case "auth":
      return "API-Schlüssel ungültig";
    case "credit":
      return "Kein Anthropic-Guthaben — bitte unter console.anthropic.com aufladen";
    case "rate_limited":
      return "Rate-Limit erreicht — später erneut";
    case "model_unavailable":
      // Page may append the model id; keep the base message model-free.
      return "Modell nicht verfügbar";
    case "too_large":
      return "Dokument zu groß für die Analyse";
    default:
      return "Analyse fehlgeschlagen. Bitte erneut versuchen.";
  }
}
