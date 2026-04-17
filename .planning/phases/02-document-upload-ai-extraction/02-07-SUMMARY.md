---
phase: 02-document-upload-ai-extraction
plan: 07
subsystem: testing
tags: [integration-tests, vitest, server-actions, route-handler, phase2-exit-gate]

requires:
  - phase: 02-document-upload-ai-extraction
    provides: uploadSingleDocumentAction, extractDocumentAction, /api/documents/[id]/pdf Route Handler, document+extraction+extraction_log schema
provides:
  - End-to-end integration test composing upload + extract + query (Claude wrapper mocked)
  - Dedup regression test (same bytes uploaded twice → single document row, second call returns dedup=true)
  - Route Handler ownership + unauth regression tests (cross-user 404, anonymous 401)
  - Idempotent seed script (scripts/seed-extraction-fixture.ts) to populate /documents/{id} for visual QA without burning Claude tokens
affects: [phase-03-laufliste-generation, phase-04-behoerden-admin, phase-05-polish]

tech-stack:
  added: []
  patterns:
    - Integration test uses `@vitest-environment node` and vi.doMock after vi.resetModules to mock @/lib/extraction/claude (Plan 02-04 convention carried forward)
    - Integration test deletes in FK order (extraction_log → extraction → document → user) in beforeEach to avoid cascade ordering issues
    - Session mocking via sessionHolder sentinel + vi.mock('@/lib/auth') — switchable per-test for cross-user scenarios
    - Dev-seed scripts use .ts + tsx loader (matches existing scripts/seed-user.ts convention) instead of .mjs when importing Drizzle modules

key-files:
  created:
    - __tests__/phase2-integration.test.ts
    - scripts/seed-extraction-fixture.ts
  modified: []

key-decisions:
  - "Seed script committed as .ts (invoked via tsx) not .mjs — Node ESM could not cleanly resolve named exports from the Drizzle .ts modules; matches existing scripts/seed-user.ts convention. Documented in the plan's action notes as an explicitly permitted alternative."
  - "Phase 2 exit gate (Task 2) auto-approved under autonomous workflow — visual/browser UAT of the four 02-VALIDATION manual-only behaviors (dropzone UX, batch progress, iframe preview, extraction accuracy) is DEFERRED to operator sign-off with real fixtures + real ANTHROPIC_API_KEY."

patterns-established:
  - "Phase-exit integration test: compose all phase Server Actions end-to-end with the external boundary (Claude SDK) mocked — proves the plan-by-plan unit tests actually wire together"
  - "Route Handler ownership regression tests live in the phase integration suite, not in per-route unit tests — keeps cross-user scenarios with the data that exercises them"

requirements-completed: [UPLD-01, UPLD-02, EXTR-01, EXTR-02]

duration: 10min
completed: 2026-04-17
---

# Phase 2 Plan 07: Phase 2 Integration Tests + Exit Gate Summary

**End-to-end integration suite (upload → extract → query + Route Handler ownership) with Claude mocked, plus idempotent seed script for UAT, closing out Phase 2's document-upload-ai-extraction workstream.**

## Performance

- **Duration:** ~10 min (Task 1 TDD green + Task 2 auto-approved checkpoint + summary)
- **Started:** 2026-04-17T09:20:00Z (approx)
- **Completed:** 2026-04-17T11:17:00Z (summary timestamp)
- **Tasks:** 1 executed (Task 1) + 1 auto-approved (Task 2 checkpoint)
- **Files created:** 2

## Accomplishments

- 4-test integration suite passes: happy path (1 document + 6 extractions + 1 log + cost > 0), dedup (2 uploads → 1 row, `dedup=true`), cross-user 404, unauth 401.
- Claude wrapper (`@/lib/extraction/claude#extractFields`) mocked via vi.mock — zero external API calls, zero token spend in CI.
- Seed script (`scripts/seed-extraction-fixture.ts`) populates a realistic `/documents/{id}` view from `transcript.pdf` without requiring a live Claude key. Idempotent via `onConflictDoNothing`.
- Phase 2 core goal proven: "User can upload PDF documents and receive AI-extracted structured data from them" — wiring end-to-end, with ownership isolation enforced at both Server-Action and Route-Handler layers.

## Task Commits

1. **Task 1: End-to-end integration test + seed fixture** — `8609689` (test)
2. **Task 2: Human verification** — auto-approved in autonomous mode (no code commit)

**Plan metadata:** pending in this commit (docs: complete 02-07)

## Files Created/Modified

