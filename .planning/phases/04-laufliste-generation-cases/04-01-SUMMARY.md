---
phase: 04-laufliste-generation-cases
plan: 01
subsystem: database
tags: [schema, drizzle, sqlite, pdf, shadcn, react-pdf, migrations]

requires:
  - phase: 01-foundation-authentication
    provides: user table + better-auth sessions (caseTable.userId, laufliste.userId FKs)
  - phase: 02-document-upload-ai-extraction
    provides: document table + review_status (caseDocument.documentId FK, cases scope to approved docs)
  - phase: 03-review-authority-lookup
    provides: document_review.corrected_fields + resolvedAuthorityId (consumed by future Laufliste resolver)
provides:
  - caseTable (case) Drizzle table with CASE_STATUS enum + check constraint
  - caseDocument table enforcing global one-case-per-doc via uniqueIndex on document_id
  - laufliste table with pdf storage path + generation metadata
  - @react-pdf/renderer 4.5.1 exact-pinned dependency + Turbopack externals config
  - shadcn primitives vendored (dialog, sheet, checkbox, textarea)
affects: [04-02-cases-crud, 04-03-pdf-generation, 04-04-add-docs-picker, 04-05-case-detail-ui, 04-06-download-history]

tech-stack:
  added:
    - "@react-pdf/renderer@4.5.1 (exact-pinned)"
    - "shadcn dialog, sheet, checkbox, textarea primitives (new-york style)"
  patterns:
    - "Table name 'case' (SQL reserved word) exported as caseTable in TS — sqliteTable('case', ...)"
    - "Global uniqueIndex on case_document.document_id enforces one-case-per-doc at DB layer even under race conditions"
    - "@react-pdf/renderer listed in serverExternalPackages to keep Turbopack out of fontkit CJS tree"

key-files:
  created:
    - "drizzle/0004_glossy_luminals.sql (migration)"
    - "drizzle/meta/0004_snapshot.json"
    - "drizzle/meta/0003_snapshot.json (retroactively committed — missing from prior Phase 3 commit)"
    - "components/ui/dialog.tsx"
    - "components/ui/sheet.tsx"
    - "components/ui/checkbox.tsx"
    - "components/ui/textarea.tsx"
  modified:
    - "db/schema.ts (+81 lines — CASE_STATUS, caseTable, caseDocument, laufliste)"
    - "drizzle/meta/_journal.json (idx 4 for 0004_glossy_luminals)"
    - "next.config.ts (serverExternalPackages)"
    - "package.json (@react-pdf/renderer 4.5.1 + radix-ui dialog/sheet/checkbox peer deps via shadcn)"
    - "package-lock.json"

key-decisions:
  - "caseTable exported as `caseTable` (not `case`) — 'case' is a TS keyword; SQL table name stays 'case' via sqliteTable('case', ...)"
  - "uniqueIndex on case_document.document_id + compound uniqueIndex on (case_id, document_id) — first enforces D-02 globally, second is a belt-and-suspenders against duplicate rows within a case"
  - "Re-used Phase 3 dev-DB wipe precedent (drizzle-kit push hit 'index account_userId_idx already exists' mid-transaction) — acceptable because data/angela.db is gitignored; SQL migration file is production source of truth"
  - "serverExternalPackages (not experimental.serverComponentsExternalPackages) — Next 15.5+ stable API; added preemptively before any renderToStream import exists"
  - "Retroactively committed drizzle/meta/0003_snapshot.json — journal idx 3 already referenced it but snapshot was never tracked; fresh clones couldn't run drizzle-kit migrate without it (Rule 3 blocking)"

patterns-established:
  - "Phase 4 schema header: // ======== Phase 4: Laufliste Generation & Cases (D-01, D-02) ========"
  - "Timestamp columns continue subsecond pattern: integer('…_at', { mode: 'timestamp_ms' }).default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)"
  - "Status enums use text({ enum: CONST }) + matching check() SQL constraint (layered enforcement)"

