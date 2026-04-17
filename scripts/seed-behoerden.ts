// scripts/seed-behoerden.ts
//
// Plan 03-02 Task 2: Populate the four Behörden tables from behoerden_db.json.
//
// Phases:
//   1. LOAD RAW  — read behoerden_db.json (object keyed by state name).
//   2. PARSE     — call Claude per state; cached in data/behoerden-parsed.json.
//                  Subsequent runs skip the Claude call unless --force is set.
//   3. INSERT    — wipe + re-insert all four Behörden tables inside a
//                  single transaction (idempotent by design — a second run
//                  produces the same row set without UNIQUE-constraint errors).
//
// CLI flags:
//   --force       Re-run the Claude parse even if the cache file exists.
//   --skip-parse  Insert from an existing cache file only; error if missing.
//                 Useful in CI and when ANTHROPIC_API_KEY is a placeholder.
//
// Run with: npm run seed:behoerden

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { db } from "../db/client";
import {
  behoerdenAuthority,
  behoerdenDocumentType,
  behoerdenRegierungsbezirk,
  behoerdenState,
} from "../db/schema";
import {
  StateParseOutput,
  normalizeDocTypeSlug,
  parseStateWithClaude,
  type StateParseOutputT,
} from "./parse-state-with-claude";

// ---------------------------------------------------------------------------
// Defaults (overridable by seedBehoerden opts for tests)
// ---------------------------------------------------------------------------
const DEFAULT_CACHE_PATH = path.resolve(
  process.cwd(),
  "data/behoerden-parsed.json",
);
const DEFAULT_SOURCE_PATH = path.resolve(process.cwd(), "behoerden_db.json");

// ---------------------------------------------------------------------------
// Raw file Zod schema — behoerden_db.json is an OBJECT keyed by state name
// (not an array), so we parse the values.
//
// Note: hat_regierungsbezirke in the source file can be `true` or an empty
// string `""`. Coerce to boolean defensively.
// ---------------------------------------------------------------------------
const RawStateSchema = z.object({
  hat_regierungsbezirke: z
    .union([z.boolean(), z.literal(""), z.null(), z.undefined()])
    .transform((v) => v === true),
  besonderheiten: z.string().nullable().optional(),
  dokumente_raw: z.string(),
});

const RawFileSchema = z.record(z.string(), RawStateSchema);

const CacheSchema = z.array(StateParseOutput);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type SeedOpts = {
  force?: boolean;
  skipParse?: boolean;
  cachePath?: string;
  sourcePath?: string;
  /** Injected parser (tests); defaults to the real Claude call. */
  parseState?: (raw: string, stateSlugHint: string) => Promise<StateParseOutputT>;
};

export type SeedResult = {
  states: number;
  authorities: number;
  documentTypes: number;
  regierungsbezirke: number;
  needsReviewCount: number;
  parseCallsMade: number;
  cacheHit: boolean;
};

