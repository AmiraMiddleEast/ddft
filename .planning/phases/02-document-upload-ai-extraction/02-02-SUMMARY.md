---
phase: 02-document-upload-ai-extraction
plan: 02
subsystem: database
tags: [drizzle, sqlite, schema, migration, better-sqlite3]

requires:
  - phase: 01-foundation-authentication
    provides: "user table (better-auth), db/client.ts with WAL+FK pragmas, drizzle-kit toolchain, initial migration 0000"
provides:
  - document table with (user_id, sha256) unique dedup index
  - extraction table with (document_id, field_name) unique index and enum CHECK constraints
  - extraction_log table for Claude cost/token audit trail
  - Drizzle TS enums + relations for all three tables
  - Generated migration 0001_many_glorian.sql applied to data/angela.db
affects: [02-03, 02-04, 02-05, 02-06, 02-07, phase-03-review-edit, phase-04-laufliste]

tech-stack:
  added: []
  patterns:
    - "Drizzle enum pattern: text() with { enum } for TS inference + check() SQL constraint for DB-level enforcement"
    - "SHA-256 dedup scoped per user via compound unique index (user_id, sha256)"
    - "ON DELETE CASCADE all the way down: user -> document -> extraction / extraction_log"
    - "Append-only schema edits (never overwrite better-auth tables)"

key-files:
  created:
    - drizzle/0001_many_glorian.sql
    - drizzle/meta/0001_snapshot.json
  modified:
    - db/schema.ts
    - drizzle/meta/_journal.json

key-decisions:
  - "Layered enum enforcement: Drizzle { enum } for TS inference AND SQL CHECK for DB-level safety, per 02-RESEARCH.md guidance"
  - "Compound UNIQUE (user_id, sha256) — not just sha256 — scopes dedup per user (CONTEXT D-08) even though the app is single-user today"
  - "Used drizzle-kit push --force fallback because drizzle-kit migrate could not reconcile Phase 1's push-applied 0000 migration with the new 0001; Phase 1 established push as the dev-DB apply path"
  - "Kept 0000 + 0001 SQL + meta snapshots in drizzle/ as source of truth for VPS deployment reproducibility"

patterns-established:
  - "Every new Phase-2 table uses timestamp_ms columns with `(cast(unixepoch('subsecond') * 1000 as integer))` default (copied from Phase 1 timestamp pattern)"
  - "relations() blocks colocated with their table definitions"

requirements-completed: [UPLD-01, UPLD-02, EXTR-01, EXTR-02]

duration: 4m
completed: 2026-04-17
---

# Phase 2 Plan 02: Drizzle Schema for Document Upload + Extraction Summary

**Three new SQLite tables (document, extraction, extraction_log) with SHA-256 dedup, per-field extraction rows, and cost-tracking log — wired to the Phase 1 user table via cascade FKs and applied to data/angela.db.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-17T04:40:41Z
- **Completed:** 2026-04-17T04:44:32Z
- **Tasks:** 2
- **Files modified:** 4 (db/schema.ts, drizzle/0001_many_glorian.sql, drizzle/meta/0001_snapshot.json, drizzle/meta/_journal.json)

## Accomplishments

- Appended `document`, `extraction`, `extraction_log` Drizzle tables to `db/schema.ts` without touching the existing better-auth tables (user, session, account, verification).
- Added const arrays + TS types for `EXTRACTION_STATUS`, `CONFIDENCE`, `FIELD_NAMES` so downstream plans get compile-time safety on enum values.
- Enforced enums at the DB level via three `CHECK` constraints (`document_status_ck`, `extraction_confidence_ck`, `extraction_field_ck`) — not just at the TS layer.
- Created `UNIQUE (user_id, sha256)` on `document` (CONTEXT D-08 dedup) and `UNIQUE (document_id, field_name)` on `extraction` (D-16 one row per field).
- `ON DELETE CASCADE` foreign keys all the way down (user → document → extraction / extraction_log).
- Wired `relations()` for Drizzle query API (documentRelations, extractionRelations, extractionLogRelations).
- Generated `0001_many_glorian.sql` via `drizzle-kit generate` and applied it to `data/angela.db` so Plans 03 and 04 can now insert rows.

