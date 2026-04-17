// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { createTestDb } from "../../__tests__/_fixtures/test-db";

// next/headers is only available inside a Next request; mock it for plain Node.
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

// Mock lib/auth to return a stable fake session so we don't exercise better-auth here.
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(async () => ({
        user: { id: "test-user-1", email: "t@example.com" },
        session: { id: "s1" },
      })),
    },
  },
}));

// Bindings lazily populated after env vars + module import.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let document: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let user: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let uploadSingleDocumentAction: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let auth: any;
let dbCleanup: () => void;

const uploadedIdsForCleanup = new Set<string>();

beforeAll(async () => {
  const testDb = createTestDb();
  dbCleanup = testDb.cleanup;
  process.env.DATABASE_URL = testDb.dbFile;
  process.env.BETTER_AUTH_SECRET = "x".repeat(32);
  process.env.BETTER_AUTH_URL = "http://localhost:3000";

  vi.resetModules();
  ({ db } = await import("@/db/client"));
  ({ document, user } = await import("@/db/schema"));
  ({ uploadSingleDocumentAction } = await import("./actions"));
  ({ auth } = await import("@/lib/auth"));
});

afterAll(async () => {
  // Clean up any files we wrote under data/uploads/{id}.pdf.
  for (const id of uploadedIdsForCleanup) {
    const p = path.resolve(process.cwd(), "data", "uploads", `${id}.pdf`);
    try {
      await rm(p, { force: true });
    } catch {
      // ignore
    }
  }
  dbCleanup?.();
});

beforeEach(async () => {
  await db.delete(document);
  await db.delete(user);
  await db.insert(user).values({
    id: "test-user-1",
    name: "Test User",
    email: "t@example.com",
    emailVerified: true,
  });
  // Re-bind the mock return between tests (one test uses mockResolvedValueOnce(null)).
  auth.api.getSession.mockResolvedValue({
    user: { id: "test-user-1", email: "t@example.com" },
    session: { id: "s1" },
  });
});

async function fd(file: File): Promise<FormData> {
  const f = new FormData();
  f.append("file", file);
  return f;
}

describe("uploadSingleDocumentAction", () => {
  it("returns unauthenticated when there is no session", async () => {
    auth.api.getSession.mockResolvedValueOnce(null);
    const res = await uploadSingleDocumentAction(
      null,
      await fd(new File([], "x.pdf", { type: "application/pdf" })),
    );
    expect(res).toEqual({ ok: false, error: "unauthenticated" });
  });

  it("rejects non-PDF MIME as invalid_pdf", async () => {
    const res = await uploadSingleDocumentAction(
      null,
      await fd(new File(["hello"], "x.txt", { type: "text/plain" })),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("invalid_pdf");
  });

  it("rejects a file larger than 10 MB as file_too_large", async () => {
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    // %PDF magic bytes so the rejection is clearly size-based, not type-based
    big.set([0x25, 0x50, 0x44, 0x46], 0);
    const res = await uploadSingleDocumentAction(
      null,
      await fd(new File([big], "big.pdf", { type: "application/pdf" })),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("file_too_large");
  });

  it("rejects an encrypted PDF as encrypted_pdf", async () => {
    const bytes = await readFile(
      path.resolve(process.cwd(), "__fixtures__/encrypted.pdf"),
    );
    const res = await uploadSingleDocumentAction(
      null,
      await fd(
        new File([bytes], "encrypted.pdf", { type: "application/pdf" }),
      ),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("encrypted_pdf");
  });

  it("accepts a valid PDF and inserts a document row with extraction_status=pending", async () => {
    const bytes = await readFile(path.resolve(process.cwd(), "transcript.pdf"));
    const res = await uploadSingleDocumentAction(
      null,
      await fd(
        new File([bytes], "transcript.pdf", { type: "application/pdf" }),
      ),
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      uploadedIdsForCleanup.add(res.documentId);
      expect(res.dedup).toBe(false);
      expect(res.filename).toBe("transcript.pdf");

      const rows = await db.select().from(document);
      expect(rows.length).toBe(1);
      expect(rows[0].extractionStatus).toBe("pending");
      expect(rows[0].storagePath).toMatch(/^data\/uploads\/.*\.pdf$/);
      expect(rows[0].mime).toBe("application/pdf");
      expect(rows[0].size).toBe(bytes.byteLength);
      expect(rows[0].sha256).toMatch(/^[0-9a-f]{64}$/);

      // File actually landed on disk at data/uploads/{id}.pdf
      const onDisk = path.resolve(
        process.cwd(),
        "data",
        "uploads",
        `${res.documentId}.pdf`,
      );
      const st = await stat(onDisk);
      expect(st.size).toBe(bytes.byteLength);
    }
  });

  it("dedups on second upload of the identical file (same documentId, no second row)", async () => {
    const bytes = await readFile(path.resolve(process.cwd(), "transcript.pdf"));
    const res1 = await uploadSingleDocumentAction(
      null,
      await fd(new File([bytes], "a.pdf", { type: "application/pdf" })),
    );
    const res2 = await uploadSingleDocumentAction(
      null,
      await fd(new File([bytes], "b.pdf", { type: "application/pdf" })),
    );
    expect(res1.ok).toBe(true);
    expect(res2.ok).toBe(true);
    if (res1.ok && res2.ok) {
      uploadedIdsForCleanup.add(res1.documentId);
      expect(res2.documentId).toBe(res1.documentId);
      expect(res1.dedup).toBe(false);
      expect(res2.dedup).toBe(true);
    }
    const rows = await db.select().from(document);
    expect(rows.length).toBe(1);
  });
});
