---
phase: 03-review-authority-lookup
plan: 02
subsystem: database
tags: [seed, claude, drizzle, parsing, idempotent, behoerden, anthropic, zod]

# Dependency graph
requires:
  - phase: 03-review-authority-lookup
    provides: "Plan 03-01: Drizzle schema for behoerden_state, behoerden_regierungsbezirk, behoerden_document_type, behoerden_authority, document_review + review_status on document"
provides:
  - "scripts/parse-state-with-claude.ts: STATE_PARSE_PROMPT, AuthorityOutput/StateParseOutput Zod schemas, parseStateWithClaude(raw, slugHint), normalizeDocTypeSlug()"
  - "scripts/seed-behoerden.ts: seedBehoerden({force?, skipParse?, cachePath?, sourcePath?, parseState?}) — LOAD-RAW → PARSE (cached) → INSERT (wipe+re-insert in txn)"
  - "data/behoerden-parsed.json: committed 16-state parsed snapshot (synthetic placeholder — regenerate with --force + real ANTHROPIC_API_KEY)"
  - "package.json script: seed:behoerden (tsx scripts/seed-behoerden.ts)"
  - "__tests__/seed/seed-behoerden.test.ts: 4 tests covering first-run, cache-hit, --force, needs_review fidelity (mocked parser)"
affects: [03-03 resolver, 03-04 server action, 03-06 integration tests]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Injected parser via opts.parseState — replaces vi.mock for clean test isolation"
    - "Wipe + re-insert transaction as idempotency primitive (avoids UNIQUE constraint churn on global dedup)"
    - "Three-mode cache: default (hit-or-parse) / --force (always parse) / --skip-parse (cache-only, CI safe)"
    - "CLI entry uses fileURLToPath for paths containing spaces/special chars (project lives under iCloud-synced path)"

key-files:
  created:
    - "scripts/parse-state-with-claude.ts"
    - "scripts/seed-behoerden.ts"
    - "data/behoerden-parsed.json"
    - "__tests__/seed/seed-behoerden.test.ts"
  modified:
    - "package.json (seed:behoerden script)"
    - ".gitignore (allowlist data/behoerden-parsed.json)"

key-decisions:
  - "Seed accepts opts.parseState for test injection — avoids vi.mock brittleness across module reset boundaries"
  - "Idempotency via clean wipe+re-insert in a single transaction (not diff-merge) — simpler and FK-safe"
  - "ANTHROPIC_API_KEY is a placeholder — generated synthetic 16-state data/behoerden-parsed.json so seed+CI run end-to-end without real Claude; flagged as placeholder in notes"
  - "Added --skip-parse flag to CLI for CI / placeholder-key runs (errors loudly if cache missing)"
  - "fileURLToPath-based CLI entry (string file:// comparison broke because iCloud project path contains spaces and ~)"
  - "Put test under __tests__/seed/ (not scripts/) to match seed-user.test.ts convention and existing vitest include glob"
  - "Coerced hat_regierungsbezirke in raw-file zod schema to handle the source's boolean|'' union"

patterns-established:
  - "Seed scripts invoked via tsx (not next-env), CLI entry guarded by fileURLToPath equality"
  - "Seed scripts accept {parseState, cachePath, sourcePath} options to enable hermetic tests without vi.mock"
  - "better-sqlite3 transactions use synchronous .run() chains (no promises inside db.transaction)"

requirements-completed: [LKUP-01, LKUP-02, LKUP-03, LKUP-04]

# Metrics
duration: 7min
completed: 2026-04-17
---

# Phase 3 Plan 02: Behörden Seed Summary

**Claude-driven markdown→structured-JSON Behörden seed with idempotent Drizzle insert, committed 16-state cache, and mock-driven idempotency tests.**

## Performance

- **Duration:** 7 min (474 s)
- **Started:** 2026-04-17T09:28:32Z
- **Completed:** 2026-04-17T13:36:00Z (wall clock includes context-read time in Opus mode)
- **Tasks:** 3
- **Files modified:** 6 (4 created, 2 modified)

## Accomplishments

- Deterministic Behörden seed pipeline ships: `npx tsx scripts/seed-behoerden.ts --skip-parse` populates `behoerden_state` (16), `behoerden_regierungsbezirk` (19), `behoerden_document_type` (8), `behoerden_authority` (188) with 156 `needs_review=1` and 32 special-rules entries.
- `parseStateWithClaude()` isolates the Claude call behind Zod-validated output (AuthorityOutput/StateParseOutput from research §B verbatim) — ready to re-parse the real `behoerden_db.json` by swapping ANTHROPIC_API_KEY and adding `--force`.
- `data/behoerden-parsed.json` committed as the reproducible snapshot (research Pitfall 3), with `.gitignore` allowlist entry so the `data/*` block still protects the DB.
- Test suite: 4 idempotency + fidelity tests pass (first-run, cache-hit, force re-parse, needs_review count). Full vitest suite green — 16 files / 57 tests.

## Task Commits

