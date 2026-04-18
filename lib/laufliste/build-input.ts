import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";

import { db as defaultDb, type Db } from "@/db/client";
import {
  caseTable,
  caseDocument,
  documentReview,
  extraction,
} from "@/db/schema";
import {
  resolveAuthority,
  type ResolverResult,
  type ResolverInput,
  type AuthorityRow,
  type ResolverDb,
} from "@/lib/behoerden/resolve";

import type {
  AuthorityBlock,
  CogsSection,
  LauflisteDocumentEntry,
  LauflisteInput,
  VorbeglaubigungBlock,
} from "./types";
import { endbeglaubigungFor } from "./endbeglaubigung";
import { UAE_EMBASSY_BERLIN } from "./embassy";
import { bundeslandName } from "@/lib/bundesland";
import { resolveCogs } from "@/lib/cogs/resolve";

/**
 * Phase 4 Plan 04 Task 1 — pure composer that turns a (caseId, userId) pair
 * into the `LauflisteInput` render contract defined in `./types`.
 *
 * Responsibilities:
 *   1. Ownership gate via `case.user_id = userId`. Wrong owner → null
 *      (matches `getCaseForUser` zero-leak policy — never throw, never 403).
 *   2. Join case_document + document_review to read each doc's corrected
 *      fields and original position.
 *   3. For each document, re-invoke `resolveAuthority()` with the corrected
 *      fields (D-18: authority lookups happen at *generation* time, not
 *      cached from Phase 3 review). A previously resolved_authority_id on
 *      document_review is intentionally ignored.
 *   4. Route exceptions:
 *        Führungszeugnis  → vorbeglaubigung: exception-apostille,
 *                            endbeglaubigung: BfJ (via endbeglaubigungFor),
 *                            legalisation: null
 *        Reisepass        → vorbeglaubigung: exception-reisepass,
 *                            endbeglaubigung: null,
 *                            legalisation: null
 *        Everything else  → vorbeglaubigung: authority from resolver,
 *                            endbeglaubigung: BVA (via endbeglaubigungFor),
 *                            legalisation: UAE_EMBASSY_BERLIN
 *   5. Format `ausstellungsdatum` (ISO yyyy-MM-dd) as `dd.MM.yyyy` for the
 *      renderer. Null / malformed → null pass-through.
 *
 * This function is PURE with respect to side effects: it does not write to
 * the DB, does not talk to the filesystem, and does not call auth. The
 * Server Action (Task 2) wraps it with auth + render + write.
 *
 * The optional `opts.resolver` is a seam for unit tests so they can assert
 * the resolver is invoked once per document without needing vi.mock at the
 * module level (matches Phase 3 Plan 03 precedent).
 */

// Substring patterns drive the exception routing. Must match how
// `endbeglaubigungFor()` detects Führungszeugnis (case-insensitive) so that
// the Vorbeglaubigung and Endbeglaubigung branches agree.
const FUEHRUNGSZEUGNIS_RE = /führungszeugnis/i;
const REISEPASS_RE = /reisepass/i;

export type BuildLauflisteInputOptions = {
  /** Injectable resolver for tests (Phase 3 Plan 03 precedent). */
  resolver?: (
    input: ResolverInput,
    db: ResolverDb,
  ) => Promise<ResolverResult>;
};

