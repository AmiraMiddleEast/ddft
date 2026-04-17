// @vitest-environment node
//
// Integration tests for lib/review/actions.ts.
//
// Strategy mirrors lib/extraction/actions.test.ts:
//   - Spin up a fresh isolated SQLite file via createTestDb()
//   - Set env vars BEFORE dynamically importing @/lib/auth + @/db/client
//   - Mock next/headers (not available outside a Next request) and @/lib/auth
//     (so we can toggle session per-test with mockResolvedValueOnce)
//   - Mock @/lib/behoerden/resolve so we control the resolver output without
//     seeding the full Behörden fixture
//   - Import the action dynamically so mocks are installed first
//
// The 10 behavior tests cover:
//   1 auth gate          — no session → { ok:false, error:'unauthorized' }
//   2 ownership gate     — doc owned by user B → { ok:false, error:'not_found' }
//   3 Zod gate           — too-long field → { ok:false, error:'invalid_input' }
//   4 matched happy path — row with resolvedAuthorityId; doc approved
//   5 ambiguous path     — row with resolvedAuthorityId=null; lookup_status=ambiguous
//   6 not_found path     — row with resolvedAuthorityId=null; lookup_status=not_found
//   7 re-approval upsert — second call UPDATEs the same row (no duplicates)
//   8 chooseAmbiguous OK — ambiguous row → matched, auth id set
//   9 chooseAmbiguous auth gate — no session → unauthorized
//   10 chooseAmbiguous invalid — review not ambiguous → invalid_choice

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
import { createTestDb } from "../../__tests__/_fixtures/test-db";

// Mock next/headers (no Next request context in plain Node).
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

// Stable mock for the better-auth session.
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(async () => ({
        user: { id: "user-a", email: "a@x.de" },
        session: { id: "sess-a" },
      })),
    },
  },
}));

// Mock the resolver — we want full control over its output without seeding
// the full Behörden schema. The resolver is unit-tested separately in
// lib/behoerden/resolve.test.ts.
const resolveAuthorityMock = vi.fn();
vi.mock("@/lib/behoerden/resolve", () => ({
  resolveAuthority: resolveAuthorityMock,
}));

// Lazily populated after env vars + module import.
/* eslint-disable @typescript-eslint/no-explicit-any */
let db: any;
let document: any;
let documentReview: any;
let behoerdenAuthority: any;
let behoerdenState: any;
let behoerdenDocumentType: any;
let user: any;
let approveAndResolve: any;
let chooseAmbiguousAuthority: any;
let authMod: any;
let drizzleEq: any;
/* eslint-enable @typescript-eslint/no-explicit-any */

let dbCleanup: () => void;

const DOC_ID = "doc-a";
const USER_A = "user-a";
const USER_B = "user-b";

const CORRECTED = {
  dokumenten_typ: "Geburtsurkunde",
  ausstellende_behoerde: "Standesamt Muenchen",
  ausstellungsort: "Muenchen",
  bundesland: "Bayern",
  ausstellungsdatum: "2020-01-15",
  voller_name: "Max Mustermann",
};

const AUTH_ROW_MATCHED = {
  id: "auth-1",
  stateId: "bayern",
  regierungsbezirkId: null as string | null,
  documentTypeId: "geburtsurkunde",
  name: "Standesamt Bayern",
  address: "Addr",
  phone: null as string | null,
  email: null as string | null,
  website: null as string | null,
  officeHours: null as string | null,
  notes: null as string | null,
  specialRules: null as string | null,
  needsReview: false,
};

const AUTH_ROW_AMBIGUOUS_B = {
  ...AUTH_ROW_MATCHED,
  id: "auth-2",
  name: "Standesamt Alt",
};

