// @vitest-environment node
//
// Integration tests for lib/cases/actions.ts.
//
// Strategy mirrors lib/review/actions.test.ts:
//   - Fresh isolated SQLite file via createTestDb()
//   - Set env vars BEFORE dynamically importing @/lib/auth + @/db/client
//   - Mock next/headers (no Next request context outside a handler)
//   - Mock @/lib/auth so we toggle session per-test
//   - Mock next/cache (revalidatePath has no Next render context here)
//   - Import the actions dynamically so mocks are installed first
//
// Covers Plan 04-02 Task 2 done criteria:
//   CASE-01 (create), CASE-02 (add), D-02 (global unique), D-05 (reorder),
//   D-20 (ownership), T-04-05..09 (STRIDE entries).

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

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

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

/* eslint-disable @typescript-eslint/no-explicit-any */
let db: any;
let user: any;
let document: any;
let documentReview: any;
let caseTable: any;
let caseDocument: any;
let createCaseAction: any;
let addDocumentsToCaseAction: any;
let removeDocumentFromCaseAction: any;
let reorderCaseDocumentsAction: any;
let authMod: any;
let drizzleEq: any;
let drizzleAsc: any;
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

  vi.resetModules();

  ({ db } = await import("@/db/client"));
  ({ user, document, documentReview, caseTable, caseDocument } = await import(
    "@/db/schema"
  ));
  ({
    createCaseAction,
    addDocumentsToCaseAction,
    removeDocumentFromCaseAction,
    reorderCaseDocumentsAction,
  } = await import("./actions"));
  ({ eq: drizzleEq, asc: drizzleAsc } = await import("drizzle-orm"));
  authMod = await import("@/lib/auth");
});

afterAll(() => {
  dbCleanup?.();
});

async function seedDoc(id: string, userId: string, approved = true) {
  await db.insert(document).values({
    id,
    userId,
    filename: `${id}.pdf`,
    size: 4,
    sha256: `sha-${id}`,
    storagePath: `data/uploads/${id}.pdf`,
    extractionStatus: "done",
    reviewStatus: approved ? "approved" : "pending",
  });
  if (approved) {
    await db.insert(documentReview).values({
      id: `rev-${id}`,
      documentId: id,
      approvedByUserId: userId,
      correctedFields: {
        dokumenten_typ: "Geburtsurkunde",
        ausstellende_behoerde: "X",
        ausstellungsort: "Y",
        bundesland: "Bayern",
        ausstellungsdatum: "2020-01-15",
        voller_name: "Max",
      },
      resolvedAuthorityId: null,
      lookupStatus: "not_found",
    });
  }
}

beforeEach(async () => {
  // FK-safe wipe order.
  await db.delete(caseDocument);
  await db.delete(caseTable);
  await db.delete(documentReview);
  await db.delete(document);
  await db.delete(user);

  await db.insert(user).values([
    { id: USER_A, name: "A", email: "a@x.de", emailVerified: true },
    { id: USER_B, name: "B", email: "b@x.de", emailVerified: true },
  ]);

  authMod.auth.api.getSession.mockResolvedValue({
    user: { id: USER_A, email: "a@x.de" },
    session: { id: "sess-a" },
  });
});

// ---- createCaseAction ---------------------------------------------------

describe("createCaseAction", () => {
  it("creates a case with valid input and returns caseId", async () => {
    const res = await createCaseAction({ personName: "Dr. Alice Schmidt", beruf: "arzt", wohnsitzBundesland: "BE", arbeitsortBundesland: "BE" });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("narrow");
    expect(res.data.caseId).toBeTruthy();

    const rows = await db.select().from(caseTable);
    expect(rows.length).toBe(1);
    expect(rows[0].personName).toBe("Dr. Alice Schmidt");
    expect(rows[0].userId).toBe(USER_A);
    expect(rows[0].status).toBe("open");
  });

  it("rejects empty person_name with VALIDATION error", async () => {
    const res = await createCaseAction({ personName: "   " });
    expect(res).toMatchObject({ ok: false, error: "VALIDATION" });
    const rows = await db.select().from(caseTable);
    expect(rows.length).toBe(0);
  });

  it("unauthorized session returns UNAUTHORIZED and does NOT write", async () => {
    authMod.auth.api.getSession.mockResolvedValueOnce(null);
    const res = await createCaseAction({ personName: "Bob", beruf: "arzt", wohnsitzBundesland: "BE", arbeitsortBundesland: "BE" });
    expect(res).toEqual({ ok: false, error: "UNAUTHORIZED" });
    const rows = await db.select().from(caseTable);
    expect(rows.length).toBe(0);
  });
});

