/**
 * Phase 4 Plan 03 — LauflisteInput contract.
 *
 * Pure-data shape produced by Plan 04's `buildLauflisteInput()` and consumed
 * by `<LauflisteDocument input={...} />` in `./pdf/Document.tsx`.
 *
 * No DB types here — this is the serialisable boundary between the DB/resolver
 * stage and the React-PDF render stage (RESEARCH Pattern 1 — pure render-input).
 */

export type AuthorityBlock = {
  name: string;
  /** Multi-line address: street line(s) + PLZ + city. */
  address: string[];
  phone: string | null;
  email: string | null;
  website: string | null;
  officeHours: string | null;
  notes: string | null;
};

/**
 * Step 1 of the chain. Three discriminated variants:
 *  - `authority`: normal Vorbeglaubigung with an authority block; `needsReview`
 *    drives the amber `[PRÜFEN]` pill per UI-SPEC.
 *  - `exception-apostille`: Führungszeugnis — short chain (Apostille via BfJ).
 *  - `exception-reisepass`: Reisepass — no legalization chain at all.
 */
export type VorbeglaubigungBlock =
  | {
      kind: "authority";
      authority: AuthorityBlock;
      needsReview: boolean;
      specialRules: string | null;
    }
  | { kind: "exception-apostille" }
  | { kind: "exception-reisepass" };

export type LauflisteDocumentEntry = {
  /** 1-based position within the case, ascending. */
  position: number;
  /** e.g. "Geburtsurkunde", "Führungszeugnis", "Reisepass". */
  dokumentart: string;
  ausstellendeBehoerde: string | null;
  ausstellungsort: string | null;
  /** Preformatted `dd.MM.yyyy`; caller is responsible for locale formatting. */
  ausstellungsdatum: string | null;
  vollerName: string | null;
  vorbeglaubigung: VorbeglaubigungBlock;
  /** `null` when the chain short-circuits (Reisepass). */
  endbeglaubigung: AuthorityBlock | null;
  /** `null` for Führungszeugnis (Apostille replaces this step) and Reisepass. */
  legalisation: AuthorityBlock | null;
};

export type LauflisteInput = {
  person: {
    name: string;
    /** ISO `yyyy-MM-dd` or preformatted `dd.MM.yyyy` — renderer prints as-is. */
    birthdate: string | null;
  };
  generatedAt: Date;
  documents: LauflisteDocumentEntry[];
};
