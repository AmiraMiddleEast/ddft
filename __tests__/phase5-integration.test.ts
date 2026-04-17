// @vitest-environment node
/**
 * Phase 5 exit-gate integration suite.
 *
 * Covers the three sub-features end-to-end:
 *   1. History — listLauflistenHistoryForUser with search + date-range
 *   2. Re-upload — replaceDocumentPdfAction versioning
 *   3. Admin — updateAuthorityAction persisting contact fields
 *   4. Auth — updateAuthorityAction rejects unauthenticated callers
 *
 * Mocking strategy: real SQLite DB via createTestDb + mocked session via
 * sessionHolder (same pattern as phase3/phase4 integration suites). No
 * Claude calls happen — re-upload does NOT re-extract, and the only
 * extraction-adjacent code paths are guarded by mocks.
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
import fsp from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import { createTestDb } from "./_fixtures/test-db";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

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

/* eslint-disable @typescript-eslint/no-explicit-any */
let db: any;
let user: any;
let document: any;
let documentVersion: any;
let caseTable: any;
let laufliste: any;
let behoerdenState: any;
let behoerdenDocumentType: any;
let behoerdenAuthority: any;
let listLauflistenHistoryForUser: any;
let replaceDocumentPdfAction: any;
let updateAuthorityAction: any;
let drizzleEq: any;
/* eslint-enable @typescript-eslint/no-explicit-any */

let dbCleanup: () => void;
const createdFiles = new Set<string>();

const USER_A = "p5-u-a";
const USER_B = "p5-u-b";
const DOC_ID = "p5-doc-1";
const AUTH_ID = "p5-auth-1";

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
    documentVersion,
    caseTable,
    laufliste,
    behoerdenState,
    behoerdenDocumentType,
    behoerdenAuthority,
  } = await import("@/db/schema"));
  ({ listLauflistenHistoryForUser } = await import("@/lib/history/queries"));
  ({ replaceDocumentPdfAction } = await import("@/lib/uploads/replace"));
  ({ updateAuthorityAction } = await import("@/lib/admin/actions"));
  ({ eq: drizzleEq } = await import("drizzle-orm"));
});

afterAll(async () => {
  for (const f of createdFiles) {
    try {
      await fsp.rm(f, { force: true });
    } catch {
      // ignore
    }
  }
  dbCleanup?.();
});

beforeEach(async () => {
  await db.delete(laufliste);
  await db.delete(caseTable);
  await db.delete(documentVersion);
  await db.delete(document);
  await db.delete(behoerdenAuthority);
  await db.delete(behoerdenDocumentType);
  await db.delete(behoerdenState);
  await db.delete(user);

  await db.insert(user).values([
    { id: USER_A, name: "Alice", email: "p5a@x.de", emailVerified: true },
    { id: USER_B, name: "Bob", email: "p5b@x.de", emailVerified: true },
  ]);

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
    id: AUTH_ID,
    stateId: "bayern",
    documentTypeId: "geburtsurkunde",
    regierungsbezirkId: null,
    name: "Standesamt München",
    address: "Ruppertstr. 11\n80466 München",
    phone: null,
    email: null,
    website: null,
    officeHours: null,
    notes: null,
    specialRules: null,
    needsReview: false,
  });

  sessionHolder.current = {
    user: { id: USER_A, email: "p5a@x.de" },
    session: { id: "s1" },
  };
});

