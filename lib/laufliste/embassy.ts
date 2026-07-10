/**
 * Phase 4 Plan 03 — UAE Embassy static block (CONTEXT D-07).
 *
 * Single-entry constant. Used as Step 3 (Legalisation) for all non-exception
 * documents. Reisepass skips this step entirely (rendered as
 * "Keine Legalisation erforderlich."); Führungszeugnis skips it via the
 * Apostille exception.
 *
 * @assumed Contact fields are research defaults. Source of truth is the sample
 * Laufliste PDF at repo root (`Dokumenten Laufliste Dr. Sandra Hertel-2.pdf`).
 * The operator must verify before production use. See SUMMARY.
 */

import type { AuthorityBlock } from "./types";

/**
 * Botschaft der Vereinigten Arabischen Emirate, Berlin.
 *
 * @assumed Contact fields verified against research defaults only; cross-check
 * with the sample Laufliste PDF at repo root before printing for a customer.
 */
export const UAE_EMBASSY_BERLIN: AuthorityBlock = {
  name: "Botschaft der Vereinigten Arabischen Emirate",
  address: ["Hiroshimastraße 18–20", "10785 Berlin"],
  phone: "+49 30 516516-0",
  email: null,
  website: "https://www.uae-embassy.ae/Embassies/Germany",
  officeHours: "Mo–Do 09:00–13:00",
  notes:
    "Zuständig für alle Bundesländer außer Bayern und Baden-Württemberg. Legalisation nur nach Endbeglaubigung.",
};

/**
 * Generalkonsulat der Vereinigten Arabischen Emirate, München.
 * Zuständig für Bayern und Baden-Württemberg (Recherche 2026-07: AA-Länderseite).
 *
 * @assumed PLZ (81925) laut Drittquellen — vor Produktion prüfen.
 */
export const UAE_EMBASSY_MUENCHEN: AuthorityBlock = {
  name: "Generalkonsulat der Vereinigten Arabischen Emirate",
  address: ["Lohengrinstraße 21", "81925 München"],
  phone: "+49 89 412000-10",
  email: "munichcon@mofaic.gov.ae",
  website: "https://www.mofa.gov.ae",
  officeHours: null,
  notes:
    "Zuständig für Bayern und Baden-Württemberg. Legalisation nur nach Endbeglaubigung.",
};

/**
 * Pick the responsible UAE mission by the document's Bundesland:
 * München (Generalkonsulat) for Bayern & Baden-Württemberg, Berlin otherwise.
 */
export function embassyFor(bundesland: string): AuthorityBlock {
  return /^(bayern|baden[-\s]?w)/i.test((bundesland ?? "").trim())
    ? UAE_EMBASSY_MUENCHEN
    : UAE_EMBASSY_BERLIN;
}
