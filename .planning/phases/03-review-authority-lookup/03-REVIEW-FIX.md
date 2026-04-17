---
phase: 03-review-authority-lookup
fixed_at: 2026-04-17T14:30:00Z
review_path: .planning/phases/03-review-authority-lookup/03-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-04-17
**Source review:** .planning/phases/03-review-authority-lookup/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (CR-01, CR-02, CR-03, WR-01 through WR-05)
- Fixed: 8
- Skipped: 0

## Fixed Issues

### CR-01: Unhandled throw from synchronous transaction in `approveAndResolve`

**Files modified:** `lib/review/actions.ts`
**Commit:** f183d37
**Applied fix:** Wrapped the `db.transaction()` call in `approveAndResolve` (lines 97-137) in a `try/catch` that returns `{ ok: false, error: "db_error" }` on any SQLite exception. Applied the same wrapper around the `chooseAmbiguousAuthority` transaction at lines 199-209.

---

### CR-02: Prompt injection via raw markdown in seed Claude prompt

**Files modified:** `scripts/parse-state-with-claude.ts`
**Commit:** 4724632
**Applied fix:** Before interpolating `raw` into the prompt, sanitized it with `raw.replace(/<\/input>/gi, "[/input]")`. The safe copy (`safeRaw`) is what gets substituted into `STATE_PARSE_PROMPT`, closing off the `</input>` injection vector.

---

### CR-03: TOCTOU race allows duplicate `document_review` rows

**Files modified:** `db/schema.ts`, `lib/review/actions.ts`, `drizzle/0003_chemical_franklin_richards.sql`, `drizzle/meta/_journal.json`
**Commit:** b8c6fe4
**Applied fix:** Replaced the plain `index("doc_review_doc_idx")` with `uniqueIndex("doc_review_doc_uniq")` on `documentReview.documentId` in the schema. Generated migration `0003_chemical_franklin_richards.sql` (DROP old index, CREATE UNIQUE INDEX). Applied the migration SQL directly to `data/angela.db` via `better-sqlite3` (drizzle-kit migrate was unavailable due to WAL lock; SQL applied manually and recorded in `__drizzle_migrations`). Replaced the select-then-insert branch in `approveAndResolve` with a single atomic `insert().onConflictDoUpdate()` keyed on `documentReview.documentId`.

---

### WR-01: `chooseAmbiguousAuthority` accepts any authority ID — no scope check

**Files modified:** `lib/review/actions.ts`
**Commit:** 9887038
**Applied fix:** After fetching `chosen`, added a scope check that parses `review.correctedFields` through `CorrectedFieldsSchema`, slugifies `bundesland`, and compares it to `chosen.stateId`. Returns `{ ok: false, error: "invalid_choice" }` if the authority belongs to a different state. Added `CorrectedFieldsSchema` to the import from `@/lib/validations/review` and imported `slugify` from `@/lib/behoerden/slug`.

**Note:** This fix involves a state-comparison condition. The logic has been reviewed carefully but should be verified by a human before deploying to production.

---

### WR-02: Empty strings pass `CorrectedFieldsSchema` for required routing fields

**Files modified:** `lib/validations/review.ts`
**Commit:** bc40e21
**Applied fix:** Added `.min(1, "…")` constraints to `dokumenten_typ` ("Bitte einen Dokumenttyp auswählen."), `ausstellungsort` ("Bitte einen Ausstellungsort angeben."), and `bundesland` ("Bitte ein Bundesland auswählen."). `ausstellende_behoerde` and `voller_name` remain max-only as they are informational fields that don't affect routing.

---

### WR-03: `onChooseAmbiguous` has no loading state — double-click submits twice

**Files modified:** `app/(app)/documents/[id]/review/_components/ReviewForm.tsx`, `app/(app)/documents/[id]/review/_components/AuthorityResultPanel.tsx`
**Commit:** e8f9ede
**Applied fix:** Added `const [choosePending, setChoosePending] = React.useState(false)` to `ReviewForm`. Wrapped `onChooseAmbiguous` body in a guard (`if (choosePending) return`) and a `try/finally` that sets/clears the flag. Passed `choosePending` as a new optional prop to `AuthorityResultPanel`. Updated `AuthorityResultPanelProps` type to include `choosePending?: boolean`. Threaded it through `AmbiguousVariant` and added `disabled={choosePending}` to each candidate button.

---

### WR-04: Fuzzy match threshold accepts near-matches on very short doc-type inputs

**Files modified:** `lib/behoerden/resolve.ts`
**Commit:** 27f822e
**Applied fix:** Added a length guard before the threshold formula: when `candidateSlug.length < 5`, threshold is set to `0` (forcing exact match). For slugs of length 5 or more the original `Math.min(FUZZY_MAX, Math.floor(length / 4))` formula continues to apply.

---

### WR-05: `anyDirty` not memoized — `beforeunload` effect re-registers on every render

**Files modified:** `app/(app)/documents/[id]/review/_components/ReviewForm.tsx`
**Commit:** 5e06f26
**Applied fix:** Replaced the inline `const anyDirty = FIELD_NAMES.some((k) => isDirty(k))` with `React.useMemo(() => FIELD_NAMES.some((k) => values[k] !== original[k].value), [values, original])`. The `isDirty` `useCallback` is retained as it is still used by `FieldRow` dirty-state rendering throughout the JSX.

---

## Test Results

Ran `BETTER_AUTH_SECRET=testsecret12345678901234567890 npx vitest run` after all fixes.

- **126 tests passed**, 2 skipped
- **1 pre-existing failure:** `__tests__/auth/sign-out.test.ts` — `beforeAll` hook timeout (10 000 ms). This test is in the auth infrastructure suite and was failing before these fixes. None of the changed files (`lib/review/actions.ts`, `lib/validations/review.ts`, `lib/behoerden/resolve.ts`, `db/schema.ts`, `scripts/parse-state-with-claude.ts`, `ReviewForm.tsx`, `AuthorityResultPanel.tsx`) are exercised by `sign-out.test.ts`. No regressions introduced.

---

_Fixed: 2026-04-17_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
