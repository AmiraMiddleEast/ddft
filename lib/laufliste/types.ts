/**
 * Phase 4 + Phase 6 — LauflisteInput contract.
 *
 * Pure-data shape produced by `buildLauflisteInput()` and consumed by
 * `<LauflisteDocument input={...} />` in `./pdf/Document.tsx`.
 *
 * No DB types here — this is the serialisable boundary between the DB/resolver
 * stage and the React-PDF render stage.
 *
 * Phase 6 additions: optional `cogs` block with DDFT-branded 4-step Certificate
 * of Good Standing section.
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

/**
 * Phase 6 — Certificate of Good Standing section for the Laufzettel.
 * Pulled from `cogs_kammer` via the CoGS resolver, enriched with routing
 * metadata for the "maßgebliches Bundesland"-label.
 */
export type CogsSection = {
  beruf: "arzt" | "zahnarzt";
  /** Human-readable beruf label: "Ärztin/Arzt" or "Zahnärztin/Zahnarzt". */
  berufLabel: string;
  /** The decided Bundesland used for routing, with human-readable name. */
  maßgeblichesBundesland: { key: string; name: string };
  /** "arbeitsort" | "wohnsitz" — which input drove the routing. */
  routingSource: "arbeitsort" | "wohnsitz";
  nrwSubregion: "nordrhein" | "westfalen-lippe" | null;
  /** The resolved Kammer/Stelle */
  kammerName: string | null;
  zustaendigeStelle: string;
  zustaendigeStelleHinweis: string | null;
  fuehrungszeugnisOEmpfaenger: string;
  antragsverfahren: string | null;
  erforderlicheDokumente: string[];
  directUrlGoodStanding: string | null;
  kontaktEmail: string | null;
  kontaktTelefon: string | null;
  kontaktAdresse: string | null;
  besonderheiten: string | null;
  /** True when research found official procedure — otherwise UI must prompt phone call. */
  datenVollstaendig: boolean;
};

export type LauflisteInput = {
  person: {
    name: string;
    /** ISO `yyyy-MM-dd` or preformatted `dd.MM.yyyy` — renderer prints as-is. */
    birthdate: string | null;
  };
  generatedAt: Date;
  /** Optional — when absent, Section A is skipped (legacy cases without beruf). */
  cogs: CogsSection | null;
  documents: LauflisteDocumentEntry[];
};
