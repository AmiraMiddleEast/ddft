---
phase: 03-review-authority-lookup
plan: 01
subsystem: database
tags: [drizzle, sqlite, schema, shadcn, select, fastest-levenshtein, migration]

# Dependency graph
requires:
  - phase: 02-document-upload-ai-extraction
    provides: "document table with user_id FK + extraction_status; user table; Drizzle 0.45.2 + better-sqlite3 setup"
provides:
  - "behoerden_state, behoerden_regierungsbezirk, behoerden_document_type, behoerden_authority, document_review tables in db/schema.ts + data/angela.db"
  - "document.review_status (default 'pending') + document.reviewed_at columns + document_review_status_ck CHECK constraint"
  - "REVIEW_STATUS + LOOKUP_STATUS enum constants + derived types exported from db/schema.ts"
  - "fastest-levenshtein@1.0.16 pinned runtime dependency (exact, no caret)"
  - "components/ui/select.tsx shadcn primitive (new-york preset)"
  - "drizzle/0002_aspiring_queen_noir.sql + meta snapshot committed for reproducible VPS deployment"
affects: [03-02-seed-behoerden, 03-03-resolver, 03-04-server-action, 03-05-review-ui, 03-06-integration]

# Tech tracking
tech-stack:
  added:
    - "fastest-levenshtein 1.0.16 (Levenshtein distance for fuzzy slug match)"
    - "shadcn/ui Select primitive (Radix-based, 10 exports)"
  patterns:
    - "Exact-version pinning for deps introduced mid-project (matches Phase 1/2 convention)"
    - "Drizzle schema constants hoisted above table definitions that reference them (REVIEW_STATUS / LOOKUP_STATUS)"
    - "Fresh push via nuke-and-rebuild on dev DB when SQLite table rebuilds conflict with partial state"

key-files:
  created:
    - "components/ui/select.tsx"
    - "drizzle/0002_aspiring_queen_noir.sql"
    - "drizzle/meta/0002_snapshot.json"
  modified:
    - "db/schema.ts"
    - "package.json"
    - "package-lock.json"
    - "drizzle/meta/_journal.json"

key-decisions:
  - "Hoisted REVIEW_STATUS + LOOKUP_STATUS constants above the document table definition so the ALTER (review_status column with enum) can reference them without TDZ issues"
  - "Applied migration via drizzle-kit push --force after nuking the dev DB — a mid-transaction push failure left an orphan __new_document table, and since data/angela.db is gitignored + single-user dev, fresh rebuild is cheaper than surgical SQL repair"
  - "Kept fastest-levenshtein at exact 1.0.16 (no caret) per the Phase 1/2 reproducibility pattern observed in package.json"

patterns-established:
  - "Phase 3 table naming: behoerden_{entity} prefix matches the domain grouping pattern"
  - "FK disposition: cascade on owning relationships (state→rbz, state→auth, auth→docType, docReview→document, docReview→user); set null on optional lookup refs (auth→rbz, docReview→resolvedAuthority)"
  - "CHECK constraints for every TS enum column (extraction_status, review_status, lookup_status) — consistent with Phase 2"

requirements-completed: [REVW-03, REVW-04, LKUP-01, LKUP-02, LKUP-03, LKUP-04]

# Metrics
duration: 5min
completed: 2026-04-17
---

# Phase 3 Plan 1: Schema + Dependencies Summary

**Five new Drizzle tables (behoerden_state/regierungsbezirk/document_type/authority, document_review) + review_status/reviewed_at columns on document, fastest-levenshtein@1.0.16 pinned, and shadcn Select vendored — Phase 3 foundation ready.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-17T09:19:54Z
- **Completed:** 2026-04-17T09:24:14Z
- **Tasks:** 2
- **Files modified:** 7 (2 created + 5 modified including 2 meta)