beforeAll(async () => {
  const testDb = createTestDb();
  dbCleanup = testDb.cleanup;
  process.env.DATABASE_URL = testDb.dbFile;
  process.env.BETTER_AUTH_SECRET = "testsecret12345678901234567890";
  process.env.BETTER_AUTH_URL = "http://localhost:3000";

  vi.resetModules();

  ({ db } = await import("@/db/client"));
  ({
    document,
    documentReview,
    behoerdenAuthority,
    behoerdenState,
    behoerdenDocumentType,
    user,
  } = await import("@/db/schema"));
  ({ approveAndResolve, chooseAmbiguousAuthority } = await import("./actions"));
  ({ eq: drizzleEq } = await import("drizzle-orm"));
  authMod = await import("@/lib/auth");
});

afterAll(async () => {
  dbCleanup?.();
});

beforeEach(async () => {
  // Reset DB state — order matters for FK.
  await db.delete(documentReview);
  await db.delete(behoerdenAuthority);
  await db.delete(behoerdenDocumentType);
  await db.delete(behoerdenState);
  await db.delete(document);
  await db.delete(user);

  // Seed two users.
  await db.insert(user).values([
    { id: USER_A, name: "A", email: "a@x.de", emailVerified: true },
    { id: USER_B, name: "B", email: "b@x.de", emailVerified: true },
  ]);

  // Seed one document owned by USER_A.
  await db.insert(document).values({
    id: DOC_ID,
    userId: USER_A,
    filename: "x.pdf",
    size: 4,
    sha256: "deadbeef",
    storagePath: `data/uploads/${DOC_ID}.pdf`,
    extractionStatus: "done",
  });

  // Seed Behörden rows the chooseAmbiguousAuthority test needs.
  await db.insert(behoerdenState).values({
    id: "bayern",
    name: "Bayern",
    hatRegierungsbezirke: true,
    besonderheiten: null,
  });
  await db.insert(behoerdenDocumentType).values({
    id: "geburtsurkunde",
    displayName: "Geburtsurkunde",
  });
  await db.insert(behoerdenAuthority).values([AUTH_ROW_MATCHED, AUTH_ROW_AMBIGUOUS_B]);

  resolveAuthorityMock.mockReset();
  authMod.auth.api.getSession.mockResolvedValue({
    user: { id: USER_A, email: "a@x.de" },
    session: { id: "sess-a" },
  });
});

describe("approveAndResolve — auth + ownership + Zod gates", () => {
  it("Test 1 (auth gate): no session returns unauthorized and does NOT touch DB", async () => {
    authMod.auth.api.getSession.mockResolvedValueOnce(null);
    const res = await approveAndResolve({
      documentId: DOC_ID,
      corrected: CORRECTED,
    });
    expect(res).toEqual({ ok: false, error: "unauthorized" });
    const rows = await db.select().from(documentReview);
    expect(rows.length).toBe(0);
    expect(resolveAuthorityMock.mock.calls.length).toBe(0);
  });

  it("Test 2 (ownership gate): documentId owned by another user returns not_found", async () => {
    // Create doc owned by USER_B
    const OTHER = "doc-b";
    await db.insert(document).values({
      id: OTHER,
      userId: USER_B,
      filename: "y.pdf",
      size: 4,
      sha256: "beefdead",
      storagePath: `data/uploads/${OTHER}.pdf`,
      extractionStatus: "done",
    });
    const res = await approveAndResolve({
      documentId: OTHER,
      corrected: CORRECTED,
    });
    expect(res).toEqual({ ok: false, error: "not_found" });
    const rows = await db.select().from(documentReview);
    expect(rows.length).toBe(0);
    expect(resolveAuthorityMock.mock.calls.length).toBe(0);
  });

  it("Test 3 (Zod gate): too-long dokumenten_typ returns invalid_input", async () => {
    const res = await approveAndResolve({
      documentId: DOC_ID,
      corrected: { ...CORRECTED, dokumenten_typ: "a".repeat(201) },
    });
    expect(res).toEqual({ ok: false, error: "invalid_input" });
    const rows = await db.select().from(documentReview);
    expect(rows.length).toBe(0);
    expect(resolveAuthorityMock.mock.calls.length).toBe(0);
  });
});

