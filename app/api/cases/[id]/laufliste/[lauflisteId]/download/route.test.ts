// @vitest-environment node
//
// Phase 4 Plan 06 Task 1 — auth / ownership / file-missing matrix for the
// Laufliste download Route Handler.
//
// Status matrix per plan:
//   401 — no session
//   404 — unknown caseId OR cross-owner
//   404 — lauflisteId belongs to another case (ID-swap leak T-04-15)
//   410 — row exists but file missing on disk
//   200 — all aligned → application/pdf with RFC 5987 Content-Disposition
//
// Pattern mirrors __tests__/phase3-integration.test.ts:
//   - Fresh isolated SQLite DB via createTestDb
//   - vi.doMock next/headers + server-only + @/lib/auth BEFORE dynamic import
//   - Swappable session holder so each test picks an owner
//   - Real DB writes; disk writes go to a tmpdir we rm -rf in afterAll.

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
import path from "node:path";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { createTestDb } from "../../../../../../../__tests__/_fixtures/test-db";
import { LAUFLISTEN_DIR } from "@/lib/laufliste/storage";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

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
let caseTable: any;
let laufliste: any;
let GET: any;
/* eslint-enable @typescript-eslint/no-explicit-any */

let dbCleanup: () => void;
let tmpDir: string;

const USER_A = "u-a";
const USER_B = "u-b";
const CASE_A = "case-a";
const CASE_A2 = "case-a2";
const CASE_B = "case-b";
const LF_A = "lf-a";
const LF_B = "lf-b";
const LF_MISSING = "lf-missing";

beforeAll(async () => {
  const testDb = createTestDb();
  dbCleanup = testDb.cleanup;
  process.env.DATABASE_URL = testDb.dbFile;
  process.env.BETTER_AUTH_SECRET = "x".repeat(32);
  process.env.BETTER_AUTH_URL = "http://localhost:3000";

  // Write test fixture files INSIDE LAUFLISTEN_DIR so the route's
  // containment check (R-04-01) accepts them. We mkdtemp below it to keep
  // the fixtures isolated and cleanable.
  mkdirSync(LAUFLISTEN_DIR, { recursive: true });
  tmpDir = mkdtempSync(path.join(LAUFLISTEN_DIR, "test-download-"));

  vi.resetModules();

  ({ db } = await import("@/db/client"));
  ({ user, caseTable, laufliste } = await import("@/db/schema"));
  ({ GET } = await import("./route"));
});

afterAll(() => {
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
  dbCleanup?.();
});

beforeEach(async () => {
  await db.delete(laufliste);
  await db.delete(caseTable);
  await db.delete(user);

  await db.insert(user).values([
    { id: USER_A, name: "Alice", email: "a@x.de", emailVerified: true },
    { id: USER_B, name: "Bob", email: "b@x.de", emailVerified: true },
  ]);

  // User-A owns two cases: CASE_A (with a real PDF), CASE_A2 (empty).
  await db.insert(caseTable).values([
    {
      id: CASE_A,
      userId: USER_A,
      personName: "Dr. Müller Özgür Weiß",
      status: "pdf_generated",
    },
    {
      id: CASE_A2,
      userId: USER_A,
      personName: "Alice Other",
      status: "open",
    },
    {
      id: CASE_B,
      userId: USER_B,
      personName: "Bob",
      status: "pdf_generated",
    },
  ]);

  // Real PDF bytes on disk for CASE_A / LF_A.
  const realPath = path.join(tmpDir, `${CASE_A}.pdf`);
  writeFileSync(realPath, Buffer.from("%PDF-1.4 test body\n%%EOF\n"));
  const missingPath = path.join(tmpDir, "does-not-exist.pdf");

  await db.insert(laufliste).values([
    {
      id: LF_A,
      caseId: CASE_A,
      userId: USER_A,
      pdfStoragePath: realPath, // absolute path — route should handle both
      generatedAt: new Date("2026-04-17T10:00:00Z"),
      documentCount: 1,
      fileSize: fs.statSync(realPath).size,
    },
    {
      id: LF_MISSING,
      caseId: CASE_A,
      userId: USER_A,
      pdfStoragePath: missingPath,
      generatedAt: new Date("2026-04-17T10:00:00Z"),
      documentCount: 1,
      fileSize: 1,
    },
    {
      id: LF_B,
      caseId: CASE_B,
      userId: USER_B,
      pdfStoragePath: realPath,
      generatedAt: new Date("2026-04-17T10:00:00Z"),
      documentCount: 1,
      fileSize: 1,
    },
  ]);

  // Default: user-a.
  sessionHolder.current = {
    user: { id: USER_A, email: "a@x.de" },
    session: { id: "s-a" },
  };
});

function req() {
  return new Request(
    `http://localhost/api/cases/x/laufliste/y/download`,
  );
}

describe("GET /api/cases/[id]/laufliste/[lauflisteId]/download", () => {
  it("returns 401 when there is no session", async () => {
    sessionHolder.current = null;
    const res = await GET(req(), {
      params: Promise.resolve({ id: CASE_A, lauflisteId: LF_A }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when caseId is unknown", async () => {
    const res = await GET(req(), {
      params: Promise.resolve({ id: "no-such-case", lauflisteId: LF_A }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when the laufliste belongs to a case owned by another user", async () => {
    // User-A asks for CASE_B / LF_B — must 404 (no cross-owner leak).
    const res = await GET(req(), {
      params: Promise.resolve({ id: CASE_B, lauflisteId: LF_B }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when lauflisteId is cross-case (ID-swap)", async () => {
    // LF_A belongs to CASE_A, but user-A also owns CASE_A2 — asking via CASE_A2
    // must 404 even though both belong to the caller.
    const res = await GET(req(), {
      params: Promise.resolve({ id: CASE_A2, lauflisteId: LF_A }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 410 when the DB row exists but the PDF file is missing on disk", async () => {
    const res = await GET(req(), {
      params: Promise.resolve({ id: CASE_A, lauflisteId: LF_MISSING }),
    });
    expect(res.status).toBe(410);
  });

  it("returns 200 with application/pdf + RFC 5987 Content-Disposition when all aligned", async () => {
    const res = await GET(req(), {
      params: Promise.resolve({ id: CASE_A, lauflisteId: LF_A }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    const len = res.headers.get("content-length");
    expect(len && Number.parseInt(len, 10)).toBeGreaterThan(0);
    expect(res.headers.get("cache-control")).toBe("private, no-store");

    const cd = res.headers.get("content-disposition") ?? "";
    // RFC 6266: ASCII fallback…
    expect(cd).toMatch(/^attachment; filename="[^"]+\.pdf"/);
    // …plus an RFC 5987 UTF-8 variant.
    expect(cd).toMatch(/filename\*=UTF-8''/);
    // ASCII filename has the umlaut-folded slug.
    expect(cd).toMatch(/Laufliste-dr-mueller-oezguer-weiss-2026-04-17\.pdf/);
    // Body starts with %PDF-
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 5).toString("utf8")).toBe("%PDF-");
  });

  it("Content-Disposition UTF-8 variant preserves German umlauts via percent-encoding", async () => {
    const res = await GET(req(), {
      params: Promise.resolve({ id: CASE_A, lauflisteId: LF_A }),
    });
    expect(res.status).toBe(200);
    const cd = res.headers.get("content-disposition") ?? "";
    // The ü in "Müller" must round-trip via percent-encoded UTF-8 bytes.
    // "ü" is 0xC3 0xBC → %C3%BC
    expect(cd).toContain("%C3%BC");
    // And "ß" → %C3%9F
    expect(cd).toContain("%C3%9F");
  });
});