// ---- addDocumentsToCaseAction ------------------------------------------

describe("addDocumentsToCaseAction", () => {
  it("inserts rows with sequential positions starting at max+1", async () => {
    // Seed a case + two docs already at positions 1,2; then add two more.
    await db.insert(caseTable).values({
      id: "case-1",
      userId: USER_A,
      personName: "Alice",
      status: "open",
    });
    await seedDoc("doc-1", USER_A);
    await seedDoc("doc-2", USER_A);
    await db.insert(caseDocument).values([
      { id: "cd-1", caseId: "case-1", documentId: "doc-1", position: 1 },
      { id: "cd-2", caseId: "case-1", documentId: "doc-2", position: 2 },
    ]);
    await seedDoc("doc-3", USER_A);
    await seedDoc("doc-4", USER_A);

    const res = await addDocumentsToCaseAction({
      caseId: "case-1",
      documentIds: ["doc-3", "doc-4"],
    });
    expect(res.ok).toBe(true);

    const rows = await db
      .select()
      .from(caseDocument)
      .where(drizzleEq(caseDocument.caseId, "case-1"))
      .orderBy(drizzleAsc(caseDocument.position));
    expect(rows.map((r: { position: number }) => r.position)).toEqual([
      1, 2, 3, 4,
    ]);
    expect(rows[2].documentId).toBe("doc-3");
    expect(rows[3].documentId).toBe("doc-4");
  });

  it("rejects cross-case duplicate via UNIQUE → DOC_ALREADY_ASSIGNED", async () => {
    // Document doc-a is already in case-1. Trying to add it to case-2 must fail.
    await db.insert(caseTable).values([
      { id: "case-1", userId: USER_A, personName: "Alice", status: "open" },
      { id: "case-2", userId: USER_A, personName: "Bob", status: "open" },
    ]);
    await seedDoc("doc-a", USER_A);
    await db.insert(caseDocument).values({
      id: "cd-a",
      caseId: "case-1",
      documentId: "doc-a",
      position: 1,
    });

    const res = await addDocumentsToCaseAction({
      caseId: "case-2",
      documentIds: ["doc-a"],
    });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("narrow");
    expect(res.error).toBe("DOC_ALREADY_ASSIGNED");
    expect(res.details).toMatchObject({ documentId: "doc-a" });

    // And transaction rolled back — case-2 still has no documents.
    const rows = await db
      .select()
      .from(caseDocument)
      .where(drizzleEq(caseDocument.caseId, "case-2"));
    expect(rows.length).toBe(0);
  });

  it("accepts unreviewed document (Phase 6: review gate removed)", async () => {
    await db.insert(caseTable).values({
      id: "case-1",
      userId: USER_A,
      personName: "Alice",
      status: "open",
    });
    await seedDoc("doc-pending", USER_A, /* approved= */ false);

    const res = await addDocumentsToCaseAction({
      caseId: "case-1",
      documentIds: ["doc-pending"],
    });
    expect(res.ok).toBe(true);
    const rows = await db.select().from(caseDocument);
    expect(rows.length).toBe(1);
  });

  it("rejects unowned document with FORBIDDEN (no cross-user theft)", async () => {
    await db.insert(caseTable).values({
      id: "case-1",
      userId: USER_A,
      personName: "Alice",
      status: "open",
    });
    await seedDoc("doc-b", USER_B);

    const res = await addDocumentsToCaseAction({
      caseId: "case-1",
      documentIds: ["doc-b"],
    });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("narrow");
    expect(res.error).toBe("FORBIDDEN");
    const rows = await db.select().from(caseDocument);
    expect(rows.length).toBe(0);
  });

  it("rejects unowned caseId with NOT_FOUND", async () => {
    await db.insert(caseTable).values({
      id: "case-b",
      userId: USER_B,
      personName: "Bob",
      status: "open",
    });
    await seedDoc("doc-1", USER_A);

    const res = await addDocumentsToCaseAction({
      caseId: "case-b",
      documentIds: ["doc-1"],
    });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("narrow");
    expect(res.error).toBe("NOT_FOUND");
  });
});

