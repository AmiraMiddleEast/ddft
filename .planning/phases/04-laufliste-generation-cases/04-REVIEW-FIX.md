---
phase: 04-laufliste-generation-cases
status: all_fixed
findings_in_scope: 1
fixed: 1
skipped: 2
fixed_at: 2026-04-17
---

# Phase 4 — Code Review Fix Report

In-scope fixes applied for 04-REVIEW.md findings at severity >= warning.

## Scope

- **In scope:** critical + warning severity (plan directive)
- **Out of scope:** info severity (logged, not fixed this cycle)

## Fixes Applied

### [WARNING] R-04-01 — Download route path-containment check

**File:** `app/api/cases/[id]/laufliste/[lauflisteId]/download/route.ts`
**Commit:** see `fix(04): add path-containment check to Laufliste download route`

**Change:**
- Imported `LAUFLISTEN_DIR` from the storage module.
- After resolving `abs` from `row.pdfStoragePath`, verify the resolved path starts with `LAUFLISTEN_DIR + path.sep` (or equals the dir itself). Escape -> 410.
- Updated `app/api/cases/[id]/laufliste/[lauflisteId]/download/route.test.ts` to create fixture PDFs inside `LAUFLISTEN_DIR` (via `mkdtempSync` under it) so the happy-path 200 test passes the new containment check.

**Verification:**
- `npx vitest run app/api/cases __tests__/phase4-integration.test.ts` → 10/10 pass (7 route-matrix + 3 phase-4 integration)
- No production behavior change for normal Lauflisten (paths always inside LAUFLISTEN_DIR since writeLauflisteToDisk writes there)

## Fixes Skipped (out of scope — info severity)

### R-04-02 — Storage writer boundary defense (info)
Deferred — redundant guard, not exploitable today because the SQL equality predicate in `buildLauflisteInput` blocks any untrusted caseId before storage is reached.

### R-04-03 — `isUniqueViolation` umbrella code (info)
Deferred — observability nit. Under current schema the only insert-time constraint realistically hit is the compound unique on `case_document.document_id`. Would become relevant if FK or CHECK constraints were added; fine for now.

## Regression Check

- `npx vitest run` → 7 pre-existing `beforeAll` hook timeouts (iCloud + parallel sqlite infra issue, documented in 04-05-SUMMARY.md Deferred Issues). All 7 pass in isolation:
  - `npx vitest run lib/cases/queries.test.ts lib/laufliste/build-input.test.ts` → 20/20 pass
- New route containment test path did not regress any Phase 4 test.

## Summary

1 warning fixed, 2 info deferred, 0 regressions introduced.
