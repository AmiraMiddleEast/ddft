// @vitest-environment node
/**
 * Phase 2 exit-gate integration suite.
 *
 * Covers composition of the Server Actions end-to-end without ever hitting
 * the real Anthropic API:
 *   1) Happy path:   upload → extract → 1 document + 6 extractions + 1 log
 *   2) Dedup:        same bytes uploaded twice → single document row, dedup=true
 *   3) Cross-user:   user B hitting user A's /api/documents/[id]/pdf → 404
 *   4) Unauth:       no session hitting the Route Handler → 401
 *
 * See 02-07-PLAN.md and 02-VALIDATION.md (Wave 0 — Mock Anthropic client).
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
  vi,
} from "vitest";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { createTestDb } from "./_fixtures/test-db";

// next/headers is only available inside a Next request; mock it for plain Node.
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

// `server-only` is a Next.js marker package with no Node resolution.
// Stub it so lib/documents/queries.ts (imported transitively via the PDF route)
// loads cleanly in the vitest Node environment.
vi.mock("server-only", () => ({}));

// Shared holder so each test can swap the "current" session without re-mocking.
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

// Lazily bound after env-var setup + fresh module graph.
/* eslint-disable @typescript-eslint/no-explicit-any */
let db: any;
let document: any;
let extraction: any;
let extractionLog: any;
let user: any;
let uploadSingleDocumentAction: any;
let extractDocumentAction: any;
let extractFieldsMock: any;
let getPdf: any;
/* eslint-enable @typescript-eslint/no-explicit-any */

let dbCleanup: () => void;

const uploadedIdsForCleanup = new Set<string>();

const OK_RESPONSE = {
  parsed: {
    dokumenten_typ: {
      value: "Zeugnis",
      confidence: "high" as const,
      reasoning: "title",
    },
    ausstellende_behoerde: {
      value: "Universität Heidelberg",
      confidence: "high" as const,
      reasoning: "seal",
    },
    ausstellungsort: {
      value: "Heidelberg",
      confidence: "high" as const,
      reasoning: "header",
    },
    bundesland: {
      value: "Baden-Württemberg",
      confidence: "medium" as const,
      reasoning: "inferred",
    },
    ausstellungsdatum: {
      value: "2021-06-30",
      confidence: "high" as const,
      reasoning: "stamped",
    },
    voller_name: {
      value: "Max Mustermann",
      confidence: "high" as const,
      reasoning: "name line",
    },
  },
  usage: { input_tokens: 5000, output_tokens: 400 },
  model: "claude-sonnet-4-20250514",
};

async function fd(file: File): Promise<FormData> {
  const f = new FormData();
  f.append("file", file);
  return f;
}

beforeAll(async () => {
  const testDb = createTestDb();
  dbCleanup = testDb.cleanup;
  process.env.DATABASE_URL = testDb.dbFile;
  process.env.BETTER_AUTH_SECRET = "x".repeat(32);
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
  process.env.USD_TO_EUR = "0.92";

  vi.resetModules();

  // Install Claude wrapper mock INTO the fresh module graph BEFORE dynamically
  // importing any module that reaches lib/extraction/claude. doMock is not
  // hoisted and only affects subsequent import() calls.
  extractFieldsMock = vi.fn();
  vi.doMock("@/lib/extraction/claude", () => ({
    extractFields: extractFieldsMock,
  }));

  ({ db } = await import("@/db/client"));
  ({ document, extraction, extractionLog, user } = await import("@/db/schema"));
  ({ uploadSingleDocumentAction } = await import("@/lib/uploads/actions"));
  ({ extractDocumentAction } = await import("@/lib/extraction/actions"));
  ({ GET: getPdf } = await import("@/app/api/documents/[id]/pdf/route"));
});

afterAll(async () => {
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
  await db.delete(extractionLog);
  await db.delete(extraction);
  await db.delete(document);
  await db.delete(user);
  await db.insert(user).values([
    {
      id: "u-a",
      name: "Alice",
      email: "a@x.de",
      emailVerified: true,
    },
    {
      id: "u-b",
      name: "Bob",
      email: "b@x.de",
      emailVerified: true,
    },
  ]);
  sessionHolder.current = {
    user: { id: "u-a", email: "a@x.de" },
    session: { id: "s-a" },
  };
  extractFieldsMock.mockReset();
});

