---
phase: 05-history-reupload-admin
status: human_needed
score: 7/7 must-haves verified (automation) + 8 UAT items pending operator
verified_at: 2026-04-17
verifier: claude-opus-4 (executor inline)
requirements_verified: [HIST-01, HIST-02, HIST-03, UPLD-03, ADMN-01, ADMN-02, ADMN-03]
---

# Phase 5 — Verification Report

Phase goal (ROADMAP.md): "User can browse and search past Lauflisten, replace
document scans, and maintain the Behoerden database without code changes."

## Requirements Matrix

| ID | Summary | Status | Evidence |
| -- | ------- | ------ | -------- |
| HIST-01 | List past Lauflisten with date, person name, doc count | VERIFIED (automation) | `lib/history/queries.ts::listLauflistenHistoryForUser`; `app/(app)/history/page.tsx` renders table; integration test seeds 4 rows + asserts shape. |
| HIST-02 | Search / filter history by name and date | VERIFIED (automation) | Umlaut-safe `LOWER()` LIKE + inclusive `dateFrom` / `dateTo`; 3 unit tests in `lib/history/queries.test.ts`; `HistoryFilters.tsx` via nuqs `useQueryState`. |
| HIST-03 | Re-download any previously generated PDF | VERIFIED (automation) | `/history` rows link to the existing Phase 4 route `/api/cases/[id]/laufliste/[lauflisteId]/download` (D-04 reuse); route-matrix test + integration test already cover 200/401/404/410. |
| UPLD-03 | Re-upload better scan preserves case + reprocesses | VERIFIED (automation) | `lib/uploads/replace.ts::replaceDocumentPdfAction` bumps `document.version`, archives old row in `document_version`, new file on disk; `lib/extraction/reanalyze.ts::reanalyzeDocumentAction` wipes stale rows + resets status + delegates to `extractDocumentAction`; 4 unit tests in `lib/uploads/replace.test.ts` + integration test. |
| ADMN-01 | View, search, filter Behoerden DB | VERIFIED (automation) | `lib/admin/queries.ts::listAuthoritiesAdmin` with `stateId` / `docTypeId` / `needsReview` / `search` filters; paginated; `app/(app)/admin/behoerden/authorities/page.tsx` with nuqs-driven `AuthoritiesFilters`. |
| ADMN-02 | Edit authority contact details | VERIFIED (automation) | `lib/admin/actions.ts::updateAuthorityAction` with Zod `AuthorityPatchSchema` covering all contact fields; `EditAuthorityForm` client; 8 tests in `lib/admin/actions.test.ts` including happy path + auth + validation + 404. |
| ADMN-03 | Add new document types / modify routing rules | VERIFIED (automation) | `createDocumentTypeAction` + `updateDocumentTypeAction`; slug stability preserved (id frozen after creation); `DocumentTypesClient` add + inline edit; DUPLICATE rejection tested. |

## Success Criteria (ROADMAP.md)

### 1. User can view past Lauflisten list (HIST-01)

**Status:** VERIFIED (automation)

Evidence:
- `lib/history/queries.ts` INNER JOINs `laufliste` ↔ `case` with `case.userId = userId`
  predicate and returns `{lauflisteId, caseId, personName, documentCount, fileSize, generatedAt}`.
- `app/(app)/history/page.tsx` is a Server Component rendering the paged result.
- Integration test (`__tests__/phase5-integration.test.ts`) seeds 4 Lauflisten across
  2 users and asserts (a) user A sees only their 2, (b) ORDER BY generatedAt DESC.

### 2. User can search and filter history + re-download (HIST-02, HIST-03)

**Status:** VERIFIED (automation)

Evidence:
- Search: `LOWER(case.personName) LIKE lower('%q%')` — umlaut-safe; unit test
  covers `Müller` matched by `müller`.
- Date range: `gte(generatedAt, dateFrom)` + `lte(generatedAt, dateTo)` — inclusive.
- `HistoryFilters.tsx` wires `q`, `from`, `to`, `page` to URL state via nuqs.
- Download reuses Phase 4 route — `app/api/cases/[id]/laufliste/[lauflisteId]/download/route.ts` —
  which already has 7/7 route-matrix tests passing and integration coverage.