export async function seedBehoerden(opts: SeedOpts = {}): Promise<SeedResult> {
  const cachePath = opts.cachePath ?? DEFAULT_CACHE_PATH;
  const sourcePath = opts.sourcePath ?? DEFAULT_SOURCE_PATH;
  const parser = opts.parseState ?? parseStateWithClaude;

  // -------- 1. LOAD RAW --------
  const rawJson = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  const rawMap = RawFileSchema.parse(rawJson);
  const rawStates = Object.entries(rawMap).map(([name, entry]) => ({
    bundesland: name,
    ...entry,
  }));
  console.log(
    `[seed-behoerden] loaded ${rawStates.length} states from ${sourcePath}`,
  );

  // -------- 2. PARSE (cached unless --force; required when --skip-parse) --------
  let parsed: StateParseOutputT[];
  let parseCallsMade = 0;
  let cacheHit = false;

  const cacheExists = fs.existsSync(cachePath);

  if (opts.skipParse) {
    if (!cacheExists) {
      throw new Error(
        `[seed-behoerden] --skip-parse set but cache file not found: ${cachePath}. ` +
          `Run without --skip-parse (requires ANTHROPIC_API_KEY) or commit a cached snapshot.`,
      );
    }
    console.log(
      `[seed-behoerden] --skip-parse — using cache ${cachePath} (no Claude calls)`,
    );
    parsed = CacheSchema.parse(JSON.parse(fs.readFileSync(cachePath, "utf8")));
    cacheHit = true;
  } else if (cacheExists && !opts.force) {
    console.log(
      `[seed-behoerden] cache hit: ${cachePath} — skipping Claude parse`,
    );
    parsed = CacheSchema.parse(JSON.parse(fs.readFileSync(cachePath, "utf8")));
    cacheHit = true;
  } else {
    console.log(
      `[seed-behoerden] parsing ${rawStates.length} states via Claude (this costs ~$0.30 and takes a few minutes)`,
    );
    const results: StateParseOutputT[] = [];
    for (const raw of rawStates) {
      const slugHint = normalizeDocTypeSlug(raw.bundesland);
      console.log(
        `  → parsing ${raw.bundesland} (${raw.dokumente_raw.length} chars)…`,
      );
      const result = await parser(raw.dokumente_raw, slugHint);
      parseCallsMade += 1;
      results.push(result);
    }
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify(results, null, 2));
    parsed = results;
    console.log(`[seed-behoerden] wrote cache: ${cachePath}`);
  }

  // -------- 3. INSERT (wipe + re-insert in a transaction) --------
  //
  // Idempotency strategy: "clean replace". A second invocation sees the same
  // parsed input and produces the same final table state. This also means we
  // never hit UNIQUE-constraint errors, which matters for the global
  // behoerden_document_type table whose slugs repeat across states.
  //
  // FK order matters: delete children first, insert parents first.
  db.transaction((tx) => {
    tx.delete(behoerdenAuthority).run();
    tx.delete(behoerdenRegierungsbezirk).run();
    tx.delete(behoerdenDocumentType).run();
    tx.delete(behoerdenState).run();

    // Aggregate unique doc-type slugs across ALL states (global dedup) before insert.
    const docTypeMap = new Map<string, { id: string; displayName: string }>();
    for (const state of parsed) {
      for (const a of state.authorities) {
        if (!docTypeMap.has(a.document_type_slug)) {
          docTypeMap.set(a.document_type_slug, {
            id: a.document_type_slug,
            displayName: a.document_type_display,
          });
        }
      }
    }
    for (const dt of docTypeMap.values()) {
      tx.insert(behoerdenDocumentType).values(dt).run();
    }

    // States → regierungsbezirke → authorities
    for (const state of parsed) {
      tx.insert(behoerdenState)
        .values({
          id: state.state_slug,
          name: state.state_name,
          hatRegierungsbezirke: state.hat_regierungsbezirke,
          besonderheiten: state.besonderheiten ?? null,
        })
        .run();

      const rbzIdByName = new Map<string, string>();
      for (const rbzName of state.regierungsbezirke ?? []) {
        const rbzSlug = normalizeDocTypeSlug(rbzName);
        const id = `${state.state_slug}-${rbzSlug}`;
        tx.insert(behoerdenRegierungsbezirk)
          .values({
            id,
            stateId: state.state_slug,
            name: rbzName,
            slug: rbzSlug,
          })
          .run();
        rbzIdByName.set(rbzName, id);
      }

      for (const a of state.authorities) {
        const rbzId = a.regierungsbezirk
          ? rbzIdByName.get(a.regierungsbezirk) ?? null
          : null;
        tx.insert(behoerdenAuthority)
          .values({
            id: randomUUID(),
            stateId: state.state_slug,
            regierungsbezirkId: rbzId,
            documentTypeId: a.document_type_slug,
            name: a.name,
            address: a.address ?? "",
            phone: a.phone,
            email: a.email,
            website: a.website,
            officeHours: a.office_hours,
            notes: a.notes,
            specialRules: a.special_rules,
            needsReview: a.needs_review,
          })
          .run();
      }
    }
  });

  // -------- Sanity counts --------
  const stateRows = db.select().from(behoerdenState).all();
  const authorityRows = db.select().from(behoerdenAuthority).all();
  const docTypeRows = db.select().from(behoerdenDocumentType).all();
  const rbzRows = db.select().from(behoerdenRegierungsbezirk).all();

  const needsReviewRows = db
    .select()
    .from(behoerdenAuthority)
    .where(eq(behoerdenAuthority.needsReview, true))
    .all();
  const needsReviewCount = needsReviewRows.length;

  console.log(
    `[seed-behoerden] inserted: states=${stateRows.length}, ` +
      `regierungsbezirke=${rbzRows.length}, document_types=${docTypeRows.length}, ` +
      `authorities=${authorityRows.length}, needs_review=${needsReviewCount}`,
  );

  // Pitfall 5 guard (research): baseline 24 PRÜFEN markers expected.
  if (needsReviewCount < 20) {
    console.warn(
      `[seed-behoerden] WARNING: needs_review count (${needsReviewCount}) is below the expected ≥20 baseline ` +
        `(research Pitfall 5). The parser may have dropped [PRÜFEN] markers.`,
    );
  }

  return {
    states: stateRows.length,
    authorities: authorityRows.length,
    documentTypes: docTypeRows.length,
    regierungsbezirke: rbzRows.length,
    needsReviewCount,
    parseCallsMade,
    cacheHit,
  };
}

// ---------------------------------------------------------------------------
// CLI entry (only when invoked directly via tsx).
// Use fileURLToPath rather than string comparison — paths containing spaces or
// `~` get URL-encoded in import.meta.url but not in process.argv[1].
// ---------------------------------------------------------------------------
const invokedDirectly = (() => {
  try {
    const thisFile = fileURLToPath(import.meta.url);
    const entryFile = process.argv[1]
      ? path.resolve(process.argv[1])
      : undefined;
    return entryFile ? thisFile === entryFile : false;
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  const force = process.argv.includes("--force");
  const skipParse = process.argv.includes("--skip-parse");
  seedBehoerden({ force, skipParse })
    .then((res) => {
      console.log("[seed-behoerden] done:", JSON.stringify(res));
      process.exit(0);
    })
    .catch((e) => {
      console.error("[seed-behoerden] FAILED:", e);
      process.exit(1);
    });
}
