// @vitest-environment node
//
// Plan 03-02 Task 3: Unit tests for scripts/seed-behoerden.ts.
//
// - Mocks the Claude parser via the injected parseState option
//   (no vi.mock needed; no network call).
// - Uses a per-file temp SQLite DB via createTestDb() — never touches
//   data/angela.db.
// - Uses a temp cache path so the project's committed
//   data/behoerden-parsed.json is never mutated.
//
// Covers:
//   1. First run (no cache)  → parseState called once per state, DB populated.
//   2. Second run (cache hit) → parseState never called, DB state unchanged.
//   3. force=true on hit     → parseState called again (re-parses into cache).
//   4. needs_review fidelity — exactly the expected count of rows has needs_review=1.

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createTestDb } from "../_fixtures/test-db";
import type { StateParseOutputT } from "../../scripts/parse-state-with-claude";

// Lazy-bound — populated after DATABASE_URL is set and module graph is reset.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let seedBehoerden: (opts: any) => Promise<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let schema: any;
let dbCleanup: () => void;

// Temp working paths
let TMP_DIR: string;
let CACHE_PATH: string;
let SOURCE_PATH: string;

// ---------------------------------------------------------------------------
// Source fixture: behoerden_db.json-shaped input with 3 states.
// ---------------------------------------------------------------------------
const SOURCE_FIXTURE = {
  Bayern: {
    hat_regierungsbezirke: true,
    besonderheiten: "BY hat 7 Regierungsbezirke.",
    dokumente_raw: "# Bayern\n- Geburtsurkunde …",
  },
  Berlin: {
    hat_regierungsbezirke: "",
    besonderheiten: "Stadtstaat.",
    dokumente_raw: "# Berlin\n- Geburtsurkunde …",
  },
  Hessen: {
    hat_regierungsbezirke: true,
    besonderheiten: "HE hat 3 Regierungsbezirke.",
    dokumente_raw: "# Hessen\n- Geburtsurkunde …",
  },
};

