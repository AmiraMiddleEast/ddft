---
phase: 03-review-authority-lookup
plan: 04
subsystem: api
tags: [server-action, zod, drizzle, better-auth, transaction, sqlite]

# Dependency graph
requires:
  - phase: 01-foundation-authentication
    provides: better-auth session + ownership pattern
  - phase: 02-document-upload-ai-extraction
    provides: document table, extraction rows, Server Action convention (discriminated-union return, sync better-sqlite3 transaction)
  - phase: 03-review-authority-lookup (Plan 01)
    provides: documentReview + behoerdenAuthority tables, review_status column on document
  - phase: 03-review-authority-lookup (Plan 03)
    provides: pure resolveAuthority(corrected, db) resolver
provides:
  - approveAndResolve Server Action (primary "Speichern & Behörde ermitteln" entry point)
  - chooseAmbiguousAuthority Server Action ("Diese Behörde übernehmen" flow)
  - Zod schemas for review inputs (ApproveSchema, CorrectedFieldsSchema, ChooseAuthoritySchema)
  - Discriminated-union result type { ok: true, data: ResolverResult } | { ok: false, error: string }
affects:
  - 03-05 (Review UI wires this action to the form)
  - 03-06 (integration tests exercise this path end-to-end)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server Action = auth gate → Zod → ownership gate → pure work → sync transactional persist"
    - "Upsert semantics for document_review: one row per document, re-approval UPDATEs"
    - "Resolver invoked as pure function from Server Action — no duplicated logic"

key-files:
  created:
    - lib/validations/review.ts
    - lib/validations/review.test.ts
    - lib/review/actions.ts
    - lib/review/actions.test.ts
  modified: []

key-decisions:
  - "Action input is a plain object (not FormData) — tests and the Plan 05 useTransition caller both use typed args, matching the Phase 2 extractDocumentAction(id) signature rather than the older upload action's FormData input."
  - "Upsert path reads the existing row inside the transaction instead of using a UNIQUE index + onConflictDoUpdate — keeps the behavior observable in tests and avoids a schema migration to add UNIQUE(document_id) on document_review."
  - "chooseAmbiguousAuthority does NOT re-run the resolver; it transitions the existing ambiguous row to matched. Matches Open Question 3 in the phase research."
  - "Mocked @/lib/behoerden/resolve in the integration tests instead of seeding a full Behörden fixture — the resolver has its own 11-test suite with the fixture."

patterns-established:
  - "Pattern: Private helper skipped — the two actions share the same gate sequence inline. Refactoring to assertOwnership() was considered and rejected (adds a return-union type helper with no clear gain for two call sites)."
  - "Pattern: crypto.randomUUID() (Web Crypto API, available in Node 20+) used for id generation, consistent with lib/extraction/actions.ts."

requirements-completed: [REVW-02, REVW-03, REVW-04, LKUP-01, LKUP-02, LKUP-03, LKUP-04]

# Metrics
duration: 5min
completed: 2026-04-17
---

# Phase 3 Plan 4: approveAndResolve + chooseAmbiguousAuthority Server Actions Summary

**Transactional Server Actions wrapping the Phase 3 resolver: session + Zod + ownership gates, then upsert document_review + flip document to 'approved' in one sync SQLite transaction; chooseAmbiguousAuthority transitions ambiguous reviews to matched without duplicating rows.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-17T09:52:49Z
- **Completed:** 2026-04-17T09:57:02Z
- **Tasks:** 2
- **Files modified:** 4 (all created)

## Accomplishments

- Zod validation layer for the review flow (3 schemas, 15 behavior tests) reusable by the Plan 05 UI
- approveAndResolve Server Action: 5-step pipeline (session → Zod → ownership → resolver → upsert+flip) with discriminated-union return
- chooseAmbiguousAuthority Server Action: ambiguous → matched transition, idempotent, with ownership + existence gates
- 27 tests total (15 schema + 12 integration) against isolated SQLite via createTestDb()
- Re-approval verified idempotent: two approveAndResolve calls for the same documentId produce exactly one document_review row