describe("approveAndResolve — happy paths per resolver status", () => {
  it("Test 4 (matched): inserts row with resolvedAuthorityId + flips document to approved", async () => {
    resolveAuthorityMock.mockResolvedValueOnce({
      status: "matched",
      authority: AUTH_ROW_MATCHED,
      routing_path: ["Bayern", "Geburtsurkunde"],
      special_rules: null,
      needs_review: false,
    });
    const res = await approveAndResolve({
      documentId: DOC_ID,
      corrected: CORRECTED,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("narrow");
    expect(res.data.status).toBe("matched");

    const reviews = await db
      .select()
      .from(documentReview)
      .where(drizzleEq(documentReview.documentId, DOC_ID));
    expect(reviews.length).toBe(1);
    expect(reviews[0].resolvedAuthorityId).toBe("auth-1");
    expect(reviews[0].lookupStatus).toBe("matched");
    expect(reviews[0].approvedByUserId).toBe(USER_A);
    expect(reviews[0].correctedFields).toEqual(CORRECTED);

    const [doc] = await db
      .select()
      .from(document)
      .where(drizzleEq(document.id, DOC_ID));
    expect(doc.reviewStatus).toBe("approved");
    expect(doc.reviewedAt).not.toBeNull();
  });

  it("Test 5 (ambiguous): inserts row with null authority + lookupStatus=ambiguous", async () => {
    resolveAuthorityMock.mockResolvedValueOnce({
      status: "ambiguous",
      candidates: [AUTH_ROW_MATCHED, AUTH_ROW_AMBIGUOUS_B],
      routing_path: ["Bayern", "Geburtsurkunde"],
    });
    const res = await approveAndResolve({
      documentId: DOC_ID,
      corrected: CORRECTED,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("narrow");
    expect(res.data.status).toBe("ambiguous");

    const reviews = await db
      .select()
      .from(documentReview)
      .where(drizzleEq(documentReview.documentId, DOC_ID));
    expect(reviews.length).toBe(1);
    expect(reviews[0].resolvedAuthorityId).toBeNull();
    expect(reviews[0].lookupStatus).toBe("ambiguous");
  });

  it("Test 6 (not_found): inserts row with null authority + lookupStatus=not_found", async () => {
    resolveAuthorityMock.mockResolvedValueOnce({
      status: "not_found",
      reason: "no_authority_for_combination",
    });
    const res = await approveAndResolve({
      documentId: DOC_ID,
      corrected: CORRECTED,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("narrow");
    expect(res.data.status).toBe("not_found");

    const reviews = await db
      .select()
      .from(documentReview)
      .where(drizzleEq(documentReview.documentId, DOC_ID));
    expect(reviews.length).toBe(1);
    expect(reviews[0].resolvedAuthorityId).toBeNull();
    expect(reviews[0].lookupStatus).toBe("not_found");
  });

  it("Test 7 (re-approval upserts): second call UPDATEs instead of creating a duplicate", async () => {
    resolveAuthorityMock.mockResolvedValueOnce({
      status: "ambiguous",
      candidates: [AUTH_ROW_MATCHED, AUTH_ROW_AMBIGUOUS_B],
      routing_path: ["Bayern", "Geburtsurkunde"],
    });
    await approveAndResolve({ documentId: DOC_ID, corrected: CORRECTED });

    const SECOND_CORRECTED = {
      ...CORRECTED,
      dokumenten_typ: "Heiratsurkunde",
    };
    resolveAuthorityMock.mockResolvedValueOnce({
      status: "matched",
      authority: AUTH_ROW_MATCHED,
      routing_path: ["Bayern", "Heiratsurkunde"],
      special_rules: null,
      needs_review: false,
    });
    const res2 = await approveAndResolve({
      documentId: DOC_ID,
      corrected: SECOND_CORRECTED,
    });
    expect(res2.ok).toBe(true);

    const reviews = await db
      .select()
      .from(documentReview)
      .where(drizzleEq(documentReview.documentId, DOC_ID));
    expect(reviews.length).toBe(1); // STILL ONE ROW
    expect(reviews[0].lookupStatus).toBe("matched");
    expect(reviews[0].resolvedAuthorityId).toBe("auth-1");
    expect(reviews[0].correctedFields).toEqual(SECOND_CORRECTED);
  });
});

describe("chooseAmbiguousAuthority", () => {
  it("Test 8 (transitions ambiguous → matched): UPDATEs the same row with chosen authority", async () => {
    // First: create an ambiguous review.
    resolveAuthorityMock.mockResolvedValueOnce({
      status: "ambiguous",
      candidates: [AUTH_ROW_MATCHED, AUTH_ROW_AMBIGUOUS_B],
      routing_path: ["Bayern", "Geburtsurkunde"],
    });
    await approveAndResolve({ documentId: DOC_ID, corrected: CORRECTED });

    const res = await chooseAmbiguousAuthority({
      documentId: DOC_ID,
      authorityId: "auth-2",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("narrow");
    expect(res.data.authority.id).toBe("auth-2");

    const reviews = await db
      .select()
      .from(documentReview)
      .where(drizzleEq(documentReview.documentId, DOC_ID));
    expect(reviews.length).toBe(1);
    expect(reviews[0].resolvedAuthorityId).toBe("auth-2");
    expect(reviews[0].lookupStatus).toBe("matched");
  });

  it("Test 9 (auth gate): no session returns unauthorized", async () => {
    authMod.auth.api.getSession.mockResolvedValueOnce(null);
    const res = await chooseAmbiguousAuthority({
      documentId: DOC_ID,
      authorityId: "auth-2",
    });
    expect(res).toEqual({ ok: false, error: "unauthorized" });
  });

  it("Test 10 (invalid_choice): review not ambiguous → invalid_choice", async () => {
    // Create a MATCHED review first.
    resolveAuthorityMock.mockResolvedValueOnce({
      status: "matched",
      authority: AUTH_ROW_MATCHED,
      routing_path: ["Bayern", "Geburtsurkunde"],
      special_rules: null,
      needs_review: false,
    });
    await approveAndResolve({ documentId: DOC_ID, corrected: CORRECTED });

    const res = await chooseAmbiguousAuthority({
      documentId: DOC_ID,
      authorityId: "auth-2",
    });
    expect(res).toEqual({ ok: false, error: "invalid_choice" });
  });

  it("Test 11 (invalid_choice): authorityId does not exist → invalid_choice", async () => {
    resolveAuthorityMock.mockResolvedValueOnce({
      status: "ambiguous",
      candidates: [AUTH_ROW_MATCHED, AUTH_ROW_AMBIGUOUS_B],
      routing_path: ["Bayern", "Geburtsurkunde"],
    });
    await approveAndResolve({ documentId: DOC_ID, corrected: CORRECTED });

    const res = await chooseAmbiguousAuthority({
      documentId: DOC_ID,
      authorityId: "auth-nope",
    });
    expect(res).toEqual({ ok: false, error: "invalid_choice" });
  });

  it("Test 12 (ownership gate): choosing for another user's document returns not_found", async () => {
    // Create a doc owned by USER_B
    const OTHER = "doc-b";
    await db.insert(document).values({
      id: OTHER,
      userId: USER_B,
      filename: "y.pdf",
      size: 4,
      sha256: "beefdead",
      storagePath: `data/uploads/${OTHER}.pdf`,
      extractionStatus: "done",
    });
    const res = await chooseAmbiguousAuthority({
      documentId: OTHER,
      authorityId: "auth-2",
    });
    expect(res).toEqual({ ok: false, error: "not_found" });
  });
});
