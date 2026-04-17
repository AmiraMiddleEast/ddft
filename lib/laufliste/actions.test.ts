// @vitest-environment node
//
// Integration tests for lib/laufliste/actions.ts (Phase 4 Plan 04 Task 2).
//
// Pattern mirrors lib/cases/actions.test.ts:
//   - Fresh isolated SQLite file via createTestDb()
//   - DATABASE_URL + BETTER_AUTH_* env before dynamic imports
//   - Mock next/headers, next/cache, @/lib/auth
//   - Mock the PDF renderer + disk writer so unit tests stay fast;
//     the real renderer is covered by render.test.ts
//
// Covers:
//   - D-17 blockers (EMPTY_CASE, UNREVIEWED_DOCS) enforced BEFORE render
//   - D-18 re-resolve per document (indirect — via buildLauflisteInput)
//   - D-20 ownership (NOT_FOUND for wrong owner)
//   - LAFL-01, LAFL-02 (persist row + file), CASE-03 (per-case PDF)

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

// PDF renderer + disk writer are mocked per-module so every action test
// runs in <100ms without touching @react-pdf/renderer or the filesystem.
vi.mock("./pdf/render", () => ({
  renderLaufliste: vi.fn(async () => Buffer.from("%PDF-FAKE\n")),
}));
vi.mock("./storage", () => ({
  writeLauflisteToDisk: vi.fn(async (caseId: string) => {
    // Deterministic fake path so tests can assert equality.
    return `data/lauflisten/${caseId}-fake.pdf`;
  }),
  LAUFLISTEN_DIR: "data/lauflisten",
}));

/* eslint-disable @typescript-eslint/no-explicit-any */
let db: any;
let user: any;
let document: any;
let documentReview: any;
let caseTable: any;
let caseDocument: any;
let laufliste: any;
let behoerdenState: any;
let behoerdenDocumentType: any;
let behoerdenAuthority: any;
let generateLauflisteAction: any;
let listLauflistenForCase: any;
let getLauflisteForDownload: any;
let authMod: any;
let renderMod: any;
let storageMod: any;
let drizzleEq: any;
let drizzleDesc: any;
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
  ({
    user,
    document,
    documentReview,
    caseTable,
    caseDocument,
    laufliste,
    behoerdenState,
    behoerdenDocumentType,
    behoerdenAuthority,
  } = await import("@/db/schema"));
  ({ generateLauflisteAction } = await import("./actions"));
  ({ listLauflistenForCase, getLauflisteForDownload } = await import(
    "./queries"
  ));
  authMod = await import("@/lib/auth");
  renderMod = await import("./pdf/render");
  storageMod = await import("./storage");
  ({ eq: drizzleEq, desc: drizzleDesc } = await import("drizzle-orm"));
});

afterAll(() => {
  dbCleanup?.();
});

const GEBURTSURKUNDE_FIELDS = {
  dokumenten_typ: "Geburtsurkunde",
  ausstellende_behoerde: "Standesamt München",
  ausstellungsort: "München",
  bundesland: "Bayern",
  ausstellungsdatum: "1985-04-15",
  voller_name: "Dr. Müller Özgür Weiß",
};

async function seedBehoerden() {
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
    officeHours: null,
    notes: null,
    specialRules: null,
    needsReview: false,
  });
}

async function seedDoc(
  id: string,
  userId: string,
  opts: { reviewStatus?: "approved" | "pending" } = {},
) {
  const reviewStatus = opts.reviewStatus ?? "approved";
  await db.insert(document).values({
    id,
    userId,
    filename: `${id}.pdf`,
    size: 4,
    sha256: `sha-${id}`,
    storagePath: `data/uploads/${id}.pdf`,
    extractionStatus: "done",
    reviewStatus,
  });
  await db.insert(documentReview).values({
    id: `rev-${id}`,
    documentId: id,
    approvedByUserId: userId,
    correctedFields: GEBURTSURKUNDE_FIELDS,
    resolvedAuthorityId: null,
    lookupStatus: "matched",
  });
}

async function seedCase(caseId: string, userId: string, personName: string) {
  await db.insert(caseTable).values({
    id: caseId,
    userId,
    personName,
    status: "open",
  });
}

async function attachDoc(
  id: string,
  caseId: string,
  documentId: string,
  position: number,
) {
  await db.insert(caseDocument).values({
    id,
    caseId,
    documentId,
    position,
  });
}

