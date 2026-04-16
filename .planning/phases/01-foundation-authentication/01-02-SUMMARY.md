---
phase: 01-foundation-authentication
plan: 02
subsystem: database
tags: [drizzle, sqlite, better-sqlite3, migrations]
dependency_graph:
  requires:
    - next_16_app_router
  provides:
    - drizzle_client
    - drizzle_kit_config
    - sqlite_pragmas_wal_fk
  affects:
    - 01-03-PLAN (better-auth adapter + schema generation)
    - all_future_phases (DB is shared persistence layer)
tech_stack:
  added:
    - better-sqlite3@12.9.0
    - drizzle-orm@0.45.2
    - drizzle-kit@0.31.10
    - "@types/better-sqlite3@7.6.13"
    - tsx@4.21.0
  patterns:
    - drizzle_better_sqlite3_sync_client
    - cwd_relative_db_path_resolution
    - wal_plus_fk_pragmas_on_every_connection
    - drizzle_kit_generate_migrate_workflow
key_files:
  created:
    - db/client.ts
    - db/schema.ts
    - drizzle.config.ts
    - drizzle/.gitkeep
  modified:
    - package.json
    - package-lock.json
decisions:
  - "Pin better-sqlite3, drizzle-orm, and drizzle-kit at exact versions (no caret) — matches CLAUDE.md lockfile intent and RESEARCH.md §Standard Stack."
  - "Use path.resolve(process.cwd(), DATABASE_URL) rather than passing the raw relative URL to Database() — mitigates RESEARCH.md P-04 (cwd-dependent path breakage across dev/build/test contexts)."
  - "Enable journal_mode = WAL + foreign_keys = ON on every connection open (not one-time migration) — WAL for concurrent reads during writes, FK because SQLite defaults FK enforcement to OFF."
  - "Keep db/schema.ts as a placeholder (export {}) — Plan 03 will overwrite with better-auth CLI output; hand-writing the auth schema is flagged as anti-pattern in RESEARCH.md §Pattern 2."
  - "Add db:generate / db:migrate / db:push / db:studio npm scripts for drizzle-kit — db:studio is the GUI inspection tool for future debugging."
metrics:
  duration_minutes: 4
  tasks_completed: 2
  files_created: 4
  files_modified: 2
  commits: 2
  completed_at: "2026-04-16T22:34:08Z"
---

# Phase 01 Plan 02: Database Layer (Drizzle + better-sqlite3) Summary

One-liner: Installed better-sqlite3 12.9 and Drizzle ORM 0.45 at exact pinned versions, wrote a Drizzle client (`db/client.ts`) that opens `data/angela.db` with WAL journaling and foreign-key enforcement, and configured drizzle-kit (`drizzle.config.ts`) for migrations — schema file is an empty placeholder that Plan 03's better-auth CLI will overwrite.

## What Was Built

### Task 1: DB dependencies + drizzle.config.ts + placeholder schema
- Installed exact pinned versions:
  - `better-sqlite3@12.9.0` and `drizzle-orm@0.45.2` as dependencies (`--save-exact`)
  - `drizzle-kit@0.31.10`, `@types/better-sqlite3@7.6.13`, and `tsx@4.21.0` as devDependencies (`--save-exact`)
- Added four `db:*` npm scripts to `package.json`:
  ```json
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:push": "drizzle-kit push",
  "db:studio": "drizzle-kit studio"
  ```
- Created `drizzle.config.ts` at repo root per research CE-02:
  ```typescript
  import { defineConfig } from "drizzle-kit";

  export default defineConfig({
    out: "./drizzle",
    schema: "./db/schema.ts",
    dialect: "sqlite",
    dbCredentials: {
      url: process.env.DATABASE_URL ?? "data/angela.db",
    },
  });
  ```
- Created placeholder `db/schema.ts` (4 lines, `export {};`) — Plan 03 overwrites via `npx @better-auth/cli generate --output db/schema.ts`.
- Created `drizzle/.gitkeep` so the migrations output directory exists on clone.
- Verified `.gitignore` (written in Plan 01) already covers `*.db`, `*.db-journal`, `*.db-wal`, `*.db-shm`, and `data/*` except `data/.gitkeep`. No change needed.

