// @vitest-environment node
/**
 * Phase 3 exit-gate integration suite.
 *
 * Composes approveAndResolve + chooseAmbiguousAuthority end-to-end against a
 * real SQLite DB (via createTestDb) seeded with:
 *   - two users (user-a owns the document, user-b is a decoy for completeness)
 *   - one document owned by user-a in extraction_status='done'
 *   - six extraction rows (one per FIELD_NAMES) so downstream consumers that
 *     read extractions don't explode if exercised
 *   - the full __tests__/_fixtures/behoerden-mini.json content
 *
 * This differs from lib/review/actions.test.ts which MOCKS the resolver —
 * here the resolver is REAL and reads the seeded Behörden tables. Errors at
 * the schema/ORM/resolver seam that unit tests miss surface here.
 *
 * See 03-06-PLAN.md Task 1 for the per-test breakdown.
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
import { createTestDb } from "./_fixtures/test-db";
import fs from "node:fs";
import path from "node:path";

// next/headers is only available inside a real Next request context.
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

// server-only is a Next.js marker package; stub for node env.
vi.mock("server-only", () => ({}));

// Swappable session holder so each test can toggle current user without
// re-mocking the module.
const sessionHolder: {
  current:
    | null
    | { user: { id: string; email: string }; session: { id: string } };
} = { current: null };

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(async () => sessionHolder.current),
    },
  },
}));

// Lazily bound after env var setup + fresh module graph.
/* eslint-disable @typescript-eslint/no-explicit-any */
let db: any;
let user: any;
let document: any;
let extraction: any;
let documentReview: any;
let behoerdenState: any;
let behoerdenRegierungsbezirk: any;
let behoerdenDocumentType: any;
let behoerdenAuthority: any;
let approveAndResolve: any;
let chooseAmbiguousAuthority: any;
let drizzleEq: any;
/* eslint-enable @typescript-eslint/no-explicit-any */

let dbCleanup: () => void;

const USER_A = "u-a";
const USER_B = "u-b";
const DOC_ID = "doc-a";

// Fixture matches __tests__/_fixtures/behoerden-mini.json shape
type Fixture = {
  states: {
    id: string;
    name: string;
    hat_regierungsbezirke: boolean;
    besonderheiten: string | null;
  }[];
  regierungsbezirke: {
    id: string;
    state_id: string;
    name: string;
    slug: string;
  }[];
  document_types: { id: string; display_name: string }[];
  authorities: {
    id: string;
    state_id: string;
    regierungsbezirk_id: string | null;
    document_type_id: string;
    name: string;
    address: string;
    phone: string | null;
    email: string | null;
    website: string | null;
    office_hours: string | null;
    notes: string | null;
    special_rules: string | null;
    needs_review: boolean;
  }[];
};

async function seedBehoerdenFromFixture() {
  const fixture = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, "_fixtures/behoerden-mini.json"),
      "utf8",
    ),
  ) as Fixture;

  for (const s of fixture.states) {
    await db.insert(behoerdenState).values({
      id: s.id,
      name: s.name,
      hatRegierungsbezirke: s.hat_regierungsbezirke,
      besonderheiten: s.besonderheiten,
    });
  }
  for (const r of fixture.regierungsbezirke) {
    await db.insert(behoerdenRegierungsbezirk).values({
      id: r.id,
      stateId: r.state_id,
      name: r.name,
      slug: r.slug,
    });
  }
  for (const d of fixture.document_types) {
    await db.insert(behoerdenDocumentType).values({
      id: d.id,
      displayName: d.display_name,
    });
  }
  for (const a of fixture.authorities) {
    await db.insert(behoerdenAuthority).values({
      id: a.id,
      stateId: a.state_id,
      regierungsbezirkId: a.regierungsbezirk_id,
      documentTypeId: a.document_type_id,
      name: a.name,
      address: a.address,
      phone: a.phone,
      email: a.email,
      website: a.website,
      officeHours: a.office_hours,
      notes: a.notes,
      specialRules: a.special_rules,
      needsReview: a.needs_review,
    });
  }
}