// ---- removeDocumentFromCaseAction --------------------------------------

describe("removeDocumentFromCaseAction", () => {
  it("removes one row and renumbers remaining positions contiguously", async () => {
    await db.insert(caseTable).values({
      id: "case-1",
      userId: USER_A,
      personName: "Alice",
      status: "open",
    });
    await seedDoc("doc-1", USER_A);
    await seedDoc("doc-2", USER_A);
    await seedDoc("doc-3", USER_A);
    await db.insert(caseDocument).values([
      { id: "cd-1", caseId: "case-1", documentId: "doc-1", position: 1 },
      { id: "cd-2", caseId: "case-1", documentId: "doc-2", position: 2 },
      { id: "cd-3", caseId: "case-1", documentId: "doc-3", position: 3 },
    ]);

    const res = await removeDocumentFromCaseAction({
      caseId: "case-1",
      caseDocumentId: "cd-2",
    });
    expect(res.ok).toBe(true);

    const rows = await db
      .select()
      .from(caseDocument)
      .where(drizzleEq(caseDocument.caseId, "case-1"))
      .orderBy(drizzleAsc(caseDocument.position));
    expect(rows.length).toBe(2);
    expect(rows.map((r: { position: number }) => r.position)).toEqual([1, 2]);
    expect(rows[0].id).toBe("cd-1");
    expect(rows[1].id).toBe("cd-3");
  });
});

// ---- reorderCaseDocumentsAction ----------------------------------------

describe("reorderCaseDocumentsAction", () => {
  async function seedThree() {
    await db.insert(caseTable).values({
      id: "case-1",
      userId: USER_A,
      personName: "Alice",
      status: "open",
    });
    await seedDoc("doc-1", USER_A);
    await seedDoc("doc-2", USER_A);
    await seedDoc("doc-3", USER_A);
    await db.insert(caseDocument).values([
      { id: "cd-1", caseId: "case-1", documentId: "doc-1", position: 1 },
      { id: "cd-2", caseId: "case-1", documentId: "doc-2", position: 2 },
      { id: "cd-3", caseId: "case-1", documentId: "doc-3", position: 3 },
    ]);
  }

  it("up swaps with previous row atomically", async () => {
    await seedThree();
    const res = await reorderCaseDocumentsAction({
      caseId: "case-1",
      caseDocumentId: "cd-2",
      direction: "up",
    });
    expect(res.ok).toBe(true);
    const rows = await db
      .select()
      .from(caseDocument)
      .where(drizzleEq(caseDocument.caseId, "case-1"))
      .orderBy(drizzleAsc(caseDocument.position));
    expect(rows.map((r: { id: string }) => r.id)).toEqual([
      "cd-2",
      "cd-1",
      "cd-3",
    ]);
    expect(rows.map((r: { position: number }) => r.position)).toEqual([1, 2, 3]);
  });

  it("down swaps with next row atomically", async () => {
    await seedThree();
    const res = await reorderCaseDocumentsAction({
      caseId: "case-1",
      caseDocumentId: "cd-2",
      direction: "down",
    });
    expect(res.ok).toBe(true);
    const rows = await db
      .select()
      .from(caseDocument)
      .where(drizzleEq(caseDocument.caseId, "case-1"))
      .orderBy(drizzleAsc(caseDocument.position));
    expect(rows.map((r: { id: string }) => r.id)).toEqual([
      "cd-1",
      "cd-3",
      "cd-2",
    ]);
  });

  it("at edge is a no-op (first row 'up')", async () => {
    await seedThree();
    const res = await reorderCaseDocumentsAction({
      caseId: "case-1",
      caseDocumentId: "cd-1",
      direction: "up",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("narrow");
    expect(res.data.noop).toBe(true);
    const rows = await db
      .select()
      .from(caseDocument)
      .where(drizzleEq(caseDocument.caseId, "case-1"))
      .orderBy(drizzleAsc(caseDocument.position));
    expect(rows.map((r: { id: string }) => r.id)).toEqual([
      "cd-1",
      "cd-2",
      "cd-3",
    ]);
  });
});
