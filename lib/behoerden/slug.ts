/**
 * German-aware deterministic slug normalizer.
 *
 * Rules:
 *   - trim + lowercase
 *   - map umlauts: ä→ae, ö→oe, ü→ue, ß→ss (MUST happen before NFKD)
 *   - remove remaining combining marks (after NFKD)
 *   - strip soft hyphen U+00AD (common in German PDFs)
 *   - collapse runs of non-[a-z0-9] into a single "-"
 *   - strip leading/trailing dashes
 *
 * Pure: no imports from fastest-levenshtein, drizzle, or any runtime lib.
 */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\u00e4/g, "ae") // a-umlaut
    .replace(/\u00f6/g, "oe") // o-umlaut
    .replace(/\u00fc/g, "ue") // u-umlaut
    .replace(/\u00df/g, "ss") // eszett
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // combining marks
    .replace(/\u00ad/g, "") // soft hyphen
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