// ---------------------------------------------------------------------------
// Factory for a minimal-but-valid StateParseOutput per state.
// Three of the eight authorities will carry needs_review=true so we can
// assert the count exactly in Test 4.
// ---------------------------------------------------------------------------
function buildStateOutput(stateName: string): StateParseOutputT {
  const stateSlug = stateName
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const hasRbz = stateName === "Bayern" || stateName === "Hessen";
  const rbzList =
    stateName === "Bayern"
      ? ["Oberbayern"]
      : stateName === "Hessen"
      ? ["Darmstadt"]
      : [];

  return {
    state_slug: stateSlug,
    state_name: stateName,
    hat_regierungsbezirke: hasRbz,
    besonderheiten: `Test-Daten für ${stateName}`,
    regierungsbezirke: rbzList,
    authorities: [
      {
        document_type_display: "Geburtsurkunde",
        document_type_slug: "geburtsurkunde",
        regierungsbezirk: hasRbz ? rbzList[0] : null,
        name: `Standesamt ${stateName}`,
        address: "Musterweg 1",
        phone: null,
        email: null,
        website: null,
        office_hours: null,
        notes: null,
        special_rules: null,
        needs_review: stateName === "Bayern", // true for Bayern only
      },
      {
        document_type_display: "Führungszeugnis",
        document_type_slug: "fuehrungszeugnis",
        regierungsbezirk: null,
        name: "Bundesamt für Justiz",
        address: "Adenauerallee 99",
        phone: null,
        email: null,
        website: null,
        office_hours: null,
        notes: null,
        special_rules: "Direkt zur Apostille — keine Vorbeglaubigung.",
        needs_review: stateName === "Berlin" || stateName === "Hessen",
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------
beforeAll(async () => {
  // Isolated DB with schema applied.
  const testDb = createTestDb();
  dbCleanup = testDb.cleanup;
  process.env.DATABASE_URL = testDb.dbFile;

  // Temp paths — cache file is created per test in beforeEach.
  TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "seed-behoerden-test-"));
  CACHE_PATH = path.join(TMP_DIR, "behoerden-parsed.json");
  SOURCE_PATH = path.join(TMP_DIR, "behoerden_db.json");
  fs.writeFileSync(SOURCE_PATH, JSON.stringify(SOURCE_FIXTURE));

  vi.resetModules();

  // Dynamic imports AFTER DATABASE_URL is set so db/client.ts resolves the temp DB.
  ({ db } = await import("../../db/client"));
  schema = await import("../../db/schema");
  ({ seedBehoerden } = await import("../../scripts/seed-behoerden"));
});

afterAll(() => {
  try {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  } catch {
    // ignore
  }
  dbCleanup?.();
});

beforeEach(() => {
  // Fresh cache each test — delete the file if present.
  try {
    fs.unlinkSync(CACHE_PATH);
  } catch {
    // missing is fine
  }
  // Clear all Behörden tables so each test starts from empty state.
  db.delete(schema.behoerdenAuthority).run();
  db.delete(schema.behoerdenRegierungsbezirk).run();
  db.delete(schema.behoerdenDocumentType).run();
  db.delete(schema.behoerdenState).run();
});

describe("seedBehoerden", () => {
  it("first run (no cache): calls the parser once per state and populates all tables", async () => {
    const parseState = vi.fn(async (_raw: string, slugHint: string) => {
      // Map the slug hint back to a state name. The seed passes normalizeDocTypeSlug(bundesland)
      // (e.g., "bayern", "berlin", "hessen").
      const map: Record<string, string> = {
        bayern: "Bayern",
        berlin: "Berlin",
        hessen: "Hessen",
      };
      const stateName = map[slugHint];
      if (!stateName) throw new Error(`unexpected slug hint: ${slugHint}`);
      return buildStateOutput(stateName);
    });

    const res = await seedBehoerden({
      cachePath: CACHE_PATH,
      sourcePath: SOURCE_PATH,
      parseState,
    });

    expect(parseState).toHaveBeenCalledTimes(3);
    expect(res.states).toBe(3);
    expect(res.authorities).toBe(6); // 2 per state × 3 states
    expect(res.regierungsbezirke).toBe(2); // Bayern + Hessen one each
    expect(res.documentTypes).toBe(2); // geburtsurkunde + fuehrungszeugnis (global dedup)
    expect(res.cacheHit).toBe(false);
    expect(res.parseCallsMade).toBe(3);

    // Cache should now exist.
    expect(fs.existsSync(CACHE_PATH)).toBe(true);
  });

  it("second run (cache present): does NOT call the parser and preserves DB state", async () => {
    // Prime with first run.
    const parseState1 = vi.fn(async (_raw: string, slugHint: string) => {
      const map: Record<string, string> = {
        bayern: "Bayern",
        berlin: "Berlin",
        hessen: "Hessen",
      };
      return buildStateOutput(map[slugHint]!);
    });
    await seedBehoerden({
      cachePath: CACHE_PATH,
      sourcePath: SOURCE_PATH,
      parseState: parseState1,
    });

    // Second run with a distinct mock that MUST NOT be called.
    const parseState2 = vi.fn(async () => {
      throw new Error("parseState should not be called when cache exists");
    });
    const res2 = await seedBehoerden({
      cachePath: CACHE_PATH,
      sourcePath: SOURCE_PATH,
      parseState: parseState2,
    });

    expect(parseState2).not.toHaveBeenCalled();
    expect(res2.cacheHit).toBe(true);
    expect(res2.parseCallsMade).toBe(0);
    expect(res2.states).toBe(3);
    expect(res2.authorities).toBe(6);
  });

  it("force=true with cache present: re-invokes the parser and overwrites cache", async () => {
    const parseState1 = vi.fn(async (_raw: string, slugHint: string) => {
      const map: Record<string, string> = {
        bayern: "Bayern",
        berlin: "Berlin",
        hessen: "Hessen",
      };
      return buildStateOutput(map[slugHint]!);
    });
    await seedBehoerden({
      cachePath: CACHE_PATH,
      sourcePath: SOURCE_PATH,
      parseState: parseState1,
    });
    expect(parseState1).toHaveBeenCalledTimes(3);

    const parseState2 = vi.fn(async (_raw: string, slugHint: string) => {
      const map: Record<string, string> = {
        bayern: "Bayern",
        berlin: "Berlin",
        hessen: "Hessen",
      };
      return buildStateOutput(map[slugHint]!);
    });
    const res = await seedBehoerden({
      cachePath: CACHE_PATH,
      sourcePath: SOURCE_PATH,
      parseState: parseState2,
      force: true,
    });

    expect(parseState2).toHaveBeenCalledTimes(3);
    expect(res.cacheHit).toBe(false);
    expect(res.parseCallsMade).toBe(3);
  });

  it("needs_review fidelity: DB has exactly the expected count of needs_review=true rows", async () => {
    // Fixture assigns needs_review=true to:
    //   - Bayern / Geburtsurkunde
    //   - Berlin / Führungszeugnis
    //   - Hessen / Führungszeugnis
    // Expected total: 3
    const parseState = vi.fn(async (_raw: string, slugHint: string) => {
      const map: Record<string, string> = {
        bayern: "Bayern",
        berlin: "Berlin",
        hessen: "Hessen",
      };
      return buildStateOutput(map[slugHint]!);
    });

    await seedBehoerden({
      cachePath: CACHE_PATH,
      sourcePath: SOURCE_PATH,
      parseState,
    });

    const all = db.select().from(schema.behoerdenAuthority).all();
    const reviewCount = all.filter(
      (r: { needsReview: boolean }) => r.needsReview === true,
    ).length;
    expect(reviewCount).toBe(3);

    // Also confirm the special_rules text survived the round trip.
    const withRules = all.filter(
      (r: { specialRules: string | null }) =>
        r.specialRules !== null &&
        r.specialRules.includes("keine Vorbeglaubigung"),
    );
    expect(withRules.length).toBeGreaterThan(0);
  });
});