beforeEach(async () => {
  await db.delete(laufliste);
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

  authMod.auth.api.getSession.mockResolvedValue({
    user: { id: USER_A, email: "a@x.de" },
    session: { id: "sess-a" },
  });
  // Reset mocked-module implementations to their defaults.
  renderMod.renderLaufliste.mockReset();
  renderMod.renderLaufliste.mockImplementation(async () =>
    Buffer.from("%PDF-FAKE\n"),
  );
  storageMod.writeLauflisteToDisk.mockReset();
  storageMod.writeLauflisteToDisk.mockImplementation(
    async (caseId: string) => `data/lauflisten/${caseId}-fake.pdf`,
  );
});

// -----------------------------------------------------------------------
// generateLauflisteAction
// -----------------------------------------------------------------------

describe("generateLauflisteAction — authorization + preconditions", () => {
  it("returns UNAUTHORIZED without session", async () => {
    authMod.auth.api.getSession.mockResolvedValueOnce(null);
    const res = await generateLauflisteAction("case-x");
    expect(res).toEqual({ ok: false, error: "UNAUTHORIZED" });
  });

  it("returns NOT_FOUND for non-existent caseId", async () => {
    const res = await generateLauflisteAction("does-not-exist");
    expect(res).toEqual({ ok: false, error: "NOT_FOUND" });
  });

  it("returns NOT_FOUND for wrong-owner caseId", async () => {
    await seedCase("case-b", USER_B, "Bob");
    const res = await generateLauflisteAction("case-b");
    expect(res).toEqual({ ok: false, error: "NOT_FOUND" });
  });

  it("returns EMPTY_CASE when case has zero documents", async () => {
    await seedCase("case-1", USER_A, "Alice");
    const res = await generateLauflisteAction("case-1");
    expect(res).toEqual({ ok: false, error: "EMPTY_CASE" });
    // No laufliste row persisted, no renderer invocation.
    expect(renderMod.renderLaufliste).not.toHaveBeenCalled();
    const rows = await db.select().from(laufliste);
    expect(rows.length).toBe(0);
  });

  it("returns UNREVIEWED_DOCS when any document has review_status='pending'", async () => {
    await seedBehoerden();
    await seedCase("case-1", USER_A, "Alice");
    await seedDoc("doc-ok", USER_A, { reviewStatus: "approved" });
    await seedDoc("doc-pending", USER_A, { reviewStatus: "pending" });
    await attachDoc("cd-1", "case-1", "doc-ok", 1);
    await attachDoc("cd-2", "case-1", "doc-pending", 2);

    const res = await generateLauflisteAction("case-1");
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("narrow");
    expect(res.error).toBe("UNREVIEWED_DOCS");
    expect(renderMod.renderLaufliste).not.toHaveBeenCalled();
    const rows = await db.select().from(laufliste);
    expect(rows.length).toBe(0);
  });
});

describe("generateLauflisteAction — happy path", () => {
  it("renders PDF, writes file, inserts laufliste row, sets case.status='pdf_generated'", async () => {
    await seedBehoerden();
    await seedCase("case-1", USER_A, "Alice");
    await seedDoc("doc-1", USER_A);
    await attachDoc("cd-1", "case-1", "doc-1", 1);

    const res = await generateLauflisteAction("case-1");
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("narrow");
    expect(res.data.lauflisteId).toBeTruthy();

    expect(renderMod.renderLaufliste).toHaveBeenCalledTimes(1);
    expect(storageMod.writeLauflisteToDisk).toHaveBeenCalledTimes(1);

    const rows = await db.select().from(laufliste);
    expect(rows.length).toBe(1);
    expect(rows[0].caseId).toBe("case-1");
    expect(rows[0].userId).toBe(USER_A);
    expect(rows[0].documentCount).toBe(1);
    expect(rows[0].fileSize).toBeGreaterThan(0);
    expect(rows[0].pdfStoragePath).toMatch(/^data\/lauflisten\/case-1/);

    const caseRows = await db
      .select()
      .from(caseTable)
      .where(drizzleEq(caseTable.id, "case-1"));
    expect(caseRows[0].status).toBe("pdf_generated");
  });

  it("regenerating creates a NEW laufliste row (D-14 immutability)", async () => {
    await seedBehoerden();
    await seedCase("case-1", USER_A, "Alice");
    await seedDoc("doc-1", USER_A);
    await attachDoc("cd-1", "case-1", "doc-1", 1);

    const r1 = await generateLauflisteAction("case-1");
    expect(r1.ok).toBe(true);
    const r2 = await generateLauflisteAction("case-1");
    expect(r2.ok).toBe(true);

    const rows = await db.select().from(laufliste);
    expect(rows.length).toBe(2);
    if (!r1.ok || !r2.ok) throw new Error("narrow");
    expect(r1.data.lauflisteId).not.toBe(r2.data.lauflisteId);
  });
});

