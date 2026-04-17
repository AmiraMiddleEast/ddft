---
phase: 5
plan: "05-01"
subsystem: schema + deps
tags: [schema, nuqs, foundation]
requires: [phase-04]
provides: [document_version_table, document.version_column, nuqs_lib]
affects: [db/schema.ts, package.json, drizzle/]
tech_stack_added: [nuqs@2.8.9]
key_files_created:
  - drizzle/0005_clammy_wolf_cub.sql
key_files_modified:
  - db/schema.ts
  - package.json
  - package-lock.json
decisions:
  - Pinned nuqs@2.8.9 exact-match (no caret) matching project reproducibility convention
  - documentVersion table uses uniqueIndex(document_id, version_number) for upsert safety
  - document.version defaults to 1 via Drizzle default(1) — existing rows backfilled on push
tasks_completed: 2
task_commits:
  - 9f405ba: feat(05-01) add document_version schema + document.version
  - 5356b71: chore(05-01) install nuqs for URL state
duration: pre-existing
completed: 2026-04-17
---

# Phase 5 Plan 01: Schema + nuqs install Summary

**One-liner:** document_version table + document.version column added via Drizzle schema; nuqs@2 installed for URL state.

## What Was Built

Foundational schema additions for Phase 5 and URL-state library install. Both tasks already committed prior to summary generation (see Recent Commits in STATE.md).

### Database Schema

**`documentVersion` table** (`db/schema.ts`):
- `id TEXT PK`
- `documentId TEXT NOT NULL` → FK `document.id` ON DELETE CASCADE
- `versionNumber INTEGER NOT NULL`
- `storagePath TEXT NOT NULL`
- `sha256 TEXT NOT NULL`
- `size INTEGER NOT NULL`
- `uploadedAt INTEGER NOT NULL` (timestamp_ms, default unixepoch)
- UNIQUE INDEX `doc_version_doc_num_uniq` on `(document_id, version_number)`
- INDEX `doc_version_doc_idx` on `document_id`
- Drizzle `documentVersionRelations` wires back to `document`.

**`document.version`** column added: `INTEGER NOT NULL DEFAULT 1`. Existing rows automatically populated with 1 via the DEFAULT clause on push.

Migration artifacts: `drizzle/0005_clammy_wolf_cub.sql` + snapshot 0005.

### Dependencies

- `nuqs@2.8.9` (exact-pinned). Selected for type-safe search params in URL state per CLAUDE.md (filter/search for /history + admin).

## Verification

- `grep -E "^export const documentVersion" db/schema.ts` — match
- `ls drizzle/0005_*.sql` — lists new migration file
- `grep "nuqs" package.json` — `"nuqs": "2.8.9"`
- `node_modules/nuqs/package.json` — exists

## Deviations from Plan

None — plan executed exactly as written.

## Decisions Made

- Version default=1 at DB layer (not app layer) so existing documents auto-migrate on schema push.
- No backfill script needed: NOT NULL DEFAULT 1 satisfies all existing rows.
- `documentVersion.uploadedAt` uses same `unixepoch('subsecond')*1000` default as existing tables.

## Self-Check: PASSED

- FOUND: db/schema.ts (documentVersion table + relations)
- FOUND: drizzle/0005_clammy_wolf_cub.sql
- FOUND: 9f405ba (feat(05-01): add document_version schema + document.version)
- FOUND: 5356b71 (chore(05-01): install nuqs for URL state)