Commit: `4d04985` — `chore(01-02): install drizzle + better-sqlite3 and add drizzle.config`

### Task 2: Drizzle client with pragmas and path resolution
- Created `db/client.ts` per research CE-01:
  ```typescript
  import Database from "better-sqlite3";
  import { drizzle } from "drizzle-orm/better-sqlite3";
  import path from "node:path";
  import * as schema from "./schema";

  // Resolve DB path against process.cwd() so relative paths in DATABASE_URL
  // always resolve to the project root regardless of caller context.
  // See RESEARCH.md Pitfall P-04.
  const dbPath = path.resolve(
    process.cwd(),
    process.env.DATABASE_URL ?? "data/angela.db"
  );

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  export const db = drizzle(sqlite, { schema });
  export type Db = typeof db;
  ```
- No DB file created yet on disk — `better-sqlite3` only opens the file when actually connected; Plan 03's migration run will materialize `data/angela.db` after the schema exists.

Commit: `bbb5e87` — `feat(01-02): add Drizzle + better-sqlite3 client with WAL and FK pragmas`

## Deviations from Plan

None. Plan 02 executed exactly as written — versions, file paths, and contents match the PLAN.md spec verbatim. No auto-fix rules triggered.

## Authentication Gates

None. No auth required for npm install, file writes, or TypeScript compilation.

## Installed Versions (npm list)

```
angela@0.1.0
+-- @types/better-sqlite3@7.6.13
+-- better-sqlite3@12.9.0
+-- drizzle-kit@0.31.10
| `-- tsx@4.21.0 deduped
+-- drizzle-orm@0.45.2
| +-- @types/better-sqlite3@7.6.13 deduped
| `-- better-sqlite3@12.9.0 deduped
+-- tsx@4.21.0
`-- vitest@4.1.4
  `-- vite@8.0.8
    `-- tsx@4.21.0 deduped
