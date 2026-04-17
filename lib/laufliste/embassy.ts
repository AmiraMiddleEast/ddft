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
  notes: "Legalisation nur nach Endbeglaubigung.",
};