export async function buildLauflisteInput(
  caseId: string,
  userId: string,
  db: Db = defaultDb,
  opts: BuildLauflisteInputOptions = {},
): Promise<LauflisteInput | null> {
  // 1. Ownership gate on case. Returns the row in a single round-trip so we
  // can also read person_name / birthdate.
  const caseRows = await db
    .select()
    .from(caseTable)
    .where(and(eq(caseTable.id, caseId), eq(caseTable.userId, userId)))
    .limit(1);
  const caseRow = caseRows[0];
  if (!caseRow) return null;

  // 2. Read case_document rows ordered by position, joined to the
  // corrected_fields JSON from document_review.
  const rows = await db
    .select({
      caseDocumentId: caseDocument.id,
      documentId: caseDocument.documentId,
      position: caseDocument.position,
      correctedFields: documentReview.correctedFields,
    })
    .from(caseDocument)
    .leftJoin(documentReview, eq(documentReview.documentId, caseDocument.documentId))
    .where(eq(caseDocument.caseId, caseId))
    .orderBy(asc(caseDocument.position));

  const resolver = opts.resolver ?? resolveAuthority;
  const documents: LauflisteDocumentEntry[] = [];

  // Phase 6: pre-load extraction rows for all documents in this case as a
  // fallback when document_review is missing (reviews are no longer required
  // to add docs to a case).
  const docIds = rows.map((r) => r.documentId);
  const extractionRows =
    docIds.length === 0
      ? []
      : await db
          .select({
            documentId: extraction.documentId,
            fieldName: extraction.fieldName,
            fieldValue: extraction.fieldValue,
          })
          .from(extraction)
          .where(inArray(extraction.documentId, docIds));
  const extractionByDoc = new Map<string, Record<string, string>>();
  for (const e of extractionRows) {
    const bucket = extractionByDoc.get(e.documentId) ?? {};
    if (e.fieldValue != null) bucket[e.fieldName] = e.fieldValue;
    extractionByDoc.set(e.documentId, bucket);
  }

  for (const row of rows) {
    // Prefer reviewed (corrected) fields; fall back to auto-extraction when
    // the document never went through the manual review flow (Phase 6 removed
    // the review gate from the case-add pipeline).
    const reviewCf = (row.correctedFields ?? null) as
      | Record<string, string>
      | null;
    const extractionCf = extractionByDoc.get(row.documentId) ?? {};
    const cf: Record<string, string> = reviewCf ?? extractionCf;
    const dokumentenTyp = cf.dokumenten_typ ?? "";

    const isReisepass = REISEPASS_RE.test(dokumentenTyp);
    const isFuehrungszeugnis = FUEHRUNGSZEUGNIS_RE.test(dokumentenTyp);

    let vorbeglaubigung: VorbeglaubigungBlock;
    let endbeglaubigung: AuthorityBlock | null;
    let legalisation: AuthorityBlock | null;

    if (isReisepass) {
      vorbeglaubigung = { kind: "exception-reisepass" };
      endbeglaubigung = null;
      legalisation = null;
    } else if (isFuehrungszeugnis) {
      // Apostille short-chain: no Vorbeglaubigung authority block, BfJ as
      // the Endbeglaubigung step, no UAE legalisation (D-08).
      vorbeglaubigung = { kind: "exception-apostille" };
      endbeglaubigung = endbeglaubigungFor(dokumentenTyp); // BfJ
      legalisation = null;
    } else {
      // Normal 3-step chain: resolver → BVA → UAE Embassy.
      const resolverInput: ResolverInput = {
        dokumenten_typ: dokumentenTyp,
        bundesland: cf.bundesland ?? "",
        ausstellungsort: cf.ausstellungsort ?? "",
      };
      const result = await resolver(resolverInput, db as ResolverDb);
      vorbeglaubigung = resolverResultToVorbeglaubigung(result);
      endbeglaubigung = endbeglaubigungFor(dokumentenTyp); // BVA
      legalisation = UAE_EMBASSY_BERLIN;
    }

    documents.push({
      position: row.position,
      dokumentart: dokumentenTyp || "",
      ausstellendeBehoerde: cf.ausstellende_behoerde || null,
      ausstellungsort: cf.ausstellungsort || null,
      ausstellungsdatum: formatIsoDate(cf.ausstellungsdatum ?? null),
      vollerName: cf.voller_name || null,
      vorbeglaubigung,
      endbeglaubigung,
      legalisation,
    });
  }

  // Phase 6 — resolve CoGS section when the case has Beruf + at least one BL input.
  let cogs: CogsSection | null = null;
  if (caseRow.beruf && (caseRow.wohnsitzBundesland || caseRow.arbeitsortBundesland)) {
    try {
      const cogsResult = await resolveCogs({
        beruf: caseRow.beruf as "arzt" | "zahnarzt",
        arbeitsortBundesland: caseRow.arbeitsortBundesland ?? null,
        wohnsitzBundesland: caseRow.wohnsitzBundesland ?? "",
        nrwSubregion:
          (caseRow.nrwSubregion as "nordrhein" | "westfalen-lippe" | null) ??
          null,
      });
      if (cogsResult.ok) {
        const k = cogsResult.cogsKammer;
        cogs = {
          beruf: caseRow.beruf as "arzt" | "zahnarzt",
          berufLabel:
            caseRow.beruf === "arzt" ? "Ärztin / Arzt" : "Zahnärztin / Zahnarzt",
          maßgeblichesBundesland: {
            key: cogsResult.routing.bundeslandKey,
            name: bundeslandName(
              (cogsResult.routing.bundeslandKey || "").split("_")[0],
            ),
          },
          routingSource: cogsResult.routing.used,
          nrwSubregion: cogsResult.routing.appliedNrwSubregion,
          kammerName: k.kammerName,
          zustaendigeStelle: k.zustaendigeStelle,
          zustaendigeStelleHinweis: k.zustaendigeStelleHinweis,
          fuehrungszeugnisOEmpfaenger: k.fuehrungszeugnisOEmpfaenger,
          antragsverfahren: k.antragsverfahren,
          erforderlicheDokumente: (k.erforderlicheDokumente ?? "")
            .split("|")
            .map((s) => s.trim())
            .filter((s) => s.length > 0),
          directUrlGoodStanding: k.directUrlGoodStanding,
          kontaktEmail: k.kontaktEmail,
          kontaktTelefon: k.kontaktTelefon,
          kontaktAdresse: k.kontaktAdresse,
          besonderheiten: k.besonderheiten,
          datenVollstaendig: k.datenVollstaendig,
        };
      }
    } catch (err) {
      console.error("[buildLauflisteInput] CoGS resolve failed:", err);
    }
  }

  return {
    person: {
      name: caseRow.personName,
      birthdate: caseRow.personBirthdate ?? null,
    },
    generatedAt: new Date(),
    cogs,
    documents,
  };
}