1. **Task 1: parse-state-with-claude.ts** — `4c2ac5d` (feat)
2. **Task 2: seed-behoerden orchestrator + placeholder cache + npm script** — `e1411f0` (feat)
3. **Task 3: seed-behoerden test suite** — `4203978` (test)

_Plan metadata commit will follow this SUMMARY._

## Files Created/Modified

- `scripts/parse-state-with-claude.ts` — Exports STATE_PARSE_PROMPT (German, `<result>…</result>` envelope, `{{DOKUMENTE_RAW}}` token), `AuthorityOutput`/`StateParseOutput` Zod schemas, `parseStateWithClaude(raw, slugHint)`, `normalizeDocTypeSlug()`. Lazy-initialized Claude client — safe to import without API key.
- `scripts/seed-behoerden.ts` — `seedBehoerden({force?, skipParse?, cachePath?, sourcePath?, parseState?})`. LOAD-RAW (reads object-keyed behoerden_db.json, coerces `hat_regierungsbezirke` boolean|""). PARSE (cache-hit / --force / --skip-parse). INSERT (single `db.transaction` wiping then re-inserting FK-safe order: delete authority→rbz→doc_type→state; insert doc_type (global dedup)→state→rbz→authority). Sanity-counts `needs_review` with `eq()` predicate and warns if below 20. CLI entry uses `fileURLToPath`.
- `data/behoerden-parsed.json` — Synthetic 16-state placeholder (~100 KB). Each state has standesamt-type rows (per-RBz for BY/BW/HE/NRW), plus Bundesamt für Justiz Führungszeugnis entry + Reisepass exception. Flagged as placeholder in notes.
- `__tests__/seed/seed-behoerden.test.ts` — 4 tests, `@vitest-environment node`, temp DB via `createTestDb()`, temp cache path, injected parser via `opts.parseState` (no vi.mock needed).
- `package.json` — Adds `"seed:behoerden": "tsx scripts/seed-behoerden.ts"`.
- `.gitignore` — Adds `!data/behoerden-parsed.json` exception alongside the existing `data/*` block.

## Decisions Made

- **Injected parser over vi.mock** — Exposing `parseState` on the seed opts gives the tests a clean override path without fighting `vi.resetModules`/`vi.doMock` sequencing, and also documents the seam for future fixture injection.
- **Wipe + re-insert idempotency** — Deleting in FK-safe order and re-inserting inside one transaction makes a second run a no-op in data terms, avoids UNIQUE constraint errors on `behoerden_document_type.id` (global dedup across states), and keeps the insert logic straight-line instead of diff-merge.
- **Synthetic placeholder for `data/behoerden-parsed.json`** — The env's ANTHROPIC_API_KEY is `sk-ant-PLACEHOLDER`, so a real 16-state parse isn't possible in this execution. Generated plausible placeholder rows covering all 16 states, all 4 Regierungsbezirk-states, plus Führungszeugnis and Reisepass exceptions per D-06. File is clearly annotated as placeholder — operator regenerates with real key via `npm run seed:behoerden -- --force`.
- **`--skip-parse` flag** — Per the env_notes request. CI can seed into the DB directly from the committed cache without needing the Anthropic key.
- **Test lives under `__tests__/seed/`** — Matches existing `__tests__/seed/seed-user.test.ts` convention and the vitest `include` glob; moving avoids broadening the test discovery config.
- **fileURLToPath for CLI guard** — The project path `.../Library/Mobile Documents/com~apple~CloudDocs/Claude code/Angela app/...` contains spaces and `~` that get URL-encoded in `import.meta.url` but not in `process.argv[1]`, so a naive string comparison always falsed out. Using `fileURLToPath` + `path.resolve` fixes it.
- **Coerced `hat_regierungsbezirke`** — The source JSON has `true` or `""` (empty string) for this field. Raw Zod schema uses a union+transform to yield a strict boolean before it reaches the inserter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] behoerden_db.json is an object, not an array**
- **Found during:** Task 2 (orchestrator)
- **Issue:** Plan's action step declared `RawFileSchema = z.array(RawStateSchema)` with each entry carrying a `bundesland` field. The actual file is `{ "Bayern": {...}, "Berlin": {...}, ... }` — state name is the key, not a value.
- **Fix:** Switched to `z.record(z.string(), RawStateSchema)` and derived `bundesland` from `Object.entries(...)` in the seed.
- **Files modified:** scripts/seed-behoerden.ts
- **Verification:** Seed runs end-to-end; `rawStates.length === 16`.
- **Committed in:** e1411f0 (Task 2)

**2. [Rule 3 - Blocking] hat_regierungsbezirke in source is boolean-or-empty-string**
- **Found during:** Task 2
- **Issue:** Source file uses `true` for four states and `""` (empty string) for the rest. A plain `z.boolean()` would throw for the stadtstaat / flächenstaat entries without RBz.
- **Fix:** Zod union `[boolean, literal(""), null, undefined]` with `.transform(v => v === true)` to coerce to boolean.
- **Files modified:** scripts/seed-behoerden.ts
- **Verification:** Loaded all 16 states; BY/BW/HE/NRW end up with `hat_regierungsbezirke=1`, rest with `0`.
- **Committed in:** e1411f0 (Task 2)

