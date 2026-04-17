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
import { writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { createTestDb } from "../../__tests__/_fixtures/test-db";

// Shared mock fn installed via vi.doMock AFTER vi.resetModules so the mock is
// applied to the fresh module graph that actions.ts is dynamically loaded into.
const extractFieldsMock = vi.fn();

// next/headers is only available inside a Next request; mock it for plain Node.
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

// Mock lib/auth to return a stable fake session.
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(async () => ({
        user: { id: "test-user-2", email: "e@x.de" },
        session: { id: "s2" },
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
let extraction: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let extractionLog: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let user: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let extractDocumentAction: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let drizzleEq: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let authMod: any;
let dbCleanup: () => void;

const DOC_ID = "doc-1";
const STORAGE_PATH = `data/uploads/${DOC_ID}.pdf`;
const createdFiles = new Set<string>();

const OK_RESPONSE = {
  parsed: {
    dokumenten_typ: {
      value: "Geburtsurkunde",
      confidence: "high" as const,
      reasoning: "ok",
    },
    ausstellende_behoerde: {
      value: "Standesamt München",
      confidence: "high" as const,
      reasoning: "ok",
    },
    ausstellungsort: {
      value: "München",
      confidence: "high" as const,
      reasoning: "ok",
    },
    bundesland: {
      value: "Bayern",
      confidence: "medium" as const,
      reasoning: "inferred",
    },
    ausstellungsdatum: {
      value: "2020-01-15",
      confidence: "high" as const,
      reasoning: "ok",
    },
    voller_name: {
      value: null,
      confidence: "low" as const,
      reasoning: "not visible",
    },
  },
  usage: { input_tokens: 4000, output_tokens: 300 },
  model: "claude-sonnet-4-20250514",
};

beforeAll(async () => {
  const testDb = createTestDb();
  dbCleanup = testDb.cleanup;
  process.env.DATABASE_URL = testDb.dbFile;
  process.env.BETTER_AUTH_SECRET = "x".repeat(32);
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
  process.env.USD_TO_EUR = "0.92";

  vi.resetModules();

  // Install the Claude wrapper mock INTO the fresh module graph BEFORE
  // dynamically importing actions.ts. doMock is not hoisted and takes effect
  // for subsequent import() calls.
  vi.doMock("./claude", () => ({
    extractFields: extractFieldsMock,
  }));

  ({ db } = await import("@/db/client"));
  ({ document, extraction, extractionLog, user } = await import("@/db/schema"));
  ({ extractDocumentAction } = await import("./actions"));
  ({ eq: drizzleEq } = await import("drizzle-orm"));
  authMod = await import("@/lib/auth");
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
  await db.delete(extractionLog);
  await db.delete(extraction);
  await db.delete(document);
  await db.delete(user);
  await db.insert(user).values({
    id: "test-user-2",
    name: "Test User 2",
    email: "e@x.de",
    emailVerified: true,
  });
  const abs = path.resolve(process.cwd(), STORAGE_PATH);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, new Uint8Array([0x25, 0x50, 0x44, 0x46])); // %PDF magic
  createdFiles.add(abs);
  await db.insert(document).values({
    id: DOC_ID,
    userId: "test-user-2",
    filename: "x.pdf",
    size: 4,
    sha256: "deadbeef",
    storagePath: STORAGE_PATH,
    extractionStatus: "pending",
  });
  extractFieldsMock.mockReset();
  // Re-bind the auth mock in case a previous test used mockResolvedValueOnce(null).
  authMod.auth.api.getSession.mockResolvedValue({
    user: { id: "test-user-2", email: "e@x.de" },
    session: { id: "s2" },
  });
});

describe("extractDocumentAction", () => {
  it("returns not_found for unknown id", async () => {
    const res = await extractDocumentAction("no-such-id");
    expect(res).toEqual({
      ok: false,
      documentId: "no-such-id",
      error: "not_found",
    });
  });

  it("writes 6 extraction rows + 1 log row on success, transitions status to done", async () => {
    extractFieldsMock.mockResolvedValueOnce(OK_RESPONSE);
    const res = await extractDocumentAction(DOC_ID);
    expect(res.ok).toBe(true);
    const rows = await db.select().from(extraction);
    expect(rows.length).toBe(6);
    const log = await db.select().from(extractionLog);
    expect(log.length).toBe(1);
    expect(log[0].claudeModel).toBe("claude-sonnet-4-20250514");
    expect(log[0].inputTokens).toBe(4000);
    expect(log[0].outputTokens).toBe(300);
    // cost: (4000*3 + 300*15)/1e6 * 0.92 = 0.01518
    expect(log[0].costEur).toBeCloseTo(0.01518, 6);
    const [doc] = await db
      .select()
      .from(document)
      .where(drizzleEq(document.id, DOC_ID));
    expect(doc.extractionStatus).toBe("done");
    expect(doc.extractedAt).not.toBeNull();
    expect(doc.errorCode).toBeNull();
  });

  it("preserves null value with low confidence (D-12)", async () => {
    extractFieldsMock.mockResolvedValueOnce(OK_RESPONSE);
    await extractDocumentAction(DOC_ID);
    const rows = await db.select().from(extraction);
    const vn = rows.find(
      (r: { fieldName: string }) => r.fieldName === "voller_name",
    );
    expect(vn).toBeDefined();
    expect(vn.fieldValue).toBeNull();
    expect(vn.confidence).toBe("low");
  });

  it("retries once on 429 and fails cleanly on second 429", async () => {
    const rateErr = Object.assign(new Error("rate limited"), {
      status: 429,
      headers: { "retry-after": "0" },
    });
    extractFieldsMock
      .mockRejectedValueOnce(rateErr)
      .mockRejectedValueOnce(rateErr);
    const res = await extractDocumentAction(DOC_ID);
    expect(res).toEqual({
      ok: false,
      documentId: DOC_ID,
      error: "rate_limited",
    });
    const [doc] = await db
      .select()
      .from(document)
      .where(drizzleEq(document.id, DOC_ID));
    expect(doc.extractionStatus).toBe("error");
    expect(doc.errorCode).toBe("rate_limited");
    expect(extractFieldsMock.mock.calls.length).toBe(2);
  });

  it("retries once on 429 and succeeds on the second attempt", async () => {
    const rateErr = Object.assign(new Error("rate limited"), {
      status: 429,
      headers: { "retry-after": "0" },
    });
    extractFieldsMock
      .mockRejectedValueOnce(rateErr)
      .mockResolvedValueOnce(OK_RESPONSE);
    const res = await extractDocumentAction(DOC_ID);
    expect(res.ok).toBe(true);
    expect(extractFieldsMock.mock.calls.length).toBe(2);
    const rows = await db.select().from(extraction);
    expect(rows.length).toBe(6);
  });

  it("maps non-429 SDK errors to unknown and sets status=error", async () => {
    extractFieldsMock.mockRejectedValueOnce(new Error("boom"));
    const res = await extractDocumentAction(DOC_ID);
    expect(res).toEqual({
      ok: false,
      documentId: DOC_ID,
      error: "unknown",
    });
    const [doc] = await db
      .select()
      .from(document)
      .where(drizzleEq(document.id, DOC_ID));
    expect(doc.extractionStatus).toBe("error");
    expect(doc.errorCode).toBe("unknown");
  });

  it("is idempotent: second call on already-done document is a no-op", async () => {
    extractFieldsMock.mockResolvedValueOnce(OK_RESPONSE);
    await extractDocumentAction(DOC_ID);
    const res2 = await extractDocumentAction(DOC_ID);
    expect(res2).toEqual({ ok: true, documentId: DOC_ID });
    expect(extractFieldsMock.mock.calls.length).toBe(1);
    // Still exactly 6 rows
    const rows = await db.select().from(extraction);
    expect(rows.length).toBe(6);
  });

  it("returns unauthenticated when there is no session", async () => {
    authMod.auth.api.getSession.mockResolvedValueOnce(null);
    const res = await extractDocumentAction(DOC_ID);
    expect(res).toEqual({
      ok: false,
      documentId: DOC_ID,
      error: "unauthenticated",
    });
    expect(extractFieldsMock.mock.calls.length).toBe(0);
  });
});