beforeAll(async () => {
  const testDb = createTestDb();
  dbCleanup = testDb.cleanup;
  process.env.DATABASE_URL = testDb.dbFile;
  process.env.BETTER_AUTH_SECRET = "testsecret12345678901234567890";
  process.env.BETTER_AUTH_URL = "http://localhost:3000";

  vi.resetModules();

  ({ db } = await import("@/db/client"));
  ({
    user,
    document,
    extraction,
    documentReview,
    behoerdenState,
    behoerdenRegierungsbezirk,
    behoerdenDocumentType,
    behoerdenAuthority,
  } = await import("@/db/schema"));
  ({ approveAndResolve, chooseAmbiguousAuthority } = await import(
    "@/lib/review/actions"
  ));
  ({ eq: drizzleEq } = await import("drizzle-orm"));
});

afterAll(async () => {
  dbCleanup?.();
});

beforeEach(async () => {
  // Clean in FK-safe order.
  await db.delete(documentReview);
  await db.delete(extraction);
  await db.delete(document);
  await db.delete(behoerdenAuthority);
  await db.delete(behoerdenRegierungsbezirk);
  await db.delete(behoerdenDocumentType);
  await db.delete(behoerdenState);
  await db.delete(user);

  // Seed users
  await db.insert(user).values([
    { id: USER_A, name: "Alice", email: "a@x.de", emailVerified: true },
    { id: USER_B, name: "Bob", email: "b@x.de", emailVerified: true },
  ]);

  // Seed one document for user-a (needed for ownership gate).
  await db.insert(document).values({
    id: DOC_ID,
    userId: USER_A,
    filename: "approbation.pdf",
    size: 1024,
    sha256: "deadbeef",
    storagePath: `data/uploads/${DOC_ID}.pdf`,
    extractionStatus: "done",
  });

  // Seed six extractions (one per FIELD_NAMES) so the document is a fully
  // "done" Phase-2 document, not a partial one.
  await db.insert(extraction).values([
    {
      id: "x1",
      documentId: DOC_ID,
      fieldName: "dokumenten_typ",
      fieldValue: "Approbationsurkunde",
      confidence: "high",
      reasoning: "title",
    },
    {
      id: "x2",
      documentId: DOC_ID,
      fieldName: "ausstellende_behoerde",
      fieldValue: "Regierung von Oberbayern",
      confidence: "high",
      reasoning: "seal",
    },
    {
      id: "x3",
      documentId: DOC_ID,
      fieldName: "ausstellungsort",
      fieldValue: "München",
      confidence: "high",
      reasoning: "header",
    },
    {
      id: "x4",
      documentId: DOC_ID,
      fieldName: "bundesland",
      fieldValue: "Bayern",
      confidence: "medium",
      reasoning: "inferred",
    },
    {
      id: "x5",
      documentId: DOC_ID,
      fieldName: "ausstellungsdatum",
      fieldValue: "2021-06-30",
      confidence: "high",
      reasoning: "stamped",
    },
    {
      id: "x6",
      documentId: DOC_ID,
      fieldName: "voller_name",
      fieldValue: "Max Mustermann",
      confidence: "high",
      reasoning: "name line",
    },
  ]);

  // Seed Behörden reference data from the fixture.
  await seedBehoerdenFromFixture();

  // Default session = user-a.
  sessionHolder.current = {
    user: { id: USER_A, email: "a@x.de" },
    session: { id: "s-a" },
  };
});

