import { distance } from "fastest-levenshtein";

import { slugify } from "./slug";

export type DocTypeOption = { id: string; displayName: string };

/**
 * Keyword → canonical doc-type id, most specific first.
 *
 * Claude extracts verbose German descriptions into the `dokumenten_typ` field
 * (e.g. "Urkunde (Anerkennung der Weiterbildung zur Fachzahnärztin)") that
 * never equal a dropdown option verbatim. These rules map such free text to the
 * canonical type id so the review dropdown pre-selects the right entry. Rules
 * are umlaut- and gender-form aware (Arzt/Ärztin, Zahnarzt/Zahnärztin).
 *
 * Order matters — the first matching rule wins, so put the more specific rule
 * (Fachzahnarzt) before the more general one (Facharzt).
 */
const KEYWORD_RULES: { re: RegExp; id: string }[] = [
  { re: /approbation|berufserlaubnis/i, id: "approbationsurkunde" },
  // Dental specialist recognition / Weiterbildung — MUST precede the Facharzt
  // rule (a dental urkunde also mentions "Weiterbildung").
  { re: /fachzahn|zahnärzt|zahnarzt|zahnmedizin/i, id: "fachzahnarztanerkennung" },
  // Medical specialist recognition / Weiterbildung.
  {
    re: /facharzt|fachärzt|(anerkennung|weiterbildung).*(ärzt|arzt)/i,
    id: "facharztanerkennung",
  },
  { re: /promotion/i, id: "promotionsurkunde" },
  { re: /staatsexamen/i, id: "staatsexamen" },
  { re: /universit|hochschul|diplom|bachelor|master/i, id: "universitaetsdiplom" },
  { re: /geburt/i, id: "geburtsurkunde" },
  { re: /heirat|eheschließ/i, id: "heiratsurkunde" },
  { re: /melde/i, id: "meldebescheinigung" },
  { re: /führungszeugnis|fuehrungszeugnis/i, id: "fuehrungszeugnis" },
  { re: /schulzeugnis|abiturzeugnis|reifezeugnis/i, id: "schulzeugnis" },
  { re: /notariell|notarurkunde/i, id: "notarielle-urkunden" },
];

/**
 * Map a raw extracted doc-type string to one of the app's document-type
 * options, or null if no confident match exists.
 *
 * Strategy (first hit wins):
 *   1. Exact display-name match (already normalized / re-opened document).
 *   2. Keyword rules — verbose Claude descriptions → canonical id.
 *   3. Fuzzy fallback for typos (slugified Levenshtein vs id + display name).
 *
 * Pure and client-safe: no DB, no network.
 */
export function matchDocType(
  raw: string,
  options: DocTypeOption[],
): DocTypeOption | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed || options.length === 0) return null;

  // 1. Exact display-name match (case-insensitive).
  const lower = trimmed.toLowerCase();
  const exact = options.find((o) => o.displayName.toLowerCase() === lower);
  if (exact) return exact;

  // 2. Keyword rules — only accept a hit whose id exists in the options list.
  const byId = new Map(options.map((o) => [o.id, o]));
  for (const rule of KEYWORD_RULES) {
    if (rule.re.test(trimmed)) {
      const hit = byId.get(rule.id);
      if (hit) return hit;
    }
  }

  // 3. Fuzzy fallback for typos on short-ish clean names.
  const slug = slugify(trimmed);
  if (slug.length >= 5) {
    let best: { o: DocTypeOption; d: number } | null = null;
    for (const o of options) {
      const d = Math.min(distance(slug, o.id), distance(slug, slugify(o.displayName)));
      if (!best || d < best.d) best = { o, d };
    }
    const threshold = Math.min(2, Math.floor(slug.length / 4));
    if (best && best.d <= threshold) return best.o;
  }

  return null;
}
