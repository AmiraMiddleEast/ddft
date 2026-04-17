// @vitest-environment node
import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { createTestDb } from "../../__tests__/_fixtures/test-db";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(async () => ({
        user: { id: "rep-u-a", email: "rep@x.de" },
        session: { id: "s1" },
      })),
    },
  },
}));

/* eslint-disable @typescript-eslint/no-explicit-any */
let db: any;
let document: any;
let documentVersion: any;
let user: any;
let replaceDocumentPdfAction: any;
let auth: any;
/* eslint-enable @typescript-eslint/no-explicit-any */

let dbCleanup: () => void;
const createdFiles = new Set<string>();

const USER_A = "rep-u-a";
const USER_B = "rep-u-b";
const DOC_ID = "rep-doc-1";

beforeAll(async () => {
  const testDb = createTestDb();
  dbCleanup = testDb.cleanup;
  process.env.DATABASE_URL = testDb.dbFile;
  process.env.BETTER_AUTH_SECRET = "x".repeat(32);
  process.env.BETTER_AUTH_URL = "http://localhost:3000";

  vi.resetModules();
  ({ db } = await import("@/db/client"));
  ({ document, documentVersion, user } = await import("@/db/schema"));
  ({ replaceDocumentPdfAction } = await import("./replace"));
  ({ auth } = await import("@/lib/auth"));
});

afterAll(async () => {
  for (const f of createdFiles) {
    try {
      await rm(f, { force: true });
    } catch {
      // ignore
    }
  }
  dbCleanup?.();
});

beforeEach(async () => {
  await db.delete(documentVersion);
  await db.delete(document);
  await db.delete(user);

  await db.insert(user).values([
    { id: USER_A, name: "Alice", email: "rep@x.de", emailVerified: true },
    { id: USER_B, name: "Bob", email: "repb@x.de", emailVerified: true },
  ]);

  await db.insert(document).values({
    id: DOC_ID,
    userId: USER_A,
    filename: "original.pdf",
    size: 42,
    sha256: "originalhash",
    mime: "application/pdf",
    storagePath: `data/uploads/${DOC_ID}.pdf`,
    extractionStatus: "done",
    reviewStatus: "approved",
    version: 1,
  });

  auth.api.getSession.mockResolvedValue({
    user: { id: USER_A, email: "rep@x.de" },
    session: { id: "s1" },
  });
});

async function fd(file: File): Promise<FormData> {
  const f = new FormData();
  f.append("file", file);
  return f;
}

describe("replaceDocumentPdfAction", () => {
  it("happy path: v1 → v2 with old version archived and storagePath updated", async () => {
    const bytes = await readFile(path.resolve(process.cwd(), "transcript.pdf"));
    const res = await replaceDocumentPdfAction(
      DOC_ID,
      await fd(
        new File([bytes], "scan-better.pdf", { type: "application/pdf" }),
      ),
    );
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("narrow");
    expect(res.newVersion).toBe(2);

    const absFile = path.resolve(process.cwd(), res.storagePath);
    createdFiles.add(absFile);

    // Document row updated.
    const [doc] = await db.select().from(document);
    expect(doc.version).toBe(2);
    expect(doc.size).toBe(bytes.byteLength);
    expect(doc.storagePath).toMatch(
      new RegExp(`data/uploads/${DOC_ID}-v2\\.pdf$`),
    );

    // document_version row for v1 present with old values.
    const versions = await db.select().from(documentVersion);
    expect(versions.length).toBe(1);
    expect(versions[0].versionNumber).toBe(1);
    expect(versions[0].storagePath).toBe(`data/uploads/${DOC_ID}.pdf`);
    expect(versions[0].sha256).toBe("originalhash");
    expect(versions[0].size).toBe(42);
  });

  it("returns unauthenticated when there is no session", async () => {
    auth.api.getSession.mockResolvedValueOnce(null);
    const res = await replaceDocumentPdfAction(
      DOC_ID,
      await fd(new File([], "x.pdf", { type: "application/pdf" })),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("unauthenticated");
  });

  it("rejects a non-PDF payload as invalid_pdf", async () => {
    const res = await replaceDocumentPdfAction(
      DOC_ID,
      await fd(new File(["plain text"], "x.txt", { type: "text/plain" })),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("invalid_pdf");

    // No document_version row was written, no version bump.
    const versions = await db.select().from(documentVersion);
    expect(versions.length).toBe(0);
    const [doc] = await db.select().from(document);
    expect(doc.version).toBe(1);
  });

  it("cross-user access is blocked (zero-leak → not_found)", async () => {
    auth.api.getSession.mockResolvedValueOnce({
      user: { id: USER_B, email: "repb@x.de" },
      session: { id: "s2" },
    });
    const bytes = await readFile(path.resolve(process.cwd(), "transcript.pdf"));
    const res = await replaceDocumentPdfAction(
      DOC_ID,
      await fd(
        new File([bytes], "b-scan.pdf", { type: "application/pdf" }),
      ),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("not_found");

    // No side effects.
    const versions = await db.select().from(documentVersion);
    expect(versions.length).toBe(0);
    const [doc] = await db.select().from(document);
    expect(doc.version).toBe(1);
    expect(doc.storagePath).toBe(`data/uploads/${DOC_ID}.pdf`);
  });
});