describe("Phase 3 — integration", () => {
  it("matched end-to-end: Approbationsurkunde + Bayern + München → a1 (Oberbayern) persisted + doc approved", async () => {
    const res = await approveAndResolve({
      documentId: DOC_ID,
      corrected: {
        dokumenten_typ: "Approbationsurkunde",
        ausstellende_behoerde: "Regierung von Oberbayern",
        ausstellungsort: "München",
        bundesland: "Bayern",
        ausstellungsdatum: "2021-06-30",
        voller_name: "Max Mustermann",
      },
    });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("narrow");
    expect(res.data.status).toBe("matched");
    if (res.data.status !== "matched") throw new Error("narrow");
    expect(res.data.authority.id).toBe("a1");

    const reviews = await db
      .select()
      .from(documentReview)
      .where(drizzleEq(documentReview.documentId, DOC_ID));
    expect(reviews.length).toBe(1);
    expect(reviews[0].lookupStatus).toBe("matched");
    expect(reviews[0].resolvedAuthorityId).toBe("a1");
    expect(reviews[0].approvedByUserId).toBe(USER_A);
    expect(reviews[0].correctedFields).toEqual({
      dokumenten_typ: "Approbationsurkunde",
      ausstellende_behoerde: "Regierung von Oberbayern",
      ausstellungsort: "München",
      bundesland: "Bayern",
      ausstellungsdatum: "2021-06-30",
      voller_name: "Max Mustermann",
    });

    const [doc] = await db
      .select()
      .from(document)
      .where(drizzleEq(document.id, DOC_ID));
    expect(doc.reviewStatus).toBe("approved");
    expect(doc.reviewedAt).not.toBeNull();
  });

  it("ambiguous end-to-end: Approbationsurkunde + Bayern + unknown city → ambiguous row, null authority", async () => {
    const res = await approveAndResolve({
      documentId: DOC_ID,
      corrected: {
        dokumenten_typ: "Approbationsurkunde",
        ausstellende_behoerde: "Unbekannt",
        ausstellungsort: "Kleinsdorf",
        bundesland: "Bayern",
        ausstellungsdatum: "2021-06-30",
        voller_name: "Max Mustermann",
      },
    });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("narrow");
    expect(res.data.status).toBe("ambiguous");
    if (res.data.status !== "ambiguous") throw new Error("narrow");
    // Mini fixture has two Approbationsurkunde authorities in Bayern: a1, a2
    const ids = res.data.candidates.map((c: { id: string }) => c.id).sort();
    expect(ids).toEqual(["a1", "a2"]);

    const reviews = await db
      .select()
      .from(documentReview)
      .where(drizzleEq(documentReview.documentId, DOC_ID));
    expect(reviews.length).toBe(1);
    expect(reviews[0].lookupStatus).toBe("ambiguous");
    expect(reviews[0].resolvedAuthorityId).toBeNull();
  });

  it("not_found end-to-end: unknown state → not_found row, null authority", async () => {
    const res = await approveAndResolve({
      documentId: DOC_ID,
      corrected: {
        dokumenten_typ: "Approbationsurkunde",
        ausstellende_behoerde: "—",
        ausstellungsort: "Atlantis City",
        bundesland: "Atlantis",
        ausstellungsdatum: "2021-06-30",
        voller_name: "Max Mustermann",
      },
    });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("narrow");
    expect(res.data.status).toBe("not_found");
    if (res.data.status !== "not_found") throw new Error("narrow");
    expect(res.data.reason).toBe("unknown_state");

    const reviews = await db
      .select()
      .from(documentReview)
      .where(drizzleEq(documentReview.documentId, DOC_ID));
    expect(reviews.length).toBe(1);
    expect(reviews[0].lookupStatus).toBe("not_found");
    expect(reviews[0].resolvedAuthorityId).toBeNull();
  });

  it("LKUP-03 special rules surface end-to-end: Führungszeugnis + Berlin → special_rules non-null", async () => {
    const res = await approveAndResolve({
      documentId: DOC_ID,
      corrected: {
        dokumenten_typ: "Fuehrungszeugnis",
        ausstellende_behoerde: "Bundesamt für Justiz",
        ausstellungsort: "Berlin",
        bundesland: "Berlin",
        ausstellungsdatum: "2021-06-30",
        voller_name: "Max Mustermann",
      },
    });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("narrow");
    expect(res.data.status).toBe("matched");
    if (res.data.status !== "matched") throw new Error("narrow");
    expect(res.data.special_rules).not.toBeNull();
    // Fixture: "Fuehrungszeugnis: keine Vorbeglaubigung - direkt zur Apostille beim BfAA."
    expect(res.data.special_rules).toMatch(/Apostille/i);
  });

  it("LKUP-04 full contact fields surface: authority row has the full contact shape", async () => {
    const res = await approveAndResolve({
      documentId: DOC_ID,
      corrected: {
        dokumenten_typ: "Approbationsurkunde",
        ausstellende_behoerde: "Regierung von Oberbayern",
        ausstellungsort: "München",
        bundesland: "Bayern",
        ausstellungsdatum: "2021-06-30",
        voller_name: "Max Mustermann",
      },
    });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("narrow");
    if (res.data.status !== "matched") throw new Error("narrow");
    const a = res.data.authority;
    // Field presence — values may be null for some, but the keys MUST exist.
    expect(a).toHaveProperty("name");
    expect(a).toHaveProperty("address");
    expect(a).toHaveProperty("phone");
    expect(a).toHaveProperty("email");
    expect(a).toHaveProperty("website");
    expect(a).toHaveProperty("officeHours");
    // a1 has non-null phone + website + office_hours per the fixture.
    expect(a.name).toBe("Regierung von Oberbayern");
    expect(a.phone).toBe("089 2176-0");
    expect(a.website).toBe("https://www.regierung.oberbayern.bayern.de");
    expect(a.officeHours).toBe("Mo-Do 8-16, Fr 8-12");
  });

  it("re-approval upserts: two calls for the same document → exactly ONE review row", async () => {
    const input = {
      documentId: DOC_ID,
      corrected: {
        dokumenten_typ: "Approbationsurkunde",
        ausstellende_behoerde: "Regierung von Oberbayern",
        ausstellungsort: "München",
        bundesland: "Bayern",
        ausstellungsdatum: "2021-06-30",
        voller_name: "Max Mustermann",
      },
    };
    const r1 = await approveAndResolve(input);
    expect(r1.ok).toBe(true);

    // Second call with slightly different corrected fields.
    const r2 = await approveAndResolve({
      ...input,
      corrected: { ...input.corrected, voller_name: "Erika Mustermann" },
    });
    expect(r2.ok).toBe(true);

    const reviews = await db
      .select()
      .from(documentReview)
      .where(drizzleEq(documentReview.documentId, DOC_ID));
    expect(reviews.length).toBe(1);
    expect(reviews[0].correctedFields.voller_name).toBe("Erika Mustermann");
    expect(reviews[0].lookupStatus).toBe("matched");
    expect(reviews[0].resolvedAuthorityId).toBe("a1");
  });

  it("chooseAmbiguousAuthority transitions the existing row from ambiguous → matched", async () => {
    // 1. Produce an ambiguous review first.
    const r1 = await approveAndResolve({
      documentId: DOC_ID,
      corrected: {
        dokumenten_typ: "Approbationsurkunde",
        ausstellende_behoerde: "Unbekannt",
        ausstellungsort: "Kleinsdorf",
        bundesland: "Bayern",
        ausstellungsdatum: "2021-06-30",
        voller_name: "Max Mustermann",
      },
    });
    expect(r1.ok).toBe(true);
    if (!r1.ok) throw new Error("narrow");
    expect(r1.data.status).toBe("ambiguous");

    // 2. Pick a2 (Schwaben).
    const r2 = await chooseAmbiguousAuthority({
      documentId: DOC_ID,
      authorityId: "a2",
    });
    expect(r2.ok).toBe(true);
    if (!r2.ok) throw new Error("narrow");
    expect(r2.data.authority.id).toBe("a2");

    // 3. Still exactly one review row, now matched → a2.
    const reviews = await db
      .select()
      .from(documentReview)
      .where(drizzleEq(documentReview.documentId, DOC_ID));
    expect(reviews.length).toBe(1);
    expect(reviews[0].lookupStatus).toBe("matched");
    expect(reviews[0].resolvedAuthorityId).toBe("a2");
  });
});