**3. [Rule 3 - Blocking] CLI entry never fired under tsx for spaced iCloud paths**
- **Found during:** Task 2 (first run produced empty output, exit 0)
- **Issue:** `import.meta.url === file://${process.argv[1]}` always false — `import.meta.url` URL-encodes spaces (`%20`) and `~` (`%7E`) but `process.argv[1]` keeps the literal characters.
- **Fix:** `fileURLToPath(import.meta.url)` compared against `path.resolve(process.argv[1])`.
- **Files modified:** scripts/seed-behoerden.ts
- **Verification:** `npx tsx scripts/seed-behoerden.ts --skip-parse` now prints the full run summary and exits 0.
- **Committed in:** e1411f0 (Task 2)

**4. [Rule 3 - Blocking] Test file location incompatible with vitest include glob**
- **Found during:** Task 3
- **Issue:** Plan frontmatter specified `scripts/seed-behoerden.test.ts`, but vitest.config.ts `include` is `["__tests__/**/*.test.{ts,tsx}", "lib/**/*.test.{ts,tsx}"]`. A test under `scripts/` wouldn't be discovered, and broadening the include glob is a project-wide change out of scope for this plan.
- **Fix:** Placed the test at `__tests__/seed/seed-behoerden.test.ts` — same directory as the existing `seed-user.test.ts` — and updated relative imports accordingly. Acceptance criteria wording matches ("Test file exists, passes"); the exact filename path is the only drift.
- **Files modified:** __tests__/seed/seed-behoerden.test.ts (created in new location from start)
- **Verification:** `npm test -- __tests__/seed/seed-behoerden.test.ts --run` → 4 tests pass; full suite green.
- **Committed in:** 4203978 (Task 3)

**5. [Rule 2 - Missing Critical] `.gitignore` would have excluded `data/behoerden-parsed.json`**
- **Found during:** Task 2 (before committing)
- **Issue:** Existing `.gitignore` has `data/*` + `!data/.gitkeep`. Without an exception, the committed cache snapshot (research Pitfall 3) would be silently ignored — CI would then lose the deterministic seed pathway.
- **Fix:** Added `!data/behoerden-parsed.json` alongside the existing exceptions.
- **Files modified:** .gitignore
- **Verification:** `git add data/behoerden-parsed.json` succeeded and the file is tracked in commit `e1411f0`.
- **Committed in:** e1411f0 (Task 2)

---

**Total deviations:** 5 auto-fixed (4 blocking, 1 missing-critical)
**Impact on plan:** All fixes were local, reactive, and directly required to satisfy the stated success criteria. No scope creep; nothing from Phase 3 Plan 03+ pulled in.

## Issues Encountered

- **Placeholder ANTHROPIC_API_KEY.** Unable to run a real 16-state Claude parse in this session (env flagged `sk-ant-PLACEHOLDER`). Mitigated per env_notes with synthetic placeholder data covering all 16 states, Führungszeugnis/Reisepass specials, and RBz for BY/BW/HE/NRW. Operator regenerates with `npm run seed:behoerden -- --force` once a real key is available. Seed script preserves this path verbatim.

## Known Stubs

- `data/behoerden-parsed.json` contains synthetic placeholder authority names/addresses (e.g., "Platzhalter — Regierungspräsidium Oberbayern", "Adresse folgt"). Exception entries (Führungszeugnis via BfJ, Reisepass) are real enough to exercise the resolver's special-rules path. Regeneration via `--force` with a real ANTHROPIC_API_KEY replaces all placeholders in one step. This is documented inline in the notes field of each placeholder row and in the seed's log output.

## User Setup Required

None additional — `ANTHROPIC_API_KEY=sk-ant-PLACEHOLDER` is already in `.env.local` from Phase 2. To regenerate real Behörden data, swap to a live key and run `npm run seed:behoerden -- --force`.

## Next Phase Readiness

- Plan 03-03 (resolver) can query against populated tables immediately; both RBz branches are exercised (BY/BW/HE/NRW have per-rbz rows, others have state-level rows). Führungszeugnis / Reisepass special_rules rows are present so LKUP-03 has data to surface.
- Plan 03-04 (Server Action) has a working DB to `resolveAuthority()` against.
- Plan 03-06 (integration) can rely on `--skip-parse` to hydrate the test DB deterministically.
- No blockers.

## Self-Check

- [x] `scripts/parse-state-with-claude.ts` — FOUND
- [x] `scripts/seed-behoerden.ts` — FOUND
- [x] `data/behoerden-parsed.json` — FOUND (103 KB, 16 state objects)
- [x] `__tests__/seed/seed-behoerden.test.ts` — FOUND (4 tests passing)
- [x] Commit `4c2ac5d` — FOUND
- [x] Commit `e1411f0` — FOUND
- [x] Commit `4203978` — FOUND
- [x] `npm run seed:behoerden -- --skip-parse` — EXIT 0, populates DB with 16/188/8/19/156
- [x] `npm test -- --run` — 16 files / 57 tests passing

## Self-Check: PASSED

---
*Phase: 03-review-authority-lookup*
*Completed: 2026-04-17*
