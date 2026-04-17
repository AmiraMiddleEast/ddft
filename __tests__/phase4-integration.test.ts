// @vitest-environment node
/**
 * Phase 4 exit-gate integration suite.
 *
 * Exercises the full pipeline end-to-end against a real SQLite DB + real
 * filesystem writes, with ONLY the React-PDF renderer mocked (keeps the
 * suite fast and avoids a 1-3s real render cost on every assertion):
 *
 *   1. createCaseAction           → case row with user_id = session user
 *   2. addDocumentsToCaseAction   → case_document row
 *   3. generateLauflisteAction    → laufliste row + file on disk
 *   4. GET download Route Handler → 200 + RFC 5987 headers + byte stream
 *   5. Ownership guard            → user-B calling user-A's download → 404
 *
 * Mocking strategy mirrors phase2-integration.test.ts + phase3-integration
 * test.ts (vi.doMock in the fresh module graph, lazy dynamic imports).
 *
 * Implements the plan's "tests/integration/phase-04-laufliste.test.ts" task
 * at the project's real test path (__tests__/ per vitest.config.ts include).
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
import fs from "node:fs";
import fsp from "node:fs/promises";
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
let documentReview: any;
let caseTable: any;
let caseDocument: any;
let laufliste: any;
let behoerdenState: any;
let behoerdenDocumentType: any;
let behoerdenAuthority: any;
let createCaseAction: any;
let addDocumentsToCaseAction: any;
let generateLauflisteAction: any;
let downloadGET: any;
let renderMod: any;
let drizzleEq: any;
/* eslint-enable @typescript-eslint/no-explicit-any */

let dbCleanup: () => void;
const createdLauflistenPaths = new Set<string>();

const USER_A = "u-a";
const USER_B = "u-b";
const DOC_ID = "doc-1";

const FAKE_PDF_BYTES = Buffer.from(
  "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>%%EOF\n",
);

beforeAll(async () => {
  const testDb = createTestDb();
  dbCleanup = testDb.cleanup;
  process.env.DATABASE_URL = testDb.dbFile;
  process.env.BETTER_AUTH_SECRET = "x".repeat(32);
  process.env.BETTER_AUTH_URL = "http://localhost:3000";

  vi.resetModules();

  // Mock just the React-PDF renderer — keep real buildLauflisteInput,
  // real disk storage, real queries. Deviation rationale: the renderer is
  // covered by render.test.ts; the rest of the pipeline is what this
  // integration suite gates.
  vi.doMock("@/lib/laufliste/pdf/render", () => ({
    renderLaufliste: vi.fn(async () => FAKE_PDF_BYTES),
  }));

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
  ({ createCaseAction, addDocumentsToCaseAction } = await import(
    "@/lib/cases/actions"
  ));
  ({ generateLauflisteAction } = await import("@/lib/laufliste/actions"));
  ({ GET: downloadGET } = await import(
    "@/app/api/cases/[id]/laufliste/[lauflisteId]/download/route"
  ));
  renderMod = await import("@/lib/laufliste/pdf/render");
  ({ eq: drizzleEq } = await import("drizzle-orm"));
});

afterAll(async () => {
  for (const p of createdLauflistenPaths) {
    try {
      await fsp.rm(p, { force: true });
    } catch {
      // ignore
    }
  }
  dbCleanup?.();
});

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
    { id: USER_A, name: "Alice", email: "a@x.de", emailVerified: true },
    { id: USER_B, name: "Bob", email: "b@x.de", emailVerified: true },
  ]);

  // Minimal Behörden reference data for resolveAuthority.
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
    name: "Standesamt München",
    address: "Ruppertstraße 11\n80466 München",
    phone: "+49 89 233-0",
    email: null,
    website: null,
    officeHours: null,
    notes: null,
    specialRules: null,
    needsReview: false,
  });

  // Seed one approved document for user-A.
  await db.insert(document).values({
    id: DOC_ID,
    userId: USER_A,
    filename: "geburtsurkunde.pdf",
    size: 1024,
    sha256: "phase4int-sha",
    storagePath: `data/uploads/${DOC_ID}.pdf`,
    extractionStatus: "done",
    reviewStatus: "approved",
    reviewedAt: new Date(),
  });
  await db.insert(documentReview).values({
    id: `rev-${DOC_ID}`,
    documentId: DOC_ID,
    approvedByUserId: USER_A,
    correctedFields: {
      dokumenten_typ: "Geburtsurkunde",
      ausstellende_behoerde: "Standesamt München",
      ausstellungsort: "München",
      bundesland: "Bayern",
      ausstellungsdatum: "1985-04-15",
      voller_name: "Dr. Müller Özgür Weiß",
    },
    resolvedAuthorityId: "auth-muc",
    lookupStatus: "matched",
  });

  sessionHolder.current = {
    user: { id: USER_A, email: "a@x.de" },
    session: { id: "s-a" },
  };
  renderMod.renderLaufliste.mockClear();
  renderMod.renderLaufliste.mockImplementation(async () => FAKE_PDF_BYTES);
});