## Task Commits

Each task was committed atomically (TDD: RED test was part of the same commit as GREEN implementation since the two were authored together):

1. **Task 1: Zod schema for corrected fields** - `fbb2f7d` (feat)
2. **Task 2: approveAndResolve + chooseAmbiguousAuthority actions + tests** - `58bc8a7` (feat)

## Files Created/Modified

- `lib/validations/review.ts` - CorrectedFieldsSchema, ApproveSchema, ChooseAuthoritySchema + TS types. Shared between Server Action and Plan 05 UI.
- `lib/validations/review.test.ts` - 15 behavior tests covering length caps per field, date regex + empty-string variant, key-set invariant.
- `lib/review/actions.ts` - Two Server Actions. Top-level `"use server"`. Sync db.transaction callback. Discriminated-union return. No throws for user errors.
- `lib/review/actions.test.ts` - 12 integration tests against a fresh SQLite file: auth gate, ownership gate (same-user + cross-user), Zod gate, matched/ambiguous/not_found happy paths, re-approval upsert, ambiguous→matched transition, invalid_choice variants.

## Decisions Made

- Plain-object input (not FormData) — matches Phase 2 extractDocumentAction signature; easier to test and consume from React useTransition.
- Upsert by querying existing row inside the transaction instead of onConflictDoUpdate — avoids a schema migration (no UNIQUE constraint on document_review.document_id exists; Plan 01 didn't add one).
- Mocked resolver in integration tests — avoids seeding the full Behörden fixture twice (the pure resolver has its own 11-test suite).
- chooseAmbiguousAuthority also updates `approvedByUserId` + `approvedAt` — captures who actually decided the ambiguous case for the audit trail (T-03-04-05).

## Deviations from Plan

**None — plan executed exactly as written.** All Must-Have truths satisfied:
- Auth gate returns `unauthorized` before DB touch (Test 1)
- Ownership gate returns `not_found` for foreign docs (Test 2 + Test 12)
- Zod caps all 6 fields (Test 3)
- Single transaction persists document_review + flips document.review_status (Test 4)
- resolved_authority_id null on ambiguous/not_found (Tests 5, 6)
- Re-approval UPDATEs one row, no duplicates (Test 7)
- Discriminated union; no throws for user errors

The plan allowed extracting a shared `assertOwnership(documentId, userId)` helper "if duplication is painful"; it was not painful enough (two call sites, simple shape) so it was not extracted. This matches the plan's "do NOT add new exports beyond the two Server Actions" constraint.

Test count exceeded plan's 10-test target (12 actions tests + 15 schema tests = 27 total) — extra tests cover cross-user chooseAmbiguousAuthority ownership gate, unknown-authorityId invalid_choice, and schema key-set invariant.

## Issues Encountered

**None.** TDD loop cleanly hit RED on the first test run (module not found) and GREEN on the first implementation run. No tsc errors. Full vitest suite (106 tests across 20 files) stays green.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 05 (review UI) can import `approveAndResolve` and `chooseAmbiguousAuthority` from `@/lib/review/actions` and `ApproveSchema` / `CorrectedFields` from `@/lib/validations/review` for client-side `safeParse` before submit.
- Plan 06 integration tests can exercise the full flow: upload → extract → approveAndResolve → assert document_review row shape.
- No blockers for downstream plans.

## Self-Check: PASSED

- `lib/validations/review.ts` — FOUND
- `lib/validations/review.test.ts` — FOUND
- `lib/review/actions.ts` — FOUND
- `lib/review/actions.test.ts` — FOUND
- Commit `fbb2f7d` — FOUND
- Commit `58bc8a7` — FOUND
- `npx tsc --noEmit` — clean (no errors)
- `npm test -- --run` — 20 files / 106 tests passing

No stubs introduced. No threat flags beyond the plan's existing STRIDE register.

---
*Phase: 03-review-authority-lookup*
*Completed: 2026-04-17*
