---
phase: 04-laufliste-generation-cases
plan: 04
subsystem: laufliste-generate-action
tags: [server-action, laufliste, resolver, transaction, composer]

requires:
  - phase: 04-laufliste-generation-cases
    plan: 02
    provides: caseTable / caseDocument / ownership-scoped getCaseForUser + listCaseDocuments
  - phase: 04-laufliste-generation-cases
    plan: 03
    provides: LauflisteInput types, renderLaufliste, writeLauflisteToDisk, endbeglaubigungFor, UAE_EMBASSY_BERLIN, slugifyPersonName
  - phase: 03-behoerden-resolver-review
    plan: XX
    provides: resolveAuthority + document_review.corrected_fields JSON shape

provides:
  - "buildLauflisteInput(caseId, userId, db, opts?) — pure composer that joins case/case_document/document_review and re-runs the authority resolver per document (D-18) to produce the LauflisteInput render contract"
  - "generateLauflisteAction(caseId) — Server Action orchestrating auth + ownership + precondition gates (EMPTY_CASE, UNREVIEWED_DOCS) + render + disk write + atomic INSERT laufliste / UPDATE case.status='pdf_generated'"
  - "countUnapprovedDocsInCase(caseId, db) — D-17 precondition query"
  - "listLauflistenForCase(caseId, userId, db) — DESC-ordered owner-scoped list for Plan 05 UI"
  - "getLauflisteForDownload(caseId, lauflisteId, userId, db) — triple-scoped row descriptor for Plan 06 download Route Handler (returns pdfStoragePath, personName, personSlug, generatedDate)"

affects:
  - none (fully additive; no existing code modified)

tech-stack:
  added: []
  patterns:
    - "Pure composer (buildLauflisteInput) decoupled from Server Action so the happy-path logic is unit-testable without auth/Next mocking (matches Phase 3 Plan 03 resolver precedent)"
    - "Injectable resolver seam (opts.resolver) for per-document invocation counter assertions — avoids vi.mock at module scope"
    - "Discriminated-union result { ok: true | false, error } with all user errors as typed string literals (no throws on user-reachable paths)"
    - "Synchronous better-sqlite3 db.transaction with .run() inside — same pattern as lib/review/actions.ts + lib/cases/actions.ts (async inside sync tx throws)"
    - "Render BEFORE write BEFORE transaction — render failure never touches disk; transaction failure leaves an orphan file (not a dangling FK)"
    - "Tolerant fallback for resolver not_found / ambiguous: emit an empty authority block with needsReview=true so [PRÜFEN] pill surfaces the gap instead of aborting generation"

key-files:
  created:
    - lib/laufliste/build-input.ts
    - lib/laufliste/build-input.test.ts
    - lib/laufliste/actions.ts
    - lib/laufliste/actions.test.ts
    - lib/laufliste/queries.ts
  modified: []

decisions:
  - "Chose Plan 03's `exception-apostille` kind for Führungszeugnis Vorbeglaubigung (not 'authority' as the plan's inline action body suggested) — the plan's own must-have truths list says 'Führungszeugnis -> exception-apostille' and the render layer (DocumentSection in pdf/sections.tsx) only short-circuits steps 2-3 when v.kind === 'exception-apostille'. This keeps the Apostille flow displayed via the 'Endbeglaubigung (Apostille)' BfJ section + 'Sonderregelung' copy."
  - "Made buildLauflisteInput return null ONLY for owner/existence failures. Empty case (zero documents) returns an input with documents=[] so the caller can distinguish NOT_FOUND from EMPTY_CASE — the action layer checks .documents.length to emit the correct discriminated error."
  - "Added countUnapprovedDocsInCase as a dedicated precondition query instead of augmenting buildLauflisteInput with review_status: keeps the composer's contract focused on rendering concerns; D-17 becomes a clean fast-fail check between buildLauflisteInput and renderLaufliste."
  - "For resolver not_found, emit a placeholder authority block with needsReview=true (not a hard error). Rationale: generating a Laufliste with an empty Vorbeglaubigung + visible [PRÜFEN] flag is more useful to the operator than refusing generation when one of many documents has a Behörden-DB gap. The action layer could be tightened later if policy changes (e.g., RULE: refuse if any doc lookup=not_found)."
  - "Queries live in a separate module (queries.ts) rather than re-exporting from actions.ts — matches lib/cases/{actions,queries}.ts split. Keeps 'use server' action bundle small and lets Plan 06 download Route Handler import getLauflisteForDownload without pulling the Server Action transaction code."
  - "Did NOT revert the case.status write on render failure (the status was 'open' before, so the rollback is a no-op: render throws before the transaction opens). The ordering render -> write -> transaction guarantees atomicity without needing an explicit rollback path."

metrics:
  tasks_completed: 2
  tests_added: 24
  files_created: 5
  files_modified: 0
  duration: "~45 minutes"
  completed_date: "2026-04-17"

