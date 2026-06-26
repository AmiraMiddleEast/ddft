---
phase: quick-260626-lc7
plan: 01
subsystem: document-extraction
tags: [claude, model-id, pricing, error-logging, bugfix]
requires:
  - "@anthropic-ai/sdk live model alias claude-sonnet-4-6"
provides:
  - "Live extraction model id (claude-sonnet-4-6) across production + seed scripts"
  - "Pricing entry for claude-sonnet-4-6 (non-zero cost) with old key retained"
  - "Server-side error logging in the extraction catch block"
affects:
  - "lib/extraction/* document analysis path"
  - "scripts/parse-state-with-claude.ts Behörden seed"
tech-stack:
  added: []
  patterns:
    - "Retain old pricing keys when swapping model ids — historical rows still price correctly"
key-files:
  created: []
  modified:
    - lib/extraction/claude.ts
    - lib/extraction/cost.ts
    - lib/extraction/actions.ts
    - scripts/parse-state-with-claude.ts
    - scripts/seed-extraction-fixture.ts
    - CLAUDE.md
    - __tests__/phase2-integration.test.ts
    - lib/extraction/actions.test.ts
    - lib/extraction/cost.test.ts
decisions:
  - "Use bare alias claude-sonnet-4-6 (no date suffix) — same Sonnet tier, identical $3/$15 pricing, same call shape, no migration"
  - "Keep the retired claude-sonnet-4-20250514 pricing key — historical extraction_log rows reference it"
  - "Logging-only change in the catch block; user-facing errorCode mapping (429→rate_limited / else→unknown) left untouched"
metrics:
  duration: ~12min
  tasks: 2
  files: 9
  completed: 2026-06-26
---

# Phase quick-260626-lc7 Plan 01: Fix Retired Claude Model (claude-sonnet-4) Summary

Swapped the retired `claude-sonnet-4-20250514` model id to the live `claude-sonnet-4-6` alias across the production extraction path and the Behörden seed script, restoring document extraction (no more HTTP 404 → red "Fehler") and seeding; added a `claude-sonnet-4-6` pricing key (old key retained for historical rows) so cost is computed non-zero, and added `console.error` logging in the extraction catch block so future failures are diagnosable in pm2 logs.

## What Was Done

### Task 1 — Model swap + pricing + logging (commit `2da7efd`)
- `lib/extraction/claude.ts`: `MODEL` → `claude-sonnet-4-6`.
- `lib/extraction/cost.ts`: added `"claude-sonnet-4-6": { inputUsd: 3, outputUsd: 15 }`; old key kept.
- `lib/extraction/actions.ts`: added `console.error("[extraction] failed for document", documentId, e)` as the first statement in the catch block. Error-code mapping unchanged.
- `scripts/parse-state-with-claude.ts`: `CLAUDE_MODEL` → `claude-sonnet-4-6`.
- `scripts/seed-extraction-fixture.ts`: `MODEL` → `claude-sonnet-4-6`.
- `CLAUDE.md`: stack table row → `Claude Sonnet 4.6 (claude-sonnet-4-6)`.

### Task 2 — Test updates + build/suite verification (commit `a06ea26`)
- `__tests__/phase2-integration.test.ts`: mock `OK_RESPONSE.model` and the `claudeModel` assertion → `claude-sonnet-4-6` (the `costEur > 0` assertion now passes via the new pricing key).
- `lib/extraction/actions.test.ts`: mock `OK_RESPONSE.model` and the `claudeModel` assertion → `claude-sonnet-4-6`; the `costEur ≈ 0.01518` assertion is unchanged (identical pricing).
- `lib/extraction/cost.test.ts`: kept the old-id cost test (guards historical rows); added a new `it(...)` asserting `claude-sonnet-4-6` computes the same `0.0345` EUR.

## Verification

`npm run build` and `npx vitest run` were run on a fast-filesystem copy at `/tmp/ddft-verify` (rsync of the repo excluding `node_modules`/`.next`, then `npm ci`) because the iCloud working directory stalls Next/vitest on fsync — the in-place build produced no streamed output and could not be trusted. The temp copy was removed afterward.

- **Build:** `npm run build` → exit 0. "Compiled successfully", TypeScript clean, all 19 routes generated.
- **Tests:** `npx vitest run` → **225 passed**, 1 failed (39 files: 38 passed, 1 failed). The three plan-targeted suites are fully green: `cost.test.ts`, `actions.test.ts`, `phase2-integration.test.ts` → 15/15 passed.
- **Grep guard:** `grep -rn "claude-sonnet-4-20250514" lib scripts __tests__` returns exactly the two intentional retentions (`cost.ts` pricing key + `cost.test.ts` historical assertion). Every production call path and seed script uses `claude-sonnet-4-6`.
- **Logging guard:** `actions.ts` catch block contains `console.error("[extraction] failed for document", documentId, e)`.

## Deviations from Plan

None to the implementation. Plan executed exactly as written.

## Deferred Issues (out of scope)

**1 pre-existing test failure, NOT caused by this task** — logged to `deferred-items.md`:

- `__tests__/ui/case-detail.test.tsx:168` "renders unreviewed-docs banner when at least one doc is not approved" fails: `getByText("Mindestens ein Dokument ist noch nicht geprüft.")` finds nothing.
- **Root cause:** Phase 06 commits `8bd4aea` and `9942d58` intentionally removed the review-gate banner from the case-detail UI, but this test assertion was not updated. The test has zero references to extraction, cost, or the model id — entirely unrelated to this task's changes.
- **Scope boundary:** Per the executor scope rule, this was not auto-fixed. Recommended owner: Phase 06 follow-up (remove/rewrite the obsolete banner assertion).

## Self-Check: PASSED

- FOUND files: lib/extraction/claude.ts, lib/extraction/cost.ts, lib/extraction/actions.ts, scripts/parse-state-with-claude.ts, scripts/seed-extraction-fixture.ts, CLAUDE.md, __tests__/phase2-integration.test.ts, lib/extraction/actions.test.ts, lib/extraction/cost.test.ts (all modified, present)
- FOUND commit: 2da7efd (Task 1)
- FOUND commit: a06ea26 (Task 2)