### 3. User can re-upload scan without recreating case; system reprocesses (UPLD-03)

**Status:** VERIFIED (automation)

Evidence:
- `replaceDocumentPdfAction`: ownership + PDF validation + `sha256` + new file on disk
  (`{docId}-v{N}.pdf`) + archive old row into `document_version` + bump `document.version`
  inside one synchronous better-sqlite3 transaction.
- `reanalyzeDocumentAction`: deletes stale `extraction` rows + resets
  `document.extraction_status = 'pending'` + clears `errorCode` in one transaction,
  then delegates to `extractDocumentAction` (which now runs end-to-end).
- 4 unit tests in `lib/uploads/replace.test.ts`: happy path v1→v2, unauthenticated
  gate, invalid-PDF rejection, cross-user zero-leak.
- Integration test (`__tests__/phase5-integration.test.ts`) asserts `document.version=2`,
  `document_version` row with v1 metadata, and the new file on disk.

### 4. User can view, search, filter Behoerden DB + edit details (ADMN-01, ADMN-02)

**Status:** VERIFIED (automation)

Evidence:
- `listAuthoritiesAdmin` filters: `stateId`, `docTypeId`, `needsReview`, `search`
  (lowercase LIKE on `authority.name`); joins state + docType + regierungsbezirk.
- `updateAuthorityAction` writes all contact fields (phone/email/website/office hours/
  notes/special rules) via `AuthorityPatchSchema` Zod validation; returns typed
  error codes (UNAUTHORIZED / VALIDATION / NOT_FOUND / DB_ERROR).
- `EditAuthorityForm` is a controlled-state client component calling the Server Action.
- 8 tests in `lib/admin/actions.test.ts` cover all code paths including the
  session-missing path (UNAUTHORIZED with no DB side-effect).

### 5. User can add new document types / modify routing rules (ADMN-03)

**Status:** VERIFIED (automation)

Evidence:
- `createDocumentTypeAction` slugifies input and pre-checks for PK collision (typed
  DUPLICATE) before insert; also guards against race-window collision in catch.
- `updateDocumentTypeAction` only renames `displayName` — slug (id) is stable by
  design to avoid FK cascade at v1 (D-15).
- `DocumentTypesClient` uses `useTransition` + `router.refresh()` for optimistic UX.
- Tests cover happy path, DUPLICATE, and NOT_FOUND.

"Modify routing rules" for v1 is interpreted as editing authority-level `special_rules`
/ `needs_review` flags (covered by ADMN-02). Full routing-rule schema (per-Bundesland
conditional routes) is not in v1 scope — the Behoerden DB is the routing source of
truth and it is fully editable via `updateAuthorityAction`.

## Automated Test Summary

| Suite | Result |
| ----- | ------ |
| `lib/history/queries.test.ts` | 3/3 pass |
| `lib/uploads/replace.test.ts` | 4/4 pass |
| `lib/admin/actions.test.ts` | 8/8 pass |
| `__tests__/phase5-integration.test.ts` | 4/4 pass |
| Full suite (`npx vitest run --no-file-parallelism`) | 218/218 pass |
| `npx tsc --noEmit` | clean |

## Human Verification Needed

The 8 UAT items below (from 05-05-PLAN.md task 05-05-02 checkpoint) require a
real-browser session and were AUTO-APPROVED in autonomous mode per operator
instruction. They are persisted as deferred operator sign-off:

1. /history list renders
2. /history search filter
3. /history date range filter
4. Nav links (Historie + Behörden)
5. Re-upload dialog + version bump
6. Re-analyze triggers extraction
7. Admin authorities edit form
8. Admin document types add/edit

Details: see `05-HUMAN-UAT.md` at the phase root.

## Score

**7/7 must-haves verified by automation.** Full UX click-through and DB inspection
remain as operator UAT items (auto-approved per autonomous mode).

## Recommendation

Mark Phase 5 complete and close out milestone v1.0. Production rollout requires:
(a) setting a real `ANTHROPIC_API_KEY` in `.env.local`, (b) re-seeding the
Behörden DB via `tsx scripts/seed-behoerden.ts --force` to replace the synthetic
placeholder data currently in `data/behoerden-parsed.json`, and (c) operator
walk-through of the aggregated 34+ UAT items across Phases 2-5.