---

# Phase 4 Plan 04: Laufliste Generate Action Summary

One-liner: wired Plan 02 cases + Plan 03 PDF renderer into a single
`generateLauflisteAction` Server Action that re-resolves authorities
per document (D-18), enforces D-17 preconditions, and atomically
persists the PDF + laufliste row + case status transition.

## What Was Built

### `lib/laufliste/build-input.ts` (Task 1)

Pure composer that takes `(caseId, userId, db, opts?)` and returns a
`LauflisteInput | null`. Performs:

1. Ownership gate via `case.id = caseId AND case.user_id = userId`.
   Wrong owner → null (same zero-leak policy as `getCaseForUser`).
2. LEFT JOIN of `case_document` with `document_review` ordered by
   `case_document.position ASC` to read each doc's corrected fields.
3. Per-document exception routing:
   - `/führungszeugnis/i` → `vorbeglaubigung: exception-apostille`,
     endbeglaubigung = BfJ (via `endbeglaubigungFor`), legalisation = null.
   - `/reisepass/i` → `vorbeglaubigung: exception-reisepass`,
     endbeglaubigung = null, legalisation = null.
   - Otherwise → re-run `resolveAuthority()` with corrected fields,
     map to `VorbeglaubigungBlock {kind:'authority'}`,
     endbeglaubigung = BVA, legalisation = UAE Embassy.
4. Date formatting: ISO `yyyy-MM-dd` → `dd.MM.yyyy` (pure regex;
   `date-fns` intentionally not used for this 4-line util).
5. Authority `address TEXT` column split on `\n` into the `string[]`
   shape the render layer expects.

Accepts `opts.resolver` for test injection (Phase 3 Plan 03 precedent).
Tolerates resolver `not_found` / `ambiguous` results by emitting a
placeholder authority block with `needsReview=true` so the PDF still
renders with a visible `[PRÜFEN]` pill.

### `lib/laufliste/queries.ts` (Task 2)

Three ownership-scoped queries:

- `countUnapprovedDocsInCase(caseId, db)` — D-17 precondition count.
- `listLauflistenForCase(caseId, userId, db)` — `generated_at DESC`,
  inner-joined through `case` for ownership predicate.
- `getLauflisteForDownload(caseId, lauflisteId, userId, db)` — single-row
  descriptor for Plan 06 download Route Handler. Returns `null` if any
  of the three IDs don't match (blocks ID-swap attacks per T-04-15).
  Pre-computes `personSlug` via `slugifyPersonName` and `generatedDate`
  in `yyyy-MM-dd` for the RFC 5987 `Content-Disposition` filename.

### `lib/laufliste/actions.ts` (Task 2)

`generateLauflisteAction(caseId)` Server Action:

1. `auth.api.getSession` → `{ok:false, error:'UNAUTHORIZED'}` if no session.
2. `buildLauflisteInput(caseId, session.user.id, db)` →
   - null: `{ok:false, error:'NOT_FOUND'}`
   - `documents.length === 0`: `{ok:false, error:'EMPTY_CASE'}`
3. `countUnapprovedDocsInCase` > 0 → `{ok:false, error:'UNREVIEWED_DOCS'}`
4. `renderLaufliste(input)` in a try/catch → `{ok:false, error:'RENDER_FAILED', details}`
5. `writeLauflisteToDisk(caseId, bytes)` → disk write (storage module
   adds timestamp suffix + returns repo-relative path).
6. Sync `db.transaction`:
   - `INSERT laufliste` with `documentCount` + `fileSize`.
   - `UPDATE case SET status='pdf_generated', updated_at=now`.
7. `revalidatePath('/cases/:id')` + `/cases` (swallowed outside render
   context).
8. Return `{ok:true, data:{lauflisteId}}`.

## Tests (24 total, all passing)

### `build-input.test.ts` (11 tests)

- `returns null when case not found`
- `returns null when case belongs to different user`
- `composes single normal document with resolver authority + BVA + Embassy`
- `Führungszeugnis routes to exception-apostille with BfJ + null legalisation`
- `Reisepass routes to exception-reisepass with null endbeglaubigung + null legalisation`
- `re-invokes resolveAuthority per document (D-18)` (counter-injected mock)
- `orders documents by case_document.position ASC`
- `formats ausstellungsdatum as dd.MM.yyyy`
- `passes needs_review flag from resolver into VorbeglaubigungBlock`
- `returns an empty documents array when case has no documents`
- `falls back to resolver-derived vorbeglaubigung when authority not found`

### `actions.test.ts` (13 tests)

Mocks `./pdf/render` and `./storage` so unit tests run in <2s total
without spawning the real React-PDF renderer. The real renderer is
exercised in `pdf/render.test.ts` (Plan 03) and will be again in the
Plan 06 integration test.