- `__tests__/phase2-integration.test.ts` — 4 integration cases covering happy path, dedup, cross-user 404, unauth 401. Uses node env, mocks `next/headers`, `@/lib/auth`, and `@/lib/extraction/claude`. Deletes FK-children first in beforeEach.
- `scripts/seed-extraction-fixture.ts` — idempotent dev helper. Seeds `seed-user` + `seed-doc-1`, copies `transcript.pdf` to `data/uploads/seed-doc-1.pdf`, inserts 6 extraction rows + 1 extraction_log row. Run with `npx tsx scripts/seed-extraction-fixture.ts`.

## Decisions Made

- **Seed script as .ts (not .mjs):** Plan specified `.mjs` but Node ESM could not resolve named exports from the Drizzle `.ts` schema modules directly. Converted to `.ts` and invoke via `tsx`, matching the project's existing `scripts/seed-user.ts` convention. Plan explicitly permitted this alternative in its executor notes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Seed script file extension changed from .mjs to .ts**
- **Found during:** Task 1 (writing the seed script)
- **Issue:** Node ESM loader could not import `db/schema.ts` + `db/client.ts` via plain `.mjs` — named-export resolution failed for the Drizzle modules under the project's TS config.
- **Fix:** Renamed `scripts/seed-extraction-fixture.mjs` → `scripts/seed-extraction-fixture.ts`; invoke via `npx tsx scripts/seed-extraction-fixture.ts`. This mirrors `scripts/seed-user.ts` (Phase 1).
- **Files affected:** `scripts/seed-extraction-fixture.ts`
- **Verification:** Script runs cleanly against the dev DB; idempotent on repeat invocation.
- **Committed in:** 8609689

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Zero scope change — the plan body explicitly authorised the `tsx` alternative if Node ESM couldn't resolve `.ts` imports.

## Issues Encountered

None. Task 1 TDD went green on first run after the tsx adjustment. All 4 integration cases passed on re-run at summary time (2.92s).

## Human Verification Outcome (Task 2)

**Status:** AUTO-APPROVED in autonomous mode per user instruction.

**Important caveat:** The four manual-only behaviors from 02-VALIDATION.md were **not** visually verified in a browser during this execution. They remain open as deferred UAT:

1. **Dropzone UX (UPLD-01):** drag-hover styling, drop acceptance, rejection inline message for non-PDFs — **not browser-verified**.
2. **Batch progress (UPLD-02):** 4 concurrent PDFs with `p-limit(3)` gating, single terminal Sonner toast — **not browser-verified**.
3. **iframe PDF preview (EXTR-01):** `/documents/{id}` two-column layout, Skeleton while pending, min-height — **not browser-verified**.
4. **Extraction accuracy (EXTR-01, EXTR-02):** real Claude call against `transcript.pdf`, plausibility of all 6 fields, no fabrications — **not browser-verified** (requires `ANTHROPIC_API_KEY`).

**Recommended follow-up:** Operator should run `npx tsx scripts/seed-extraction-fixture.ts` and walk through the four checks on a local `npm run dev` session before declaring Phase 2 shipped. Any gaps filed should feed into `/gsd-plan-phase --gaps` for a targeted fix-up plan.

## User Setup Required

External service configuration still required for live extraction (carried over from Plan 02-01):
- `ANTHROPIC_API_KEY` in `.env.local` before running a real Claude call against an uploaded PDF (integration tests do not need it — Claude wrapper is mocked).

No new setup introduced by this plan.

## Next Phase Readiness

- **Phase 2 automated coverage:** green end-to-end. Helpers (Plan 02), upload action (Plan 03), extraction action (Plan 04), and Route Handler (Plan 06) all exercised in composition.
- **Phase 2 visual coverage:** deferred to operator UAT (4 items above).
- **Ready for Phase 3 (laufliste-generation):** `document` + `extraction` tables are populated by a proven pipeline. Phase 3 can consume extraction rows as its authority-lookup input. No schema changes expected.
- **Blockers/concerns:** None automated. One soft concern — extraction prompt quality against real German docs is unverified until UAT runs; may surface a gap-closure plan before Phase 3 starts.

---
*Phase: 02-document-upload-ai-extraction*
*Completed: 2026-04-17*

## Self-Check: PASSED

- `__tests__/phase2-integration.test.ts` — FOUND
- `scripts/seed-extraction-fixture.ts` — FOUND
- `.planning/phases/02-document-upload-ai-extraction/02-07-SUMMARY.md` — FOUND
- Commit `8609689` — FOUND in git log
- Integration suite re-run: 4/4 passed (2.92s)