describe("generateLauflisteAction — render failure", () => {
  it("returns RENDER_FAILED and does NOT persist any row or case-status change", async () => {
    renderMod.renderLaufliste.mockImplementationOnce(async () => {
      throw new Error("boom");
    });
    await seedBehoerden();
    await seedCase("case-1", USER_A, "Alice");
    await seedDoc("doc-1", USER_A);
    await attachDoc("cd-1", "case-1", "doc-1", 1);

    const res = await generateLauflisteAction("case-1");
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("narrow");
    expect(res.error).toBe("RENDER_FAILED");

    const rows = await db.select().from(laufliste);
    expect(rows.length).toBe(0);
    // Disk writer never reached because render threw first.
    expect(storageMod.writeLauflisteToDisk).not.toHaveBeenCalled();

    const caseRows = await db
      .select()
      .from(caseTable)
      .where(drizzleEq(caseTable.id, "case-1"));
    expect(caseRows[0].status).toBe("open");
  });
});

// -----------------------------------------------------------------------
// listLauflistenForCase + getLauflisteForDownload
// -----------------------------------------------------------------------

describe("listLauflistenForCase", () => {
  it("returns rows ordered by generated_at DESC scoped to owner", async () => {
    await seedCase("case-1", USER_A, "Alice");
    await db.insert(laufliste).values([
      {
        id: "lf-old",
        caseId: "case-1",
        userId: USER_A,
        pdfStoragePath: "data/lauflisten/a.pdf",
        generatedAt: new Date("2026-01-01T00:00:00Z"),
        documentCount: 1,
        fileSize: 100,
      },
      {
        id: "lf-new",
        caseId: "case-1",
        userId: USER_A,
        pdfStoragePath: "data/lauflisten/b.pdf",
        generatedAt: new Date("2026-02-01T00:00:00Z"),
        documentCount: 1,
        fileSize: 200,
      },
    ]);

    const rows = await listLauflistenForCase("case-1", USER_A, db);
    expect(rows.map((r: { id: string }) => r.id)).toEqual(["lf-new", "lf-old"]);
  });

  it("returns empty array for wrong-owner case (no leak)", async () => {
    await seedCase("case-b", USER_B, "Bob");
    await db.insert(laufliste).values({
      id: "lf-1",
      caseId: "case-b",
      userId: USER_B,
      pdfStoragePath: "data/lauflisten/b.pdf",
      generatedAt: new Date(),
      documentCount: 1,
      fileSize: 1,
    });
    const rows = await listLauflistenForCase("case-b", USER_A, db);
    expect(rows).toEqual([]);
  });
});

describe("getLauflisteForDownload", () => {
  it("returns download descriptor for owner match", async () => {
    await seedCase("case-1", USER_A, "Dr. Müller Özgür");
    await db.insert(laufliste).values({
      id: "lf-1",
      caseId: "case-1",
      userId: USER_A,
      pdfStoragePath: "data/lauflisten/case-1-1.pdf",
      generatedAt: new Date("2026-04-17T10:00:00Z"),
      documentCount: 1,
      fileSize: 1,
    });

    const row = await getLauflisteForDownload("case-1", "lf-1", USER_A, db);
    expect(row).not.toBeNull();
    expect(row?.pdfStoragePath).toBe("data/lauflisten/case-1-1.pdf");
    expect(row?.personName).toBe("Dr. Müller Özgür");
    // slugifyPersonName: "dr-mueller-oezguer"
    expect(row?.personSlug).toBe("dr-mueller-oezguer");
    expect(row?.generatedDate).toBe("2026-04-17");
  });

  it("returns null for cross-owner lookup", async () => {
    await seedCase("case-b", USER_B, "Bob");
    await db.insert(laufliste).values({
      id: "lf-1",
      caseId: "case-b",
      userId: USER_B,
      pdfStoragePath: "data/lauflisten/case-b-1.pdf",
      generatedAt: new Date(),
      documentCount: 1,
      fileSize: 1,
    });
    const row = await getLauflisteForDownload("case-b", "lf-1", USER_A, db);
    expect(row).toBeNull();
  });

  it("returns null for cross-case lauflisteId mismatch", async () => {
    await seedCase("case-1", USER_A, "Alice");
    await seedCase("case-2", USER_A, "Bob");
    await db.insert(laufliste).values({
      id: "lf-1",
      caseId: "case-1",
      userId: USER_A,
      pdfStoragePath: "x.pdf",
      generatedAt: new Date(),
      documentCount: 1,
      fileSize: 1,
    });
    // Look it up via case-2 (wrong case) — must return null even though the
    // caller owns both cases. Prevents ID-swap leaks (T-04-15).
    const row = await getLauflisteForDownload("case-2", "lf-1", USER_A, db);
    expect(row).toBeNull();
    // And drizzleDesc is imported (silence unused-var).
    expect(drizzleDesc).toBeTruthy();
  });
});
