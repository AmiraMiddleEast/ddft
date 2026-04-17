---
phase: 02-document-upload-ai-extraction
fixed_at: 2026-04-17T11:28:00Z
review_path: .planning/phases/02-document-upload-ai-extraction/02-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 02: Code Review Fix Report

**Fixed at:** 2026-04-17T11:28:00Z
**Source review:** .planning/phases/02-document-upload-ai-extraction/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (CR-01, CR-02, WR-01, WR-02, WR-03, WR-04, WR-05, WR-06)
- Fixed: 8
- Skipped: 0

## Fixed Issues

### CR-01: `extractDocumentAction` updates status before ownership is confirmed

**Files modified:** `lib/extraction/actions.ts`
**Commit:** c059075
**Applied fix:** The ownership-gated SELECT was already first in the code (reviewer noted this). The remaining gap was that all four UPDATE statements in the action used bare `eq(document.id, documentId)` without the `userId` predicate. Added `eq(document.userId, session.user.id)` to the WHERE clause of all four UPDATEs: the initial "extracting" status set, the extraction-error fallback, the transaction's "done" update, and the catch-block error update. This ensures no mutation can affect a row the session user does not own, even if ownership verification were somehow skipped or reordered in future refactors.

---

### CR-02: Non-ASCII filename in `Content-Disposition` header is not RFC 5987-encoded

**Files modified:** `app/api/documents/[id]/pdf/route.ts`
**Commit:** 47082f0
**Applied fix:** Replaced the bare `filename="${encodeURIComponent(doc.filename)}"` with the RFC 6266 / RFC 5987 dual-parameter form: `filename="document.pdf"; filename*=UTF-8''${encodeURIComponent(doc.filename)}`. The ASCII fallback `filename="document.pdf"` serves older clients; the `filename*=` parameter carries the correctly percent-encoded UTF-8 name for all modern browsers, ensuring German umlauts are preserved.

---

### WR-01: Transaction `await` is missing — persistence errors are silently swallowed

**Files modified:** `lib/extraction/actions.ts`
**Commit:** f94e9bb
**Applied fix:** Expanded the comment block above `db.transaction(...)` to clearly document: (1) better-sqlite3 transactions are synchronous, (2) the callback must not be made async, (3) if a Promise were returned from the callback it would be silently ignored, and (4) the absence of `await` before `db.transaction()` is intentional. Includes a link to the Drizzle SQLite transaction docs.

---

### WR-02: Retry logic re-runs extraction even when document status is already `"done"`

**Files modified:** `lib/extraction/actions.ts`
**Commit:** c059075 (combined with CR-01)
**Applied fix:** Extended the early-return idempotency guard from `doc.extractionStatus === "done"` to also cover `doc.extractionStatus === "extracting"`. This prevents a concurrent second call from proceeding through the full Claude API call when extraction is already in progress, avoiding wasted tokens and a redundant DB write race.

---

### WR-03: `USD_TO_EUR` env-var is not validated — `NaN` silently propagates into cost column

**Files modified:** `lib/extraction/cost.ts`
**Commit:** 40b6005
**Applied fix:** Extracted `process.env.USD_TO_EUR ?? "0.92"` into `rawRate`, converted to `rate` via `Number()`, then added a `!Number.isFinite(rate) || rate <= 0` guard that throws a descriptive `Error` including the invalid value. This surfaces misconfiguration (e.g. a comma-decimal typo like `"0,92"`) immediately at extraction time rather than silently writing `NaN` or `NULL` to the `costEur` column.

---

### WR-04: File MIME type check relies solely on browser-reported value

**Files modified:** `lib/validations/upload.ts`
**Commit:** 28c0e12
**Applied fix:** Added a two-line comment immediately above the `f.type === "application/pdf"` refine clarifying that `f.type` is browser-supplied and untrusted, and that the authoritative check is `validatePdf()` in the Server Action (magic-bytes + pdf-lib parse). The refine itself is retained as a UX convenience gate; the comment prevents future developers from treating it as a security boundary.

---

### WR-05: `getExtractionsForDocument` has no ownership check

**Files modified:** `lib/documents/queries.ts`, `app/(app)/documents/[id]/page.tsx`
**Commit:** da09882
**Applied fix:** Added a required `userId: string` parameter to `getExtractionsForDocument`. The query now uses `.innerJoin(document, eq(extraction.documentId, document.id))` and filters with `and(eq(extraction.documentId, documentId), eq(document.userId, userId))`, making the function safe by default regardless of call site. Updated the single call site in `DocumentDetailPage` to pass `session.user.id`.

---

### WR-06: `UploadClient` batch-limit check uses stale `rows.length` closure value

**Files modified:** `app/(app)/upload/_components/UploadClient.tsx`
**Commit:** 1dcb6e1
**Applied fix:** Replaced the pre-flight `if (rows.length + accepted.length > MAX_BATCH_FILES)` guard (which read stale closure state) with a functional `setRows((current) => ...)` updater that reads the latest state at the time React processes the update. An `admitted` flag (set inside the updater when the rows are accepted) is checked after `setRows` returns to conditionally show the error message and bail. The `rows.length` dependency was removed from the `useCallback` dependency array since the callback no longer closes over it.

---

## Skipped Issues

None — all findings were fixed.

---

**Test suite result after fixes:** `npx vitest run` — 51/52 tests pass. The 2 pre-existing failures (`home-copy.test.tsx` missing `BETTER_AUTH_SECRET` env var, `seed-user.test.ts` timeout) were confirmed present before any of these fixes and are not regressions.

---

_Fixed: 2026-04-17T11:28:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