- `returns UNAUTHORIZED without session`
- `returns NOT_FOUND for non-existent caseId`
- `returns NOT_FOUND for wrong-owner caseId`
- `returns EMPTY_CASE when case has zero documents`
- `returns UNREVIEWED_DOCS when any document has review_status='pending'`
- `renders PDF, writes file, inserts laufliste row, sets case.status='pdf_generated'`
- `regenerating creates a NEW laufliste row (D-14 immutability)`
- `returns RENDER_FAILED and does NOT persist any row or case-status change`
- `listLauflistenForCase returns rows ordered by generated_at DESC scoped to owner`
- `listLauflistenForCase returns empty array for wrong-owner case`
- `getLauflisteForDownload returns download descriptor for owner match`
- `getLauflisteForDownload returns null for cross-owner lookup`
- `getLauflisteForDownload returns null for cross-case lauflisteId mismatch`

## Verification Results

- `npx vitest run lib/laufliste` — 4 files, 36 tests, all pass.
- `npx vitest run lib` — 15 files, 134 tests, all pass.
- `npx tsc --noEmit` — clean.
- Grep (per plan verification block):
  - `resolveAuthority` imported in build-input.ts — present (line 11).
  - `db.transaction` in actions.ts — present (line 106).
  - `pdf_generated` status write in actions.ts — present (line 118).
  - Render failure path does NOT call `writeLauflisteToDisk` (ordering:
    render at line 82 inside try/catch, write at line 94 AFTER).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Inconsistency] Plan's own truths vs. inline action body on Führungszeugnis Vorbeglaubigung kind**

- **Found during:** Task 1 implementation.
- **Issue:** The plan's must-have truths list says
  `buildLauflisteInput correctly branches Führungszeugnis -> exception-apostille`,
  but the inline `<behavior>` and `<action>` prose on lines 107 + 129
  describe Führungszeugnis as `vorbeglaubigung.kind='authority'`.
- **Resolution:** Followed the truths list (which matches Plan 03's
  render contract — `DocumentSection` in `pdf/sections.tsx` only
  short-circuits steps 2-3 when `v.kind === 'exception-apostille'`, and
  Plan 03's `render.test.ts` fixture also uses
  `vorbeglaubigung: { kind: "exception-apostille" }` for Führungszeugnis).
- **Files modified:** `lib/laufliste/build-input.ts`,
  `lib/laufliste/build-input.test.ts`.
- **Commits:** `fd6b387`, `99f5ee8`.

None of this changed the plan's success criteria or acceptance tests.

## Known Stubs

None. All values flowing to the PDF renderer are real — either from the
DB (case + document_review + behoerden_authority) or from the static
authority blocks Plan 03 already established (BVA, BfJ, UAE Embassy).
The Plan 03 static authority fields carry their own `@assumed` caveats
(documented in that plan's SUMMARY); Plan 04-04 does not regress that
status.

## Deferred Issues

Full-suite `npx vitest run` (30 files) shows 4 pre-existing failing
suites outside this plan's scope — `__tests__/auth/*` (session-cookie,
sign-in, sign-out) and `__tests__/seed/seed-user.test.ts > exits
non-zero when password is shorter than 12 chars`. These ALSO fail on
`main` at the pre-04-04 baseline (re-confirmed via `git stash` + fresh
run: 10 failed suites baseline → 4 failed with 04-04 changes present).
Root cause is cross-suite env-variable / module-resolution interference
when running the full suite in parallel; isolated runs of the affected
files pass. Logged in
`.planning/phases/02-document-upload-ai-extraction/deferred-items.md`
(original Phase 2 deferral ticket). Not caused or worsened by 04-04.

## Authentication Gates

None. All auth is handled via the existing `auth.api.getSession` flow;
no external auth setup was required for this plan.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: filesystem | lib/laufliste/actions.ts | New surface: Server Action writes PDF bytes to `data/lauflisten/` via `writeLauflisteToDisk`. Mitigation already in place — `caseId` is a server-generated UUID (never user-controlled path segment), storage module has `T-04-10` comment. Behavior is fully in-scope of the plan's threat model (T-04-15 + T-04-18). |

No net-new threat surface beyond what the plan's `<threat_model>` block
already called out.

## Self-Check: PASSED

- `lib/laufliste/build-input.ts` — FOUND.
- `lib/laufliste/build-input.test.ts` — FOUND.
- `lib/laufliste/actions.ts` — FOUND.
- `lib/laufliste/actions.test.ts` — FOUND.
- `lib/laufliste/queries.ts` — FOUND.
- Commit `fd6b387` (test RED 1) — FOUND.
- Commit `99f5ee8` (feat GREEN 1) — FOUND.
- Commit `a281e16` (test RED 2) — FOUND.
- Commit `0d7e4a8` (feat GREEN 2) — FOUND.
