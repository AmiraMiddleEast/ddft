// @vitest-environment node
//
// Integration tests for lib/cases/queries.ts.
//
// Strategy mirrors lib/review/actions.test.ts:
//   - Fresh isolated SQLite DB via createTestDb()
//   - Set DATABASE_URL before dynamically importing @/db/client
//   - Seed two users so ownership scoping can be asserted per-row
//
// Queries accept `(..., db)` as a dependency-injected handle so tests can use
// the same db module instance. This matches the Phase 3 resolver precedent.
//
// Covers Plan 04-02 Task 1 done criteria (Must-Have #6 — ownership predicate
// on every query, D-04 — assignable filter).

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { createTestDb } from "../../__tests__/_fixtures/test-db";

// `server-only` is a Next.js marker package with no Node runtime resolution.
vi.mock("server-only", () => ({}));

/* eslint-disable @typescript-eslint/no-explicit-any */
let db: any;
let user: any;
let document: any;
let documentReview: any;
let caseTable: any;
let caseDocument: any;
let listCasesForUser: any;
let getCaseForUser: any;
let listCaseDocuments: any;
let listAssignableDocuments: any;
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
  ({ user, document, documentReview, caseTable, caseDocument } = await import(
    "@/db/schema"
  ));
  ({
    listCasesForUser,
    getCaseForUser,
    listCaseDocuments,
    listAssignableDocuments,
  } = await import("./queries"));
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
  await db.delete(user);

  await db.insert(user).values([
    { id: USER_A, name: "A", email: "a@x.de", emailVerified: true },
    { id: USER_B, name: "B", email: "b@x.de", emailVerified: true },
  ]);
});

async function seedDocument(
  id: string,
  userId: string,
  opts: { extractionStatus?: string; reviewStatus?: string } = {},
) {
  await db.insert(document).values({
    id,
    userId,
    filename: `${id}.pdf`,
    size: 4,
    sha256: `sha-${id}`,
    storagePath: `data/uploads/${id}.pdf`,
    extractionStatus: opts.extractionStatus ?? "done",
    reviewStatus: opts.reviewStatus ?? "approved",
  });
  if (opts.reviewStatus !== "pending") {
    // A document is "approved" for assignable purposes only when a documentReview row exists.
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

async function seedCase(
  id: string,
  userId: string,
  personName: string,
  updatedAt?: Date,
) {
  const now = updatedAt ?? new Date();
  await db.insert(caseTable).values({
    id,
    userId,
    personName,
    status: "open",
    createdAt: now,
    updatedAt: now,
  });
}

describe("listCasesForUser", () => {
  it("returns only caller's cases in updated_at DESC order", async () => {
    await seedCase("case-1", USER_A, "Alice", new Date("2026-01-01T00:00:00Z"));
    await seedCase("case-2", USER_A, "Alice2", new Date("2026-02-01T00:00:00Z"));
    await seedCase("case-3", USER_B, "Bob", new Date("2026-03-01T00:00:00Z"));

    const rows = await listCasesForUser(USER_A, db);
    expect(rows.map((r: { id: string }) => r.id)).toEqual(["case-2", "case-1"]);
  });

  it("returns empty array when the user has no cases", async () => {
    const rows = await listCasesForUser(USER_A, db);
    expect(rows).toEqual([]);
  });
});

describe("getCaseForUser", () => {
  it("returns the case row when owner matches", async () => {
    await seedCase("case-1", USER_A, "Alice");
    const row = await getCaseForUser("case-1", USER_A, db);
    expect(row?.id).toBe("case-1");
    expect(row?.personName).toBe("Alice");
  });

  it("returns null for wrong owner (no leak)", async () => {
    await seedCase("case-1", USER_B, "Bob");
    const row = await getCaseForUser("case-1", USER_A, db);
    expect(row).toBeNull();
  });

  it("returns null for non-existent case", async () => {
    const row = await getCaseForUser("does-not-exist", USER_A, db);
    expect(row).toBeNull();
  });
});

describe("listCaseDocuments", () => {
  it("returns joined rows ordered by position ASC when caller owns case", async () => {
    await seedCase("case-1", USER_A, "Alice");
    await seedDocument("doc-1", USER_A);
    await seedDocument("doc-2", USER_A);

    await db.insert(caseDocument).values([
      { id: "cd-1", caseId: "case-1", documentId: "doc-1", position: 2 },
      { id: "cd-2", caseId: "case-1", documentId: "doc-2", position: 1 },
    ]);

    const rows = await listCaseDocuments("case-1", USER_A, db);
    expect(rows.map((r: { caseDocumentId: string }) => r.caseDocumentId)).toEqual([
      "cd-2",
      "cd-1",
    ]);
    expect(rows[0].position).toBe(1);
    expect(rows[0].documentId).toBe("doc-2");
    // Document metadata should be present on the joined row.
    expect(rows[0].filename).toBeDefined();
  });

  it("returns empty array for wrong owner (no leak)", async () => {
    await seedCase("case-1", USER_B, "Bob");
    await seedDocument("doc-1", USER_B);
    await db.insert(caseDocument).values({
      id: "cd-1",
      caseId: "case-1",
      documentId: "doc-1",
      position: 1,
    });

    const rows = await listCaseDocuments("case-1", USER_A, db);
    expect(rows).toEqual([]);
  });
});

describe("listAssignableDocuments", () => {
  it("filters out documents already assigned to a case", async () => {
    await seedCase("case-1", USER_A, "Alice");
    await seedDocument("doc-free", USER_A);
    await seedDocument("doc-assigned", USER_A);
    await db.insert(caseDocument).values({
      id: "cd-1",
      caseId: "case-1",
      documentId: "doc-assigned",
      position: 1,
    });

    const rows = await listAssignableDocuments(USER_A, db);
    const ids = rows.map((r: { id: string }) => r.id);
    expect(ids).toContain("doc-free");
    expect(ids).not.toContain("doc-assigned");
  });

  it("filters out unapproved and unextracted documents + other users' docs", async () => {
    // Approved + extracted (included)
    await seedDocument("doc-ok", USER_A);
    // Unapproved (excluded)
    await seedDocument("doc-unreviewed", USER_A, { reviewStatus: "pending" });
    // Not extracted (excluded)
    await seedDocument("doc-extracting", USER_A, {
      extractionStatus: "extracting",
      reviewStatus: "pending",
    });
    // Owned by another user (excluded)
    await seedDocument("doc-other", USER_B);

    const rows = await listAssignableDocuments(USER_A, db);
    const ids = rows.map((r: { id: string }) => r.id);
    expect(ids).toEqual(["doc-ok"]);
  });
});