## Task Commits

Each task was committed atomically:

1. **Task 1: Append document/extraction/extraction_log tables to db/schema.ts** — `0564455` (feat)
2. **Task 2: Generate + apply Drizzle migration** — `c2dac96` (chore)

## Files Created/Modified

- `db/schema.ts` — Added 3 sqliteTable exports, 3 const arrays + TS types, 3 relations exports; widened drizzle-orm/sqlite-core import to include `real`, `uniqueIndex`, `check`.
- `drizzle/0001_many_glorian.sql` — Generated CREATE TABLE + CREATE INDEX statements for the three new tables (committed as deployment source of truth).
- `drizzle/meta/0001_snapshot.json` — Drizzle snapshot for migration diffing.
- `drizzle/meta/_journal.json` — New entry `{ idx: 1, tag: "0001_many_glorian" }`.

## Verification Evidence

- `sqlite3 data/angela.db ".tables"` → `account __drizzle_migrations document extraction extraction_log session user verification` (7 expected + 1 tracker).
- `.schema document` confirms `FOREIGN KEY ... REFERENCES user(id) ON DELETE cascade` and `CHECK(... IN ('pending','extracting','done','error'))`.
- `.indexes document` includes `document_user_sha_uniq`.
- `.indexes extraction` includes `extraction_doc_field_uniq`.
- Duplicate insert test: two inserts with same `(user_id, sha256)` → `UNIQUE constraint failed: document.user_id, document.sha256` (exit 1). Confirmed DB-level dedup.
- `npx tsc --noEmit -p tsconfig.json` exits 0.
- `npx vitest run` → 9 files / 21 tests passing.

## Decisions Made

- **Layered enum enforcement** (TS + SQL CHECK): Drizzle's `text("x", { enum })` gives only TS inference, not runtime DB enforcement. Added `check()` constraints as the second layer per 02-RESEARCH.md so a raw INSERT bypassing Drizzle still can't corrupt enum columns.
- **Compound (user_id, sha256) unique**, not just `sha256`: CONTEXT D-08 scopes dedup per user. Matches multi-user futures even though V1 is single-user.
- **Fell back to `drizzle-kit push --force`** after `drizzle-kit migrate` stalled. Phase 1's STATE.md decision log already established push as the canonical dev-DB apply path (`drizzle-kit push --force materializes data/angela.db, but drizzle-kit generate output is committed as source of truth for VPS deployment`). Plan 02-02 explicitly permits this fallback.

## Deviations from Plan

None - plan executed exactly as written.

The plan's `action` block for Task 2 explicitly allowed `drizzle-kit push --force` as a documented fallback when `drizzle-kit migrate` doesn't apply cleanly, so using it is not a deviation.

## Issues Encountered

- `drizzle-kit migrate` wrote the `__drizzle_migrations` tracker table but emitted no output and didn't apply the 0001 SQL — almost certainly because the Phase 1 `0000` migration was originally applied via `push --force`, so the migrator saw a state mismatch. Resolved per plan by invoking `drizzle-kit push --force` instead. The generated SQL + snapshot are still committed for VPS reproducibility.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 02-03 (upload Server Action) and 02-04 (extraction) can now write to `document`, `extraction`, `extraction_log`.
- Dedup flow (hash-before-write) is unblocked — the unique index is in place.
- Cost auditing via `extraction_log` is unblocked for Plan 04.
- No blockers.

## Self-Check

Verifying claims before handoff:

```
FOUND: db/schema.ts
FOUND: drizzle/0001_many_glorian.sql
FOUND: drizzle/meta/0001_snapshot.json
FOUND: drizzle/meta/_journal.json (modified)
FOUND commit: 0564455
FOUND commit: c2dac96
sqlite3 data/angela.db ".tables" → document, extraction, extraction_log PRESENT
tsc --noEmit → exit 0
vitest run → 21/21 passing
UNIQUE(user_id, sha256) duplicate-insert test → blocked with "UNIQUE constraint failed"
```

## Self-Check: PASSED

---
*Phase: 02-document-upload-ai-extraction*
*Completed: 2026-04-17*
