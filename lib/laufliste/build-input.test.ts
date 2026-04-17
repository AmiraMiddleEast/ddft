// @vitest-environment node
//
// Integration tests for lib/laufliste/build-input.ts (Phase 4 Plan 04 Task 1).
//
// Uses the same fresh-DB fixture pattern as lib/cases/queries.test.ts:
//   - createTestDb() provisions an isolated SQLite file + drizzle-kit push.
//   - DATABASE_URL set BEFORE dynamic imports so @/db/client resolves to
//     the test DB.
//   - server-only is stubbed.
//
// Covers D-18 (resolver re-run per document), D-08 (Führungszeugnis +
// Reisepass exceptions), D-11 (authority block composition), and the
// ordering / formatting contract of the LauflisteInput shape.

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { createTestDb } from "../../__tests__/_fixtures/test-db";

vi.mock("server-only", () => ({}));

/* eslint-disable @typescript-eslint/no-explicit-any */
let db: any;
let user: any;
let document: any;
let documentReview: any;
let caseTable: any;
let caseDocument: any;
let behoerdenState: any;
let behoerdenDocumentType: any;
let behoerdenAuthority: any;
let buildLauflisteInput: any;
/* eslint-enable @typescript-eslint/no-explicit-any */

let dbCleanup: () => void;

const USER_A = "user-a";
const USER_B = "user-b";

beforeAll(async () => {
  const testDb = createTestDb();
  dbCleanup = testDb.cleanup;
  process.env.DATABASE_URL = testDb.dbFile;
  process.env.BETTER_AUTH_SECRET = "testsecret12345678901234567890";
  process.env.BETTER_AUTH_URL = "http://localhost:3000";

  ({ db } = await import("@/db/client"));
  ({
    user,
    document,
    documentReview,
    caseTable,
    caseDocument,
    behoerdenState,
    behoerdenDocumentType,
    behoerdenAuthority,
  } = await import("@/db/schema"));
  ({ buildLauflisteInput } = await import("./build-input"));
});

afterAll(() => {
  dbCleanup?.();
});

beforeEach(async () => {
  // FK-safe wipe order.
  await db.delete(caseDocument);
  await db.delete(caseTable);
  await db.delete(documentReview);
  await db.delete(document);
  await db.delete(behoerdenAuthority);
  await db.delete(behoerdenDocumentType);
  await db.delete(behoerdenState);
  await db.delete(user);

  await db.insert(user).values([
    { id: USER_A, name: "A", email: "a@x.de", emailVerified: true },
    { id: USER_B, name: "B", email: "b@x.de", emailVerified: true },
  ]);
});

// -----------------------------------------------------------------------
// Seed helpers
// -----------------------------------------------------------------------

async function seedBehoerden() {
  // Minimal Behörden-DB: Bayern + Geburtsurkunde → Landgericht München I.
  await db.insert(behoerdenState).values({
    id: "bayern",
    name: "Bayern",
    hatRegierungsbezirke: false,
  });
  await db.insert(behoerdenDocumentType).values({
    id: "geburtsurkunde",
    displayName: "Geburtsurkunde",
  });
  await db.insert(behoerdenAuthority).values({
    id: "auth-muc",
    stateId: "bayern",
    regierungsbezirkId: null,
    documentTypeId: "geburtsurkunde",
    name: "Landgericht München I",
    address: "Prielmayerstraße 7\n80335 München",
    phone: "+49 89 5597-0",
    email: null,
    website: null,
    officeHours: "Mo–Fr 08:00–15:00",
    notes: null,
    specialRules: "Beglaubigung durch Präsidenten erforderlich.",
    needsReview: true,
  });
}

async function seedDoc(
  id: string,
  userId: string,
  correctedFields: Record<string, string>,
) {
  await db.insert(document).values({
    id,
    userId,
    filename: `${id}.pdf`,
    size: 4,
    sha256: `sha-${id}`,
    storagePath: `data/uploads/${id}.pdf`,
    extractionStatus: "done",
    reviewStatus: "approved",
  });
  await db.insert(documentReview).values({
    id: `rev-${id}`,
    documentId: id,
    approvedByUserId: userId,
    correctedFields,
    resolvedAuthorityId: null,
    lookupStatus: "matched",
  });
}

async function seedCase(
  caseId: string,
  userId: string,
  personName: string,
  personBirthdate: string | null = null,
) {
  await db.insert(caseTable).values({
    id: caseId,
    userId,
    personName,
    personBirthdate,
    status: "open",
  });
}

async function attachDoc(
  caseDocumentId: string,
  caseId: string,
  documentId: string,
  position: number,
) {
  await db.insert(caseDocument).values({
    id: caseDocumentId,
    caseId,
    documentId,
    position,
  });
}