afterEach(async () => {
  // Best-effort cleanup for files written inside the test — afterAll also runs.
  const rows = await db.select().from(document);
  for (const r of rows) {
    uploadedIdsForCleanup.add(r.id);
  }
});

describe("Phase 2 — integration", () => {
  it("uploads, extracts, and persists 6 fields + 1 log for the owning user", async () => {
    const bytes = await readFile(
      path.resolve(process.cwd(), "transcript.pdf"),
    );
    const up = await uploadSingleDocumentAction(
      null,
      await fd(new File([bytes], "transcript.pdf", { type: "application/pdf" })),
    );
    expect(up.ok).toBe(true);
    if (!up.ok) return;
    uploadedIdsForCleanup.add(up.documentId);
    expect(up.dedup).toBe(false);

    extractFieldsMock.mockResolvedValueOnce(OK_RESPONSE);
    const ex = await extractDocumentAction(up.documentId);
    expect(ex.ok).toBe(true);

    const docs = await db.select().from(document);
    expect(docs.length).toBe(1);
    expect(docs[0].extractionStatus).toBe("done");
    expect(docs[0].extractedAt).not.toBeNull();
    expect(docs[0].errorCode).toBeNull();

    const xs = await db.select().from(extraction);
    expect(xs.length).toBe(6);
    const fieldNames = xs.map((r: { fieldName: string }) => r.fieldName).sort();
    expect(fieldNames).toEqual(
      [
        "ausstellende_behoerde",
        "ausstellungsdatum",
        "ausstellungsort",
        "bundesland",
        "dokumenten_typ",
        "voller_name",
      ].sort(),
    );

    const logs = await db.select().from(extractionLog);
    expect(logs.length).toBe(1);
    expect(logs[0].inputTokens).toBe(5000);
    expect(logs[0].outputTokens).toBe(400);
    expect(logs[0].claudeModel).toBe("claude-sonnet-4-20250514");
    expect(logs[0].costEur).toBeGreaterThan(0);
  });

  it("dedups the same file on second upload (no new document row)", async () => {
    const bytes = await readFile(
      path.resolve(process.cwd(), "transcript.pdf"),
    );
    const r1 = await uploadSingleDocumentAction(
      null,
      await fd(new File([bytes], "one.pdf", { type: "application/pdf" })),
    );
    const r2 = await uploadSingleDocumentAction(
      null,
      await fd(new File([bytes], "two.pdf", { type: "application/pdf" })),
    );
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (r1.ok && r2.ok) {
      uploadedIdsForCleanup.add(r1.documentId);
      expect(r1.dedup).toBe(false);
      expect(r2.dedup).toBe(true);
      expect(r2.documentId).toBe(r1.documentId);
    }
    const docs = await db.select().from(document);
    expect(docs.length).toBe(1);
  });

  it("returns 404 when a user requests another user's PDF via the Route Handler", async () => {
    const bytes = await readFile(
      path.resolve(process.cwd(), "transcript.pdf"),
    );
    const up = await uploadSingleDocumentAction(
      null,
      await fd(new File([bytes], "a.pdf", { type: "application/pdf" })),
    );
    expect(up.ok).toBe(true);
    if (!up.ok) return;
    uploadedIdsForCleanup.add(up.documentId);

    // Switch to user B for the route call.
    sessionHolder.current = {
      user: { id: "u-b", email: "b@x.de" },
      session: { id: "s-b" },
    };
    const res = await getPdf(
      new Request(`http://localhost/api/documents/${up.documentId}/pdf`),
      { params: Promise.resolve({ id: up.documentId }) },
    );
    expect(res.status).toBe(404);
  });

  it("returns 401 when the Route Handler is called without a session", async () => {
    sessionHolder.current = null;
    const res = await getPdf(
      new Request("http://localhost/api/documents/any/pdf"),
      { params: Promise.resolve({ id: "any" }) },
    );
    expect(res.status).toBe(401);
  });
});
