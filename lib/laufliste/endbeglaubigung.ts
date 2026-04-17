/**
 * Phase 4 Plan 03 — Endbeglaubigung static policy (CONTEXT D-06).
 *
 * - Most German documents route through Bundesverwaltungsamt (BVA) Köln.
 * - Führungszeugnisse route through Bundesamt für Justiz (BfJ) Bonn as an
 *   Apostille (CONTEXT D-08 exception).
 *
 * @assumed Phone / e-mail / Öffnungszeiten values below are placeholder
 * defaults from research. Source of truth is the sample PDF at repo root
 * (`Dokumenten Laufliste Dr. Sandra Hertel-2.pdf`). The operator must verify
 * these fields against the sample PDF before production use — a
 * `[PRÜFEN: verify before production]` annotation in UI/PDF would be ideal if
 * downstream plans re-introduce needsReview semantics here. See SUMMARY.
 */

import type { AuthorityBlock } from "./types";

/**
 * Bundesverwaltungsamt Köln — Endbeglaubigung for most civil-status documents
 * (Geburts-, Heirats-, Sterbeurkunden, Meldebescheinigungen, Diplome, etc.).
 *
 * @assumed Contact fields verified against research defaults only; cross-check
 * with the sample Laufliste PDF at repo root before printing for a customer.
 */
export const BUNDESVERWALTUNGSAMT_KOELN: AuthorityBlock = {
  name: "Bundesverwaltungsamt — Endbeglaubigung",
  address: ["Barbarastraße 1", "50735 Köln"],
  phone: "+49 22899 358-0",
  email: "poststelle@bva.bund.de",
  website: "https://www.bva.bund.de",
  officeHours: "Mo–Fr 08:00–16:00",
  notes: null,
};

/**
 * Bundesamt für Justiz Bonn — Apostille pathway for Führungszeugnisse.
 * Replaces the normal Endbeglaubigung step and short-circuits the chain
 * (no UAE-Embassy legalisation needed for Apostille documents).
 *
 * @assumed Contact fields verified against research defaults only; cross-check
 * with the sample Laufliste PDF at repo root before printing for a customer.
 */
export const BUNDESAMT_FUER_JUSTIZ_BONN: AuthorityBlock = {
  name: "Bundesamt für Justiz — Apostille",
  address: ["Adenauerallee 99–103", "53113 Bonn"],
  phone: "+49 228 99410-40",
  email: "poststelle@bfj.bund.de",
  website: "https://www.bundesjustizamt.de",
  officeHours: "Mo–Fr 09:00–15:00",
  notes: null,
};

/**
 * Static lookup: which Endbeglaubigung block applies for a given Dokumentart?
 * Case-insensitive substring match on "Führungszeugnis" (handles the common
 * variant "Führungszeugnis nach §30 BZRG").
 */
export function endbeglaubigungFor(dokumentTyp: string): AuthorityBlock {
  if (/führungszeugnis/i.test(dokumentTyp)) {
    return BUNDESAMT_FUER_JUSTIZ_BONN;
  }
  return BUNDESVERWALTUNGSAMT_KOELN;
}
