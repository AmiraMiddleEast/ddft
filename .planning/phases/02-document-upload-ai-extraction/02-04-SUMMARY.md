---
phase: 02-document-upload-ai-extraction
plan: 04
subsystem: claude-extraction
tags: [claude, extraction, server-action, zod, cost-tracking]
requires:
  - "@db/schema document + extraction + extraction_log (02-02)"
  - "@db/client better-sqlite3 Drizzle instance"
  - "@anthropic-ai/sdk 0.88.0"
  - "@lib/auth.auth.api.getSession"
  - "@lib/uploads/errors.UploadErrorCode"
  - "ANTHROPIC_API_KEY env var (runtime only)"
  - "USD_TO_EUR env var (optional, default 0.92)"
provides:
  - "extractDocumentAction(documentId) Server Action"
  - "extractFields(storagePath) Claude SDK wrapper"
  - "parseExtractionResponse(raw) Zod-validated parser"
  - "computeCostEur(model, inTokens, outTokens) pricing helper"
  - "EXTRACTION_PROMPT constant (locked 6-field German prompt)"
affects:
  - "document.extractionStatus transitions (pending -> extracting -> done|error)"
  - "extraction table: 6 rows per successful extraction"
  - "extraction_log table: 1 row per extraction attempt"
tech-stack:
  added:
    - "@anthropic-ai/sdk document content block (base64 PDF)"
  patterns:
    - "lazy SDK client construction — API key read at first call"
    - "better-sqlite3 sync transaction — no await inside db.transaction callback"
    - "vi.doMock + vi.resetModules to mock relative imports in dynamically loaded modules"
key-files:
  created:
    - lib/extraction/prompt.ts
    - lib/extraction/schema.ts
    - lib/extraction/cost.ts
    - lib/extraction/claude.ts
    - lib/extraction/actions.ts
    - lib/extraction/schema.test.ts
    - lib/extraction/cost.test.ts
    - lib/extraction/actions.test.ts
  modified: []
decisions:
  - "Use better-sqlite3 sync transaction with .run() on each query — async callbacks throw 'Transaction function cannot return a promise'"
  - "Mock the Claude SDK wrapper (extractFields) rather than the SDK itself — cleaner boundary and faster tests"
  - "Use vi.doMock after vi.resetModules so the mock applies to actions.ts's static './claude' import in the fresh module graph"
  - "retry-after header parsed with floor=0 (tests use '0'), cap=30s; retries once, second failure surfaces as rate_limited"
  - "onConflictDoNothing on (document_id, field_name) unique index makes the insert loop idempotent — repeat calls on a done document short-circuit before the SDK call"
metrics:
  duration_minutes: 8
  tasks: 3
  files: 8
  tests_added: 15
  completed_at: "2026-04-17T05:04:39Z"
---

# Phase 2 Plan 4: Claude Extraction Server Action Summary

Claude Sonnet 4 PDF extraction pipeline — Server Action that loads a PDF from disk, calls Claude with the locked 6-field German prompt, Zod-validates the `<result>`-wrapped response, writes 6 extraction rows + 1 cost-log row in a single transaction, and tracks status transitions on the `document` row.

## What Was Built

1. **`lib/extraction/prompt.ts`** — `EXTRACTION_PROMPT` constant. Locked 6-field German extraction prompt with `<result>{...}</result>` envelope, confidence-level semantics, and explicit null handling (D-12).

2. **`lib/extraction/schema.ts`** — `ExtractionResponse` Zod schema + `parseExtractionResponse(raw)`. Tolerates prose around the `<result>` tags and inner ` ```json ` code fences (RESEARCH Pitfall 3). Strict date regex `YYYY-MM-DD`; nullable value fields with enum-validated confidence.

3. **`lib/extraction/cost.ts`** — `computeCostEur(model, inTokens, outTokens)` using Sonnet 4 pricing ($3/$15 per MTok) × `USD_TO_EUR` (default 0.92). Unknown models return 0 rather than a fabricated price.

4. **`lib/extraction/claude.ts`** — `extractFields(storagePath)` thin SDK wrapper. Base64-encodes the PDF, sends a `type: "document"` content block, iterates `msg.content` to find the text block (RESEARCH Pitfall 4), returns `{ parsed, usage, model }`. Lazy client construction — `ANTHROPIC_API_KEY` read at call time only.

5. **`lib/extraction/actions.ts`** — `extractDocumentAction(documentId)` Server Action. Signed with `"use server"`. Flow:
   - Auth gate via `auth.api.getSession` → `{ ok: false, error: "unauthenticated" }`.
   - Ownership check `userId + documentId` → `{ ok: false, error: "not_found" }`.
   - Idempotent short-circuit: `extractionStatus === "done"` returns success without calling Claude.
   - Status transition to `"extracting"`, call Claude with one 429 retry using `retry-after`, persist 6 extraction rows + 1 log row + status `"done"` + `extractedAt` in a single `better-sqlite3` synchronous transaction.
   - Error mapping: second 429 → `rate_limited`; other SDK or DB errors → `unknown`; both set `extractionStatus = "error"` + `errorCode`.

6. **Tests (15 passing)**:
   - `schema.test.ts` (5): valid parse, `\`\`\`json` fence tolerance, null+low confidence (D-12), bad confidence rejection, bad date rejection.
   - `cost.test.ts` (2): Sonnet 4 EUR math, unknown-model returns 0.
   - `actions.test.ts` (8): not_found, 6-rows+1-log+status=done (with cost math assertion), null preservation, 429×2 → rate_limited, 429→success, non-429 error → unknown, idempotent no-op on second call, unauthenticated.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] better-sqlite3 sync transaction**