describe("Phase 4 — integration", () => {
  it(
    "create → add → generate → download returns 200 with correct PDF + RFC 5987 headers",
    async () => {
      // 1. createCaseAction
      const create = await createCaseAction({
        personName: "Dr. Müller Özgür Weiß",
      });
      expect(create.ok).toBe(true);
      if (!create.ok) throw new Error("narrow");
      const caseId = create.data.caseId;
      expect(caseId).toBeTruthy();

      const caseRows = await db
        .select()
        .from(caseTable)
        .where(drizzleEq(caseTable.id, caseId));
      expect(caseRows.length).toBe(1);
      expect(caseRows[0].userId).toBe(USER_A);
      expect(caseRows[0].personName).toBe("Dr. Müller Özgür Weiß");
      expect(caseRows[0].status).toBe("open");

      // 2. addDocumentsToCaseAction
      const add = await addDocumentsToCaseAction({
        caseId,
        documentIds: [DOC_ID],
      });
      expect(add.ok).toBe(true);
      if (!add.ok) throw new Error("narrow");
      expect(add.data.inserted).toBe(1);

      const cdRows = await db
        .select()
        .from(caseDocument)
        .where(drizzleEq(caseDocument.caseId, caseId));
      expect(cdRows.length).toBe(1);

      // 3. generateLauflisteAction
      const gen = await generateLauflisteAction(caseId);
      expect(gen.ok).toBe(true);
      if (!gen.ok) throw new Error("narrow");
      const lauflisteId = gen.data.lauflisteId;

      expect(renderMod.renderLaufliste).toHaveBeenCalledTimes(1);

      const lfRows = await db
        .select()
        .from(laufliste)
        .where(drizzleEq(laufliste.id, lauflisteId));
      expect(lfRows.length).toBe(1);
      const lfRow = lfRows[0];
      expect(lfRow.caseId).toBe(caseId);
      expect(lfRow.documentCount).toBe(1);
      expect(lfRow.fileSize).toBe(FAKE_PDF_BYTES.byteLength);

      // File actually exists on disk.
      const absPath = path.isAbsolute(lfRow.pdfStoragePath)
        ? lfRow.pdfStoragePath
        : path.resolve(process.cwd(), lfRow.pdfStoragePath);
      expect(fs.existsSync(absPath)).toBe(true);
      createdLauflistenPaths.add(absPath);

      const diskBytes = await fsp.readFile(absPath);
      expect(diskBytes.subarray(0, 5).toString("utf8")).toBe("%PDF-");

      // Case status flipped to pdf_generated.
      const caseAfter = await db
        .select()
        .from(caseTable)
        .where(drizzleEq(caseTable.id, caseId));
      expect(caseAfter[0].status).toBe("pdf_generated");

      // 4. Download Route Handler
      const res = await downloadGET(
        new Request(
          `http://localhost/api/cases/${caseId}/laufliste/${lauflisteId}/download`,
        ),
        { params: Promise.resolve({ id: caseId, lauflisteId }) },
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("application/pdf");
      const cd = res.headers.get("content-disposition") ?? "";
      // Slug applied: "dr-mueller-oezguer-weiss"
      expect(cd).toContain("Laufliste-dr-mueller-oezguer-weiss-");
      expect(cd).toContain("filename*=UTF-8''");
      // UTF-8 variant keeps the German letters percent-encoded.
      expect(cd).toContain("%C3%BC"); // ü
      expect(cd).toContain("%C3%9F"); // ß

      const body = Buffer.from(await res.arrayBuffer());
      expect(body.subarray(0, 5).toString("utf8")).toBe("%PDF-");
      expect(body.byteLength).toBe(FAKE_PDF_BYTES.byteLength);
    },
    30_000,
  );

  it(
    "cross-user download is blocked — user-B calling user-A's Laufliste returns 404",
    async () => {
      // Seed an owned Laufliste for user-A.
      const create = await createCaseAction({
        personName: "Alice",
      });
      if (!create.ok) throw new Error("narrow");
      const caseId = create.data.caseId;

      const add = await addDocumentsToCaseAction({
        caseId,
        documentIds: [DOC_ID],
      });
      expect(add.ok).toBe(true);

      const gen = await generateLauflisteAction(caseId);
      if (!gen.ok) throw new Error("narrow");
      const lauflisteId = gen.data.lauflisteId;

      const lfRows = await db
        .select()
        .from(laufliste)
        .where(drizzleEq(laufliste.id, lauflisteId));
      const absPath = path.isAbsolute(lfRows[0].pdfStoragePath)
        ? lfRows[0].pdfStoragePath
        : path.resolve(process.cwd(), lfRows[0].pdfStoragePath);
      createdLauflistenPaths.add(absPath);

      // Switch session to user-B and hit the download route.
      sessionHolder.current = {
        user: { id: USER_B, email: "b@x.de" },
        session: { id: "s-b" },
      };
      const res = await downloadGET(
        new Request(
          `http://localhost/api/cases/${caseId}/laufliste/${lauflisteId}/download`,
        ),
        { params: Promise.resolve({ id: caseId, lauflisteId }) },
      );
      // Zero-leak: 404, not 403.
      expect(res.status).toBe(404);
    },
    30_000,
  );

  it(
    "regenerate creates a new laufliste row + file (D-14 immutability)",
    async () => {
      const create = await createCaseAction({ personName: "Erika" });
      if (!create.ok) throw new Error("narrow");
      const caseId = create.data.caseId;

      await addDocumentsToCaseAction({ caseId, documentIds: [DOC_ID] });

      const r1 = await generateLauflisteAction(caseId);
      const r2 = await generateLauflisteAction(caseId);
      expect(r1.ok).toBe(true);
      expect(r2.ok).toBe(true);
      if (!r1.ok || !r2.ok) throw new Error("narrow");
      expect(r1.data.lauflisteId).not.toBe(r2.data.lauflisteId);

      const lfs = await db
        .select()
        .from(laufliste)
        .where(drizzleEq(laufliste.caseId, caseId));
      expect(lfs.length).toBe(2);
      // Both files exist on disk.
      for (const lf of lfs) {
        const absPath = path.isAbsolute(lf.pdfStoragePath)
          ? lf.pdfStoragePath
          : path.resolve(process.cwd(), lf.pdfStoragePath);
        expect(fs.existsSync(absPath)).toBe(true);
        createdLauflistenPaths.add(absPath);
      }
    },
    30_000,
  );
});