requirements-completed: [LAFL-01, LAFL-02, LAFL-03, CASE-01, CASE-02, CASE-03]

duration: 4min
completed: 2026-04-17
---

# Phase 4 Plan 01: Schema + Dependencies Foundation Summary

**Drizzle schema for case/case_document/laufliste with global one-case-per-doc unique index, @react-pdf/renderer@4.5.1 exact-pinned, and four shadcn primitives (dialog/sheet/checkbox/textarea) vendored — Phase 4 waves 2-6 can now import types, push PDFs, and build UI without further setup.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-17T11:01:57Z
- **Completed:** 2026-04-17T11:05:40Z
- **Tasks:** 3 (all auto)
- **Files modified:** 11 (2 created tables via migration, 1 modified schema, 4 shadcn primitives, 1 next.config, 1 migration SQL, 2 drizzle meta snapshots, package.json + lock)

## Accomplishments
- Three new SQLite tables (`case`, `case_document`, `laufliste`) materialized in `data/angela.db` with all indexes verified via `sqlite3 .indexes case_document`
- Global one-case-per-document invariant (CONTEXT D-02) enforced at DB level via `case_document_doc_uniq` unique index on `document_id`
- `@react-pdf/renderer` 4.5.1 exact-pinned (no caret) matching Phase 1 reproducibility lock; resolvable via `require('@react-pdf/renderer')`
- `next.config.ts` preemptively lists `@react-pdf/renderer` in `serverExternalPackages` (Pitfall 6 — Turbopack vs fontkit CJS)
- Four shadcn primitives vendored under `components/ui/` (dialog, sheet, checkbox, textarea)
- `npx tsc --noEmit` clean; full vitest suite 128/128 green with `BETTER_AUTH_SECRET` set

## Task Commits

1. **Task 1: Add case/case_document/laufliste tables to db/schema.ts** — `4d9913e` (feat)
2. **Task 2: [BLOCKING] drizzle-kit generate + push for Phase 4 schema** — `ed89dda` (feat)
3. **Task 3: Install @react-pdf/renderer@4.5.1 + vendor shadcn primitives** — `b727730` (feat)

**Plan metadata commit:** (to follow — SUMMARY + STATE + ROADMAP)

## Files Created/Modified
- `db/schema.ts` — +81 lines: `CASE_STATUS` + `CaseStatus` type, `caseTable`, `caseDocument`, `laufliste` (no `relations()` blocks; manual joins per plan)
- `drizzle/0004_glossy_luminals.sql` — Migration creating 3 tables + 7 indexes (2 unique on case_document, plus 5 index)
- `drizzle/meta/0004_snapshot.json` + `drizzle/meta/_journal.json` (idx 4)
- `drizzle/meta/0003_snapshot.json` — Retroactively committed (see Deviations)
- `components/ui/dialog.tsx`, `components/ui/sheet.tsx`, `components/ui/checkbox.tsx`, `components/ui/textarea.tsx` — shadcn new-york primitives
- `next.config.ts` — `serverExternalPackages: ["@react-pdf/renderer"]` added above `experimental`
- `package.json` + `package-lock.json` — `@react-pdf/renderer` 4.5.1 exact-pinned; 47 transitive deps (radix-ui + fontkit + textkit tree)

## Decisions Made

See `key-decisions` frontmatter. Salient points:
- Wiped dev DB once (Phase 3 precedent) when `drizzle-kit push` hit mid-transaction state from prior push runs — acceptable since dev DB is gitignored and SQL migration is source of truth for VPS deploy.
- `serverExternalPackages` placed at top-level (Next 15.5+ stable API), not under `experimental` — matches Next 16 convention.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Retroactively committed `drizzle/meta/0003_snapshot.json`**
- **Found during:** Task 2 (migration commit)
- **Issue:** `drizzle/meta/_journal.json` referenced migration idx 3 (`0003_chemical_franklin_richards`) but its corresponding snapshot file was never committed in Phase 3. A fresh clone running `drizzle-kit migrate` or `drizzle-kit generate` would fail because the snapshot chain is broken.
- **Fix:** Included `drizzle/meta/0003_snapshot.json` alongside the new 0004 artifacts in the Task 2 commit.
- **Files modified:** `drizzle/meta/0003_snapshot.json` (new, was untracked)
- **Verification:** `git ls-files drizzle/meta/` now lists all four snapshots; journal + snapshots consistent.
- **Committed in:** `ed89dda` (Task 2 commit)

