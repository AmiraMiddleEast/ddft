/**
 * Phase 4 Plan 03 — Person-name slug for Laufliste filenames (UI-SPEC file-name
 * contract: `Laufliste-{person-slug}-{yyyy-MM-dd}.pdf`).
 *
 * Hand-rolled per RESEARCH "Don't Hand-Roll" note — a 20-line util beats an
 * npm transliteration dep for a German-name ASCII-fallback scope this narrow.
 *
 * Rules:
 *   - German umlaut expansion: ß → ss, ä → ae, ö → oe, ü → ue (and uppercase).
 *   - Lowercase result.
 *   - Collapse any sequence of non-`[a-z0-9]` to a single `-`.
 *   - Trim leading / trailing `-`.
 *   - Empty input or punctuation-only input → `"unbekannt"` fallback.
 */
export function slugifyPersonName(name: string): string {
  if (typeof name !== "string") return "unbekannt";

  const expanded = name
    .replace(/ß/g, "ss")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae")
    .replace(/Ö/g, "Oe")
    .replace(/Ü/g, "Ue")
    .toLowerCase();

  const slug = expanded
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug.length > 0 ? slug : "unbekannt";
}