## Accomplishments
- Five new Behörden + review tables exist in both db/schema.ts AND data/angela.db (12 tables total confirmed via `sqlite3 .tables`)
- `document` table gained `review_status TEXT DEFAULT 'pending'` + `reviewed_at INTEGER` with `document_review_status_ck` CHECK
- `document_review.lookup_status` enforced via `doc_review_status_ck` CHECK over (`matched`, `ambiguous`, `not_found`)
- `fastest-levenshtein@1.0.16` installed + resolvable via `require.resolve`, exact-pinned in package.json
- `components/ui/select.tsx` vendored exporting `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, `SelectValue` (+ 5 more)
- Migration 0002_aspiring_queen_noir.sql + meta snapshot committed (reproducible on VPS)
- `npx tsc --noEmit` clean; `BETTER_AUTH_SECRET=… npx vitest run` → 15 test files, 53 tests passing

## Task Commits

1. **Task 1: Append schema + ALTER document** — `a736f97` (feat)
   - 181 insertions on `db/schema.ts`
   - All 5 tables + 2 columns + 2 CHECKs + 5 relations blocks
2. **Task 2: Install deps + push migration** — `7f934af` (feat)
   - `fastest-levenshtein@1.0.16`, shadcn `select`, Drizzle migration applied

## Files Created/Modified
- `db/schema.ts` — Added REVIEW_STATUS + LOOKUP_STATUS constants (hoisted above document); ALTERed `document` with `reviewStatus` + `reviewedAt` columns and `document_review_status_ck` CHECK; appended 5 new table definitions (behoerdenState, behoerdenRegierungsbezirk, behoerdenDocumentType, behoerdenAuthority, documentReview) with full FK chain + indexes + relations blocks.
- `components/ui/select.tsx` — shadcn new-york preset Select primitive (Radix-based).
- `drizzle/0002_aspiring_queen_noir.sql` — Generated migration: 5 CREATE TABLE + 5 CREATE INDEX + table-rewrite for `document` adding 2 columns + CHECK.
- `drizzle/meta/0002_snapshot.json` — Drizzle meta snapshot for Phase 3 migration.
- `drizzle/meta/_journal.json` — Added Phase 3 migration entry.
- `package.json` / `package-lock.json` — `"fastest-levenshtein": "1.0.16"` (exact pin).

## Decisions Made
- **Constant hoisting:** Placed `REVIEW_STATUS` + `LOOKUP_STATUS` as a "Phase 3 constants (hoisted)" block immediately above Phase 2's EXTRACTION_STATUS. This keeps them in scope for the document ALTER (which uses `enum: REVIEW_STATUS`) while keeping the new Phase 3 table block at the end of the file for append-only readability.
- **Dev-DB reset on push failure:** Initial `npx drizzle-kit push --force` hit a `SqliteError: index account_userId_idx already exists` (drizzle-kit push regenerates all DDL and SQLite rejects duplicate indexes when the DB is already populated). The mid-transaction failure left an orphan `__new_document` table AND dropped `document`. Since `data/*` is gitignored and this is a single-user dev DB, the clean fix was `rm data/angela.db*` → `npx drizzle-kit push --force` → full fresh schema. Production uses `drizzle-kit migrate` (per threat-model disposition T-03-01-03).
- **Exact version pin:** `fastest-levenshtein@1.0.16` installed with `--save-exact` to prevent supply-chain surprise upgrades (T-03-01-01) — consistent with other pinned deps in package.json.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reset dev DB after drizzle-kit push mid-transaction failure**
- **Found during:** Task 2 (migration apply)
- **Issue:** `npx drizzle-kit push --force` hit `SqliteError: index account_userId_idx already exists` because drizzle-kit push regenerates all DDL and SQLite rejects duplicate CREATE INDEX on a non-empty DB. The transaction rolled back but left an orphan `__new_document` table AND dropped `document` in the process.
- **Fix:** Deleted `data/angela.db*` (gitignored; safe per threat register T-03-01-03) and re-ran `npx drizzle-kit push --force`. Clean apply, all 12 tables with correct columns + CHECKs + indexes.
- **Files modified:** `data/angela.db` (gitignored, not committed)
- **Verification:** `sqlite3 data/angela.db ".tables"` shows all 12 tables; `PRAGMA table_info(document)` confirms `review_status` + `reviewed_at`; `.indexes` confirms `authority_lookup_idx`, `rbz_state_slug_uniq`, etc. `npx tsc --noEmit` clean; 53 tests pass.
- **Committed in:** n/a — no file changes (dev DB is gitignored)

---

**Total deviations:** 1 auto-fixed (1 blocking resolution)
**Impact on plan:** Recovery was mechanical; no schema or code changes required. Migration SQL file (`0002_aspiring_queen_noir.sql`) is identical to the originally generated artifact — reproducible on any fresh VPS deployment via `drizzle-kit migrate`.

## Issues Encountered
- Drizzle-kit push on a non-empty DB conflicts with existing indexes. Documented workaround above.

## User Setup Required
None — no external service configuration needed.

## Next Phase Readiness

**Ready for downstream plans (02–06):**
- Plan 02 (seed-behoerden) can now `INSERT INTO behoerden_state/…` without migration work.
- Plan 03 (resolver) can `import { distance } from "fastest-levenshtein"` and query `behoerdenState` / `behoerdenDocumentType` / `behoerdenAuthority`.
- Plan 04 (Server Action) can write `documentReview` rows + set `document.reviewStatus = 'approved'`.
- Plan 05 (review UI) can `import { Select, SelectTrigger, … } from "@/components/ui/select"` and populate from Plan 02's seeded data.
- Plan 06 (integration) can assert all joins + CHECK constraints.

**Blockers / concerns:** None. TypeScript clean; test suite green.

## Self-Check: PASSED

- Created files:
  - FOUND: `components/ui/select.tsx`
  - FOUND: `drizzle/0002_aspiring_queen_noir.sql`
  - FOUND: `drizzle/meta/0002_snapshot.json`
- Commits:
  - FOUND: `a736f97` (Task 1: schema)
  - FOUND: `7f934af` (Task 2: deps + migration)
- DB tables (sqlite3 data/angela.db ".tables"): all 12 present (user, session, account, verification, document, extraction, extraction_log, behoerden_state, behoerden_regierungsbezirk, behoerden_document_type, behoerden_authority, document_review)
- `document.review_status` + `document.reviewed_at`: present
- `package.json` contains `"fastest-levenshtein": "1.0.16"` (exact)
- `npx tsc --noEmit`: clean
- `BETTER_AUTH_SECRET=… npx vitest run`: 15 files / 53 tests passing

---
*Phase: 03-review-authority-lookup*
*Completed: 2026-04-17*