describe("Phase 5 — integration", () => {
  it("history: search + date-range filter returns the expected rows for the session user", async () => {
    // Seed three cases + three Lauflisten for USER_A and one for USER_B (decoy).
    await db.insert(caseTable).values([
      {
        id: "c-1",
        userId: USER_A,
        personName: "Dr. Müller Özgür",
        status: "pdf_generated",
      },
      {
        id: "c-2",
        userId: USER_A,
        personName: "Max Mustermann",
        status: "pdf_generated",
      },
      {
        id: "c-3",
        userId: USER_A,
        personName: "Erika Schmidt",
        status: "pdf_generated",
      },
      {
        id: "c-b",
        userId: USER_B,
        personName: "Bob's Person",
        status: "pdf_generated",
      },
    ]);
    await db.insert(laufliste).values([
      {
        id: "l-1",
        caseId: "c-1",
        userId: USER_A,
        pdfStoragePath: "data/laufliste/l-1.pdf",
        generatedAt: new Date("2026-01-10T10:00:00Z"),
        documentCount: 2,
        fileSize: 12000,
      },
      {
        id: "l-2",
        caseId: "c-2",
        userId: USER_A,
        pdfStoragePath: "data/laufliste/l-2.pdf",
        generatedAt: new Date("2026-03-05T10:00:00Z"),
        documentCount: 3,
        fileSize: 15000,
      },
      {
        id: "l-3",
        caseId: "c-3",
        userId: USER_A,
        pdfStoragePath: "data/laufliste/l-3.pdf",
        generatedAt: new Date("2026-03-20T10:00:00Z"),
        documentCount: 1,
        fileSize: 8000,
      },
      {
        id: "l-b",
        caseId: "c-b",
        userId: USER_B,
        pdfStoragePath: "data/laufliste/l-b.pdf",
        generatedAt: new Date("2026-03-10T10:00:00Z"),
        documentCount: 1,
        fileSize: 5000,
      },
    ]);

    // Search by partial, case-insensitive name.
    const searched = await listLauflistenHistoryForUser(USER_A, {
      search: "MUSTER",
    });
    expect(searched.totalCount).toBe(1);
    expect(searched.items[0].lauflisteId).toBe("l-2");

    // Date range — March only.
    const windowed = await listLauflistenHistoryForUser(USER_A, {
      dateFrom: new Date("2026-03-01T00:00:00Z"),
      dateTo: new Date("2026-03-31T23:59:59Z"),
    });
    expect(windowed.totalCount).toBe(2);
    // Newest first.
    expect(windowed.items.map((i: { lauflisteId: string }) => i.lauflisteId)).toEqual([
      "l-3",
      "l-2",
    ]);

    // User B isolation — must not see Alice's rows.
    const forB = await listLauflistenHistoryForUser(USER_B);
    expect(forB.totalCount).toBe(1);
    expect(forB.items[0].caseId).toBe("c-b");
  });

  it("re-upload: replaceDocumentPdfAction bumps version and archives prior version", async () => {
    await db.insert(document).values({
      id: DOC_ID,
      userId: USER_A,
      filename: "original.pdf",
      size: 100,
      sha256: "originalhashxx",
      mime: "application/pdf",
      storagePath: `data/uploads/${DOC_ID}.pdf`,
      extractionStatus: "done",
      reviewStatus: "approved",
      version: 1,
    });

    const bytes = await fsp.readFile(
      path.resolve(process.cwd(), "transcript.pdf"),
    );
    const fd = new FormData();
    fd.append(
      "file",
      new File([bytes], "better-scan.pdf", { type: "application/pdf" }),
    );

    const res = await replaceDocumentPdfAction(DOC_ID, fd);
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("narrow");
    expect(res.newVersion).toBe(2);

    const absFile = path.resolve(process.cwd(), res.storagePath);
    createdFiles.add(absFile);
    expect(fs.existsSync(absFile)).toBe(true);

    const [doc] = await db
      .select()
      .from(document)
      .where(drizzleEq(document.id, DOC_ID));
    expect(doc.version).toBe(2);
    expect(doc.size).toBe(bytes.byteLength);

    const versions = await db.select().from(documentVersion);
    expect(versions.length).toBe(1);
    expect(versions[0].versionNumber).toBe(1);
    expect(versions[0].storagePath).toBe(`data/uploads/${DOC_ID}.pdf`);
    expect(versions[0].sha256).toBe("originalhashxx");
  });

  it("admin: updateAuthorityAction persists contact fields", async () => {
    const res = await updateAuthorityAction(AUTH_ID, {
      name: "Standesamt München",
      address: "Ruppertstr. 11\n80466 München",
      phone: "089 233-96000",
      email: "info@standesamt.muenchen.de",
      website: "https://muenchen.de/standesamt",
      officeHours: "Mo-Fr 8-12",
      notes: "Terminbuchung online.",
      specialRules: null,
      needsReview: false,
    });
    expect(res.ok).toBe(true);

    const [a] = await db
      .select()
      .from(behoerdenAuthority)
      .where(drizzleEq(behoerdenAuthority.id, AUTH_ID));
    expect(a.phone).toBe("089 233-96000");
    expect(a.email).toBe("info@standesamt.muenchen.de");
    expect(a.website).toBe("https://muenchen.de/standesamt");
    expect(a.officeHours).toBe("Mo-Fr 8-12");
    expect(a.notes).toBe("Terminbuchung online.");
  });

  it("admin auth: updateAuthorityAction rejects unauthenticated callers", async () => {
    sessionHolder.current = null;
    const res = await updateAuthorityAction(AUTH_ID, {
      name: "Hacked",
      address: "—",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("UNAUTHORIZED");

    // Verify no side effect.
    const [a] = await db
      .select()
      .from(behoerdenAuthority)
      .where(drizzleEq(behoerdenAuthority.id, AUTH_ID));
    expect(a.name).toBe("Standesamt München");
  });
});
