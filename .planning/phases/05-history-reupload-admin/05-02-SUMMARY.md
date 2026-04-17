---
phase: 5
plan: "05-02"
subsystem: history
tags: [history, nuqs, ui]
requires: [05-01]
provides: [/history_route, listLauflistenHistoryForUser]
affects: [lib/history/, app/(app)/history/, app/(app)/layout.tsx, app/layout.tsx]
tech_stack_added: [NuqsAdapter]
key_files_created:
  - lib/history/queries.ts
  - lib/history/queries.test.ts
  - app/(app)/history/page.tsx
  - app/(app)/history/HistoryFilters.tsx
key_files_modified:
  - app/(app)/layout.tsx
  - app/layout.tsx
decisions:
  - Use LOWER() on both sides of LIKE for umlaut-safe case-insensitive search
  - Debounce search 300ms in client; date filters commit immediately
  - PAGE_SIZE=20 matches CONTEXT D-03
  - Added NuqsAdapter in root layout (Rule 3 auto-fix — useQueryState requires adapter)
  - endOfDay() applied to `to` param so dateTo is inclusive of the full day
  - Reuse existing /api/cases/[id]/laufliste/[lauflisteId]/download route (D-04)
tasks_completed: 2
task_commits:
  - 4ae24e5: feat(05-02) add lauflisten history queries
  - 29bf41b: feat(05-02) add /history page + filters + nav link
duration: ~15min
completed: 2026-04-17
---

# Phase 5 Plan 02: Lauflisten History Summary

**One-liner:** `/history` page with nuqs-powered URL state filters (person, date range) — reuses existing Phase 4 download route.

## What Was Built

### Query Layer (`lib/history/queries.ts`)
- `listLauflistenHistoryForUser(userId, opts, db)` → `{items, totalCount, page, pageSize}`
- INNER JOIN `laufliste` ↔ `case` filtered by `case.userId = userId` (zero-leak)
- Optional: `search` (LOWER LIKE), `dateFrom` / `dateTo` (inclusive), `page` / `pageSize`
- Returns `HistoryRow[]` with lauflisteId, caseId, personName, documentCount, fileSize, generatedAt

### UI
- `app/(app)/history/page.tsx` — Server Component; async `searchParams: Promise<{...}>` per Next 16; pagination links with preserved query params
- `app/(app)/history/HistoryFilters.tsx` — Client Component; `useQueryState` for `q`, `from`, `to`, `page`; 300ms debounced search; "Zurücksetzen" clears all
- Nav link "Historie" added in `app/(app)/layout.tsx`
- `NuqsAdapter` wrapped around children in `app/layout.tsx`

### Tests
- 3 unit tests in `lib/history/queries.test.ts`:
  - Search match (umlaut-safe case-insensitive)
  - Date range + DESC ordering
  - Pagination with totalCount reflecting pre-pagination count
- All pass (`BETTER_AUTH_SECRET=... npx vitest run lib/history --no-file-parallelism`)

## Verification

```
grep "listLauflistenHistoryForUser" lib/history/queries.ts  — match
test -f app/(app)/history/page.tsx                          — ok
test -f app/(app)/history/HistoryFilters.tsx                — ok
grep -E "Historie" "app/(app)/layout.tsx"                    — match
grep "useQueryState" "app/(app)/history/HistoryFilters.tsx"  — match
npx tsc --noEmit                                             — clean
```

## Deviations from Plan

**[Rule 3 - Blocking] Added NuqsAdapter to root layout**
- **Found during:** Task 05-02-02 implementation
- **Issue:** `useQueryState` requires NuqsAdapter wrapping the tree or it throws at runtime.
- **Fix:** Imported `NuqsAdapter` from `nuqs/adapters/next/app` and wrapped `{children}` in `app/layout.tsx`.
- **Files modified:** `app/layout.tsx`
- **Commit:** 29bf41b

## Self-Check: PASSED

- FOUND: lib/history/queries.ts
- FOUND: lib/history/queries.test.ts
- FOUND: app/(app)/history/page.tsx
- FOUND: app/(app)/history/HistoryFilters.tsx
- FOUND: 4ae24e5 (feat(05-02): add lauflisten history queries)
- FOUND: 29bf41b (feat(05-02): add /history page + filters + nav link)