**2. [Rule 3 - Blocking] Wiped dev DB to recover from `index account_userId_idx already exists`**
- **Found during:** Task 2 (`drizzle-kit push --force`)
- **Issue:** Mid-transaction schema state in `data/angela.db` (residual from earlier Phase 3 push that exited dirty) caused push to abort.
- **Fix:** `rm -f data/angela.db data/angela.db-shm data/angela.db-wal` then re-ran `npx drizzle-kit push --force` — succeeded cleanly.
- **Files modified:** None in git (dev DB is gitignored)
- **Verification:** `sqlite3 data/angela.db ".tables"` lists all 15 tables including the 3 new Phase 4 tables; `.indexes case_document` confirms `case_document_doc_uniq`.
- **Committed in:** N/A (no tracked files changed by this step; plan explicitly sanctions the wipe)

---

**Total deviations:** 2 auto-fixed (both Rule 3 blocking).
**Impact on plan:** Both strictly necessary to make the migration chain usable on clean checkouts and to materialize the dev DB. No scope creep.

## Issues Encountered
- None beyond the two blocking issues above.

## Threat Flags

No new threat surface introduced beyond what the plan's threat model already anticipates. `case.user_id`, `laufliste.user_id`, `case_document.document_id` all FK cascade correctly; no new network endpoints or trust boundaries crossed this plan.

## User Setup Required

None — schema migration applied to dev DB; primitives vendored; dependency installed locally.

## Next Phase Readiness

- **Wave 2 (Plan 04-02 Cases CRUD)** can import `caseTable` from `@/db/schema` and use `Dialog`, `Sheet`, `Checkbox`, `Textarea` from `@/components/ui/*` immediately.
- **Wave 3 (Plan 04-03 PDF generation)** can import `renderToStream`/`renderToBuffer` from `@react-pdf/renderer` in Server Actions; `serverExternalPackages` already configured.
- **Wave 4+ (add-docs picker, case detail)** will rely on the global `case_document_doc_uniq` constraint to detect "doc already in another case" races cleanly.

No blockers. No concerns.

## Self-Check: PASSED

**Files verified:**
- FOUND: db/schema.ts (modified, caseTable exported)
- FOUND: drizzle/0004_glossy_luminals.sql
- FOUND: drizzle/meta/0004_snapshot.json
- FOUND: drizzle/meta/0003_snapshot.json
- FOUND: components/ui/dialog.tsx
- FOUND: components/ui/sheet.tsx
- FOUND: components/ui/checkbox.tsx
- FOUND: components/ui/textarea.tsx
- FOUND: next.config.ts (modified, serverExternalPackages present)

**Commits verified:**
- FOUND: 4d9913e (Task 1 — schema)
- FOUND: ed89dda (Task 2 — migration + push)
- FOUND: b727730 (Task 3 — install + shadcn)

**Automated verification:**
- `npx tsc --noEmit` — clean (zero errors)
- `BETTER_AUTH_SECRET=testsecret… npx vitest run` — 128/128 passed across 24 files
- `sqlite3 data/angela.db ".tables"` — includes case, case_document, laufliste
- `sqlite3 data/angela.db ".indexes case_document"` — includes case_document_doc_uniq
- `node -e "require('@react-pdf/renderer')"` — resolves OK
- `node -e "console.log(require('./package.json').dependencies['@react-pdf/renderer'])"` — prints `4.5.1`

---
*Phase: 04-laufliste-generation-cases*
*Completed: 2026-04-17*