```

All core versions exact per plan. No patch-level drift.

## Native-build Notes (Pitfall P-03)

`npm install better-sqlite3@12.9.0` completed cleanly on macOS arm64 / Node 22.20.0:

- `npm warn deprecated prebuild-install@7.1.3: No longer maintained` — benign transitive warning from better-sqlite3's install pipeline. Does not affect the prebuilt binary resolution; better-sqlite3 12.9.0 ships a prebuilt darwin-arm64 binary that was downloaded successfully. No `node-gyp` invocation needed on this platform.
- No `gyp ERR!` output, no dlopen failures, no C++ toolchain compilation triggered.
- When deploying to the VPS target (D-06), the first `npm install` should again auto-select a Linux prebuilt binary; fallback compilation requires `build-essential` + `python3` (already a standard VPS dependency). Document in README before Phase 1 sign-off.

Secondary deprecations during devDep install (`@esbuild-kit/core-utils`, `@esbuild-kit/esm-loader` merged into tsx) are informational — tsx 4.21.0 is the modern successor and is what was pinned.

`npm audit` reports 4 moderate-severity vulnerabilities after this install — all transitive through `drizzle-kit`'s tooling tree (dev-only, not runtime). Not a Phase 1 blocker; revisit during a dependency-audit pass before production.

## File Contents Summary

### drizzle.config.ts
7 lines, exports a `defineConfig` block with:
- `out: "./drizzle"` — migrations output directory (Plan 03 will populate)
- `schema: "./db/schema.ts"` — schema source (placeholder for now)
- `dialect: "sqlite"` — required by drizzle-kit for SQL dialect selection
- `dbCredentials.url: process.env.DATABASE_URL ?? "data/angela.db"` — allows ENV override, defaults to project-root path

### db/client.ts
19 lines:
- Imports `Database` (better-sqlite3), `drizzle` (drizzle-orm/better-sqlite3), `path` (node builtin), and `schema` (re-export of placeholder)
- Resolves path via `path.resolve(process.cwd(), process.env.DATABASE_URL ?? "data/angela.db")` — P-04 mitigation
- Opens sync SQLite handle, applies `journal_mode = WAL` and `foreign_keys = ON` pragmas
- Exports `db` (typed Drizzle instance with `schema` type param) and `Db` type alias

### db/schema.ts
4 lines — comment + `export {};`. Zero runtime shape; exists only so `import * as schema from "./schema"` in `db/client.ts` resolves.

### drizzle/.gitkeep
Empty file. Tracks an empty directory so Plan 03's `drizzle-kit generate` has an existing output target.

## Verification Results

- `node -e "const p=require('./package.json'); ..."` → prints `OK` (all three core versions match exact strings `12.9.0`, `0.45.2`, `0.31.10`)
- `test -f drizzle.config.ts && test -f db/schema.ts && test -f drizzle/.gitkeep && test -f db/client.ts` → all present
- `grep "dialect: \"sqlite\"" drizzle.config.ts` → matches line 6
- `grep "./db/schema.ts" drizzle.config.ts` → matches line 5
- `grep "journal_mode = WAL" db/client.ts` → matches line 15
- `grep "foreign_keys = ON" db/client.ts` → matches line 16
- `grep "process.env.DATABASE_URL" db/client.ts` → matches line 11
- Multiline regex `path\.resolve\(\s*process\.cwd\(\)` in db/client.ts → matches across lines 9–10 (acceptance criterion for P-04 mitigation; the single-line `grep` used in the plan's bash verify misses this because the expression is formatted across lines)
- `grep "export const db" db/client.ts` → matches line 18
- `grep "export type Db" db/client.ts` → matches line 19
- `npx tsc --noEmit` (full project, uses tsconfig.json with strict + `@types/node`) → exits 0 with no output — zero type errors across the repo including the new files
- `npx drizzle-kit --help` → prints command list (generate, migrate, introspect, push, studio, up, check, drop, export) — tool installed correctly
- `ls *.db` at repo root → no matches (expected; DB file not yet created)
- `git status --short` → clean working tree after both commits

## Known Stubs

**`db/schema.ts`** — intentional placeholder (`export {};`). Will be overwritten in Plan 03 by the better-auth CLI (`npx @better-auth/cli@latest generate --output db/schema.ts`). This stub is explicitly required by the plan and is NOT a data-wiring gap:

- It does not render to UI.
- It does not flow empty data through any component.
- It exists only so `import * as schema from "./schema"` in `db/client.ts` resolves to a valid module.
- Plan 03's dependency graph explicitly requires replacing this file, and the PLAN.md spec (§Interfaces) documents the replacement mechanism.

No other stubs introduced.

## Threat Flags

None. No new security-relevant surfaces beyond what the `<threat_model>` enumerated:
- T-02-01 (path injection) — mitigated as planned via `path.resolve(process.cwd(), …)` with no user-derived input.
- T-02-03 (write contention DoS) — mitigated as planned via `journal_mode = WAL`.
- T-02-04 (untrusted migrations) — deferred to Plan 03 which runs `drizzle-kit generate` (checked-in migrations, not `push`).
- T-02-02 (info disclosure at rest) — accepted per plan; no change.

## Self-Check: PASSED

- FOUND: `/Users/andreaswilmers/Library/Mobile Documents/com~apple~CloudDocs/Claude code/Angela app/db/client.ts`
- FOUND: `/Users/andreaswilmers/Library/Mobile Documents/com~apple~CloudDocs/Claude code/Angela app/db/schema.ts`
- FOUND: `/Users/andreaswilmers/Library/Mobile Documents/com~apple~CloudDocs/Claude code/Angela app/drizzle.config.ts`
- FOUND: `/Users/andreaswilmers/Library/Mobile Documents/com~apple~CloudDocs/Claude code/Angela app/drizzle/.gitkeep`
- FOUND commit: `4d04985` (chore(01-02): install drizzle + better-sqlite3 and add drizzle.config)
- FOUND commit: `bbb5e87` (feat(01-02): add Drizzle + better-sqlite3 client with WAL and FK pragmas)
- FOUND: `npx tsc --noEmit` exits 0 with no output (clean compile across all new files + existing project)
- FOUND: `npx drizzle-kit --help` prints full command list (tool works)