- **Found during:** Task 3 test run
- **Issue:** The plan's `action` code used `await db.transaction(async (tx) => { await tx.insert(...); ... })`. better-sqlite3 is synchronous — its transaction function cannot return a Promise, and Drizzle's Proxy-based builder returned a thenable that the sync driver rejected with `TypeError: Transaction function cannot return a promise`.
- **Fix:** Made the transaction callback synchronous and called `.run()` on each insert/update (Drizzle's sync execution entry point for better-sqlite3). No `await` inside the transaction body.
- **Files modified:** lib/extraction/actions.ts
- **Commit:** 988caba

**2. [Rule 3 - Blocker] Test module graph mocking**
- **Found during:** Task 3 test run
- **Issue:** The plan's test used top-level `vi.mock("./claude", ...)` + direct imports. But the project's established test pattern (see `lib/uploads/actions.test.ts`) requires `createTestDb` + `vi.resetModules` + dynamic imports so `@/db/client` picks up the test `DATABASE_URL`. After `vi.resetModules`, the hoisted `vi.mock("./claude")` did not re-apply to the dynamically re-imported `actions.ts` graph, so the real `extractFields` was called (which then tried to read the placeholder API key's SDK response).
- **Fix:** Replaced hoisted `vi.mock("./claude")` with `vi.doMock("./claude", ...)` placed AFTER `vi.resetModules()` inside `beforeAll`. `doMock` is not hoisted and applies to subsequent `import()` calls — including the static `./claude` import inside the dynamically loaded `actions.ts`.
- **Files modified:** lib/extraction/actions.test.ts
- **Commit:** 988caba

**3. [Rule 2 - Missing critical coverage] Added two extra tests**
- **Found during:** Task 3 implementation
- **Issue:** The plan specified 5 action tests but did not cover: (a) successful retry after first 429, and (b) non-429 SDK errors mapping to `unknown`. Both paths are in `runExtractionWithOneRetry` / the catch block and are explicitly called out in `<behavior>`. Leaving them untested would let regressions slip past.
- **Fix:** Added `"retries once on 429 and succeeds on the second attempt"` and `"maps non-429 SDK errors to unknown and sets status=error"` — 8 tests total instead of the planned 5.
- **Files modified:** lib/extraction/actions.test.ts
- **Commit:** 988caba

**4. [Rule 1 - Bug] Cost-math assertion value**
- **Found during:** Task 3 test run
- **Issue:** The plan's test comment for the log-row cost assertion had math that didn't match the values: `(4000*3 + 300*15)/1e6 * 0.92 = 0.01518`, not `0.01656`.
- **Fix:** Corrected the expected value to `0.01518` and updated the comment.
- **Files modified:** lib/extraction/actions.test.ts
- **Commit:** 988caba

## Authentication Gates

None. `ANTHROPIC_API_KEY` has a `sk-ant-PLACEHOLDER` value in `.env.local` (installed by Plan 02-01). The real key is not required to run tests — all tests mock `extractFields`. The first live extraction in dev/prod will require the operator to swap in a real key; this is documented as an expected operational step, not a gate for this plan.

## Success Criteria

- [x] EXTR-01: `extractDocumentAction` pulls 6 fields from a Claude response (validated via Zod) and persists them — covered by `writes 6 extraction rows + 1 log row on success`.
- [x] EXTR-02: confidence levels (high/medium/low) captured verbatim from Claude and stored per field — enforced by Zod `confidence` enum and verified in `preserves null value with low confidence (D-12)`.
- [x] D-12 null handling verified — `voller_name` null value with `low` confidence round-trips to the DB in tests.
- [x] D-15 cost log row written per extraction — `costEur` assertion verifies the computed value lands in `extraction_log`.
- [x] D-14 rate_limited error surface available to UI — `{ ok: false, error: "rate_limited" }` returned on second 429.
- [x] 6 extraction rows per successful call (one per FIELD_NAMES), 1 extraction_log row.
- [x] German error messages surface: error codes map to `UploadErrorCode` which the UI renders in German (D-14 — UI mapping is Plan 05's job; codes `rate_limited` and `unknown` are live).
- [x] Tests mock Anthropic (via mocking the `./claude` wrapper), all pass.
- [x] `npx tsc --noEmit` clean.

## Commits

| Task | Hash      | Message                                                 |
|------|-----------|---------------------------------------------------------|
| 1    | da2e96b   | feat(02-04): add extraction prompt, Zod schema, and cost calculator |
| 2    | 7e5cf13   | feat(02-04): add Claude SDK wrapper extractFields(storagePath)      |
| 3    | 988caba   | feat(02-04): add extractDocumentAction Server Action                |

## Known Stubs

None. All code paths are wired: prompt is locked, schema validates, cost math is real, transaction persists, error mapping is exhaustive.

## Self-Check: PASSED

- FOUND: lib/extraction/prompt.ts
- FOUND: lib/extraction/schema.ts
- FOUND: lib/extraction/cost.ts
- FOUND: lib/extraction/claude.ts
- FOUND: lib/extraction/actions.ts
- FOUND: lib/extraction/schema.test.ts (5 tests)
- FOUND: lib/extraction/cost.test.ts (2 tests)
- FOUND: lib/extraction/actions.test.ts (8 tests)
- FOUND commit: da2e96b
- FOUND commit: 7e5cf13
- FOUND commit: 988caba
- Full suite: 14 test files, 49 tests passing
- tsc --noEmit: clean
