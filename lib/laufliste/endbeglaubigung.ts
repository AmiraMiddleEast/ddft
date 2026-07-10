/**
 * Endbeglaubigung static policy (CONTEXT D-06).
 *
 * - Most German documents route through the Bundesamt für Auswärtige
 *   Angelegenheiten (BfAA), Brandenburg an der Havel. Since 01.01.2023 the BfAA
 *   is the sole federal authority for Endbeglaubigungen/Apostillen — it took
 *   over from the Bundesverwaltungsamt (BVA) Köln, which is no longer
 *   responsible (Recherche 2026-07: bfaa.diplo.de + Auswärtiges Amt).
 * - Führungszeugnisse currently route through Bundesamt für Justiz (BfJ) Bonn
 *   as an Apostille short-chain (D-08). NOTE: the UAE is NOT an Apostille state,
 *   so this short-chain is under review — Führungszeugnisse for the UAE most
 *   likely need the full chain (BfJ → BfAA-Endbeglaubigung → Botschaft). Left
 *   unchanged here pending an operator decision; tracked as a Laufliste follow-up.
 */

import type { AuthorityBlock } from "./types";

/**
 * Bundesamt für Auswärtige Angelegenheiten (BfAA) — Endbeglaubigung for most
 * documents before the UAE-Embassy legalisation. Online portal:
 * bega.bfaa.diplo.de. Fee: 22 € per Endbeglaubigung (since 01.07.2025).
 * Sole federal authority since 01.01.2023 (replaced Bundesverwaltungsamt Köln).
 */
export const BUNDESAMT_FUER_AUSWAERTIGE_ANGELEGENHEITEN: AuthorityBlock = {
  name: "Bundesamt für Auswärtige Angelegenheiten (BfAA) — Endbeglaubigung",
  address: ["Kirchhofstraße 1–2", "14776 Brandenburg an der Havel"],
  phone: "+49 30 18 4730 16500",
  email: null,
  website: "https://bega.bfaa.diplo.de/",
  officeHours: "Servicezeiten Telefon Mo–Fr 09:00–15:00",
  notes:
    "Online-Antrag über bega.bfaa.diplo.de; Gebühr 22 € je Endbeglaubigung. Zuständig seit 01.01.2023 (zuvor Bundesverwaltungsamt Köln).",
};

/**
 * Bundesamt für Justiz Bonn — Apostille pathway for Führungszeugnisse.
 * Replaces the normal Endbeglaubigung step and short-circuits the chain
 * (no UAE-Embassy legalisation needed for Apostille documents).
 *
 * @assumed Contact fields are research defaults; cross-check before printing.
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
 * variant "Führungszeugnis nach §30 BZRG"). All other documents route through
 * the BfAA.
 */
export function endbeglaubigungFor(dokumentTyp: string): AuthorityBlock {
  if (/führungszeugnis/i.test(dokumentTyp)) {
    return BUNDESAMT_FUER_JUSTIZ_BONN;
  }
  return BUNDESAMT_FUER_AUSWAERTIGE_ANGELEGENHEITEN;
}