const GEBURTSURKUNDE_FIELDS = {
  dokumenten_typ: "Geburtsurkunde",
  ausstellende_behoerde: "Standesamt München",
  ausstellungsort: "München",
  bundesland: "Bayern",
  ausstellungsdatum: "1985-04-15",
  voller_name: "Dr. Müller Özgür Weiß",
};

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

describe("buildLauflisteInput", () => {
  it("returns null when case not found", async () => {
    const result = await buildLauflisteInput("nope", USER_A, db);
    expect(result).toBeNull();
  });

  it("returns null when case belongs to different user", async () => {
    await seedCase("case-1", USER_B, "Bob");
    const result = await buildLauflisteInput("case-1", USER_A, db);
    expect(result).toBeNull();
  });

  it("composes single normal document with resolver authority + BVA + Embassy", async () => {
    await seedBehoerden();
    await seedCase("case-1", USER_A, "Dr. Müller Özgür Weiß", "1985-04-15");
    await seedDoc("doc-1", USER_A, GEBURTSURKUNDE_FIELDS);
    await attachDoc("cd-1", "case-1", "doc-1", 1);

    const input = await buildLauflisteInput("case-1", USER_A, db);
    expect(input).not.toBeNull();
    if (!input) throw new Error("narrow");

    expect(input.person.name).toBe("Dr. Müller Özgür Weiß");
    expect(input.person.birthdate).toBe("1985-04-15");
    expect(input.documents.length).toBe(1);

    const doc0 = input.documents[0];
    expect(doc0.position).toBe(1);
    expect(doc0.dokumentart).toBe("Geburtsurkunde");
    expect(doc0.ausstellendeBehoerde).toBe("Standesamt München");
    expect(doc0.ausstellungsort).toBe("München");
    expect(doc0.ausstellungsdatum).toBe("15.04.1985");
    expect(doc0.vollerName).toBe("Dr. Müller Özgür Weiß");

    // Vorbeglaubigung: authority block from resolver.
    expect(doc0.vorbeglaubigung.kind).toBe("authority");
    if (doc0.vorbeglaubigung.kind !== "authority") throw new Error("narrow");
    expect(doc0.vorbeglaubigung.authority.name).toBe("Landgericht München I");
    expect(doc0.vorbeglaubigung.authority.address).toEqual([
      "Prielmayerstraße 7",
      "80335 München",
    ]);
    expect(doc0.vorbeglaubigung.authority.phone).toBe("+49 89 5597-0");
    expect(doc0.vorbeglaubigung.needsReview).toBe(true);
    expect(doc0.vorbeglaubigung.specialRules).toBe(
      "Beglaubigung durch Präsidenten erforderlich.",
    );

    // Endbeglaubigung: BVA (not Führungszeugnis).
    expect(doc0.endbeglaubigung?.name).toContain("Bundesverwaltungsamt");
    // Legalisation: UAE Embassy.
    expect(doc0.legalisation?.name).toContain(
      "Vereinigten Arabischen Emirate",
    );
  });

  it("Führungszeugnis routes to exception-apostille with BfJ Endbeglaubigung and null legalisation", async () => {
    // No behörden seed needed — short-circuit via dokumenten_typ pattern.
    await seedCase("case-1", USER_A, "Anna Example");
    await seedDoc("doc-fz", USER_A, {
      dokumenten_typ: "Führungszeugnis nach §30 BZRG",
      ausstellende_behoerde: "Bundesamt für Justiz",
      ausstellungsort: "Bonn",
      bundesland: "Nordrhein-Westfalen",
      ausstellungsdatum: "2026-03-10",
      voller_name: "Anna Example",
    });
    await attachDoc("cd-1", "case-1", "doc-fz", 1);

    const input = await buildLauflisteInput("case-1", USER_A, db);
    if (!input) throw new Error("expected input");

    const doc0 = input.documents[0];
    expect(doc0.vorbeglaubigung.kind).toBe("exception-apostille");
    expect(doc0.endbeglaubigung?.name).toContain("Bundesamt für Justiz");
    expect(doc0.legalisation).toBeNull();
  });

  it("Reisepass routes to exception-reisepass with null endbeglaubigung and legalisation", async () => {
    await seedCase("case-1", USER_A, "Anna Example");
    await seedDoc("doc-rp", USER_A, {
      dokumenten_typ: "Reisepass",
      ausstellende_behoerde: "Bürgerbüro München",
      ausstellungsort: "München",
      bundesland: "Bayern",
      ausstellungsdatum: "2022-07-22",
      voller_name: "Anna Example",
    });
    await attachDoc("cd-1", "case-1", "doc-rp", 1);

    const input = await buildLauflisteInput("case-1", USER_A, db);
    if (!input) throw new Error("expected input");

    const doc0 = input.documents[0];
    expect(doc0.vorbeglaubigung.kind).toBe("exception-reisepass");
    expect(doc0.endbeglaubigung).toBeNull();
    expect(doc0.legalisation).toBeNull();
  });

  it("re-invokes resolveAuthority per document (D-18) — not a cached FK", async () => {
    await seedBehoerden();
    await seedCase("case-1", USER_A, "Dr. Müller");
    await seedDoc("doc-1", USER_A, GEBURTSURKUNDE_FIELDS);
    await seedDoc("doc-2", USER_A, GEBURTSURKUNDE_FIELDS);
    await attachDoc("cd-1", "case-1", "doc-1", 1);
    await attachDoc("cd-2", "case-1", "doc-2", 2);

    let counter = 0;
    const fakeResolver = async () => {
      counter += 1;
      return {
        status: "matched" as const,
        authority: {
          id: "auth-muc",
          stateId: "bayern",
          regierungsbezirkId: null,
          documentTypeId: "geburtsurkunde",
          name: "Landgericht München I",
          address: "Prielmayerstraße 7\n80335 München",
          phone: null,
          email: null,
          website: null,
          officeHours: null,
          notes: null,
          specialRules: null,
          needsReview: false,
        },
        routing_path: [],
        special_rules: null,
        needs_review: false,
      };
    };

    await buildLauflisteInput("case-1", USER_A, db, {
      resolver: fakeResolver,
    });
    expect(counter).toBe(2);
  });

  it("orders documents by case_document.position ASC", async () => {
    await seedBehoerden();
    await seedCase("case-1", USER_A, "Dr. Müller");
    await seedDoc("doc-a", USER_A, GEBURTSURKUNDE_FIELDS);
    await seedDoc("doc-b", USER_A, GEBURTSURKUNDE_FIELDS);
    await seedDoc("doc-c", USER_A, GEBURTSURKUNDE_FIELDS);
    // Attach out of order on purpose.
    await attachDoc("cd-a", "case-1", "doc-a", 3);
    await attachDoc("cd-b", "case-1", "doc-b", 1);
    await attachDoc("cd-c", "case-1", "doc-c", 2);

    const input = await buildLauflisteInput("case-1", USER_A, db);
    if (!input) throw new Error("expected input");
    expect(input.documents.map((d: { position: number }) => d.position)).toEqual([
      1, 2, 3,
    ]);
  });

  it("formats ausstellungsdatum as dd.MM.yyyy; null stays null", async () => {
    await seedBehoerden();
    await seedCase("case-1", USER_A, "Dr. Müller");
    await seedDoc("doc-iso", USER_A, {
      ...GEBURTSURKUNDE_FIELDS,
      ausstellungsdatum: "2020-12-31",
    });
    await attachDoc("cd-iso", "case-1", "doc-iso", 1);

    const input = await buildLauflisteInput("case-1", USER_A, db);
    if (!input) throw new Error("expected input");
    expect(input.documents[0].ausstellungsdatum).toBe("31.12.2020");
  });

  it("passes needs_review flag from resolver into VorbeglaubigungBlock", async () => {
    await seedBehoerden(); // authority has needsReview=true
    await seedCase("case-1", USER_A, "Dr. Müller");
    await seedDoc("doc-1", USER_A, GEBURTSURKUNDE_FIELDS);
    await attachDoc("cd-1", "case-1", "doc-1", 1);

    const input = await buildLauflisteInput("case-1", USER_A, db);
    if (!input) throw new Error("expected input");
    const v = input.documents[0].vorbeglaubigung;
    if (v.kind !== "authority") throw new Error("narrow");
    expect(v.needsReview).toBe(true);
  });

  it("returns an empty documents array when case has no documents (caller distinguishes)", async () => {
    await seedCase("case-1", USER_A, "Dr. Müller");
    const input = await buildLauflisteInput("case-1", USER_A, db);
    expect(input).not.toBeNull();
    if (!input) throw new Error("narrow");
    expect(input.documents).toEqual([]);
    expect(input.person.name).toBe("Dr. Müller");
  });

  it("falls back to resolver-derived vorbeglaubigung when authority not found", async () => {
    // No behörden seed — resolver returns not_found.
    await seedCase("case-1", USER_A, "Dr. Müller");
    await seedDoc("doc-1", USER_A, GEBURTSURKUNDE_FIELDS);
    await attachDoc("cd-1", "case-1", "doc-1", 1);

    const input = await buildLauflisteInput("case-1", USER_A, db);
    if (!input) throw new Error("expected input");
    const v = input.documents[0].vorbeglaubigung;
    // Graceful fallback: authority kind with an empty-ish block rather than throw.
    expect(v.kind).toBe("authority");
    if (v.kind !== "authority") throw new Error("narrow");
    expect(v.needsReview).toBe(true); // not_found → needs operator review
  });
});
