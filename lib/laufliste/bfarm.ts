/**
 * BfArM supporting-document step (Bescheinigung nach Art. 34 RL 2005/36/EG).
 *
 * For the UAE recognition of German doctors/dentists, old Approbationsbeschlüsse
 * are often not accepted. The BfArM (Bundesinstitut für Arzneimittel und
 * Medizinprodukte, Dienstort Köln) issues a supporting document confirming the
 * training meets the EU minimum requirement. Static federal contact.
 *
 * Source: operator workflow PDF (Frau Andrea Jansen, Fachgebiet K5) + 2026-07
 * research Block 3. Contact person may change — verify before sending.
 */

import type { AuthorityBlock } from "./types";

export const BFARM_SUPPORTING_DOCUMENT: AuthorityBlock = {
  name: "Bundesinstitut für Arzneimittel und Medizinprodukte (BfArM) — Fachgebiet K5",
  address: ["Waisenhausgasse 36–38a", "50676 Köln"],
  phone: null,
  email: "andrea.jansen@bfarm.de",
  website: "https://www.bfarm.de",
  officeHours: null,
  notes:
    "Bescheinigung nach Art. 34 RL 2005/36/EG (Ansprechpartnerin: Frau Andrea Jansen). Benötigt: Original-Approbationsurkunde, Beschluss, Mark Sheets/Ausbildungszeugnisse. Nur für Ärzte/Zahnärzte relevant.",
};