/**
 * Map a resolver result to a `VorbeglaubigungBlock` of kind="authority".
 *
 * - status="matched"   → full authority block with needsReview from the row.
 * - status="ambiguous" → first candidate, needsReview forced to true so the
 *                        [PRÜFEN] pill surfaces the caller's obligation to
 *                        disambiguate before relying on the PDF. The action
 *                        layer may prefer to reject with UNREVIEWED — this
 *                        composer is tolerant and delegates the policy.
 * - status="not_found" → empty placeholder block with needsReview=true so
 *                        the operator sees the gap explicitly.
 */
function resolverResultToVorbeglaubigung(
  result: ResolverResult,
): VorbeglaubigungBlock {
  if (result.status === "matched") {
    return {
      kind: "authority",
      authority: authorityRowToBlock(result.authority),
      needsReview: result.authority.needsReview,
      specialRules: result.authority.specialRules,
    };
  }
  if (result.status === "ambiguous") {
    const first = result.candidates[0];
    if (first) {
      return {
        kind: "authority",
        authority: authorityRowToBlock(first),
        needsReview: true,
        specialRules: first.specialRules,
      };
    }
  }
  // not_found or ambiguous-with-empty-candidates: emit a placeholder so the
  // PDF still renders; [PRÜFEN] is forced on.
  return {
    kind: "authority",
    authority: {
      name: "",
      address: [],
      phone: null,
      email: null,
      website: null,
      officeHours: null,
      notes: null,
    },
    needsReview: true,
    specialRules: null,
  };
}

/** Convert a Drizzle authority row into the AuthorityBlock render shape. */
function authorityRowToBlock(row: AuthorityRow): AuthorityBlock {
  const address =
    row.address == null || row.address === ""
      ? []
      : row.address.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  return {
    name: row.name,
    address,
    phone: row.phone,
    email: row.email,
    website: row.website,
    officeHours: row.officeHours,
    notes: row.notes,
  };
}

/** Format ISO yyyy-MM-dd → dd.MM.yyyy. Returns null for null / unparseable. */
function formatIsoDate(iso: string | null): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const [, yyyy, mm, dd] = m;
  return `${dd}.${mm}.${yyyy}`;
}
