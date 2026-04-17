---
phase: 02-document-upload-ai-extraction
reviewed: 2026-04-17T00:00:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - app/(app)/upload/page.tsx
  - app/(app)/upload/_components/UploadClient.tsx
  - app/(app)/upload/_components/BatchRow.tsx
  - app/(app)/upload/_components/ErrorCopy.ts
  - app/(app)/documents/[id]/page.tsx
  - app/(app)/documents/[id]/_components/PdfPreview.tsx
  - app/(app)/documents/[id]/_components/ExtractionTable.tsx
  - app/(app)/page.tsx
  - app/api/documents/[id]/pdf/route.ts
  - lib/uploads/actions.ts
  - lib/uploads/hash.ts
  - lib/uploads/pdf-validate.ts
  - lib/uploads/storage.ts
  - lib/uploads/errors.ts
  - lib/extraction/actions.ts
  - lib/extraction/claude.ts
  - lib/extraction/prompt.ts
  - lib/extraction/schema.ts
  - lib/extraction/cost.ts
  - lib/validations/upload.ts
  - lib/documents/queries.ts
  - db/schema.ts
  - next.config.ts
  - scripts/seed-extraction-fixture.ts
findings:
  critical: 2
  warning: 6
  info: 4
  total: 12
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-04-17
**Depth:** standard
**Files Reviewed:** 21
**Status:** issues_found

## Summary

This phase implements the document upload pipeline (FormData → SHA-256 dedup → pdf-lib validation → disk write → Claude Vision extraction → SQLite persistence). The overall architecture is well-structured: authentication checks are consistently present at Server Action and API route boundaries, Drizzle queries are parameterised (no SQL injection surface), the API key is server-only and never surfaced to the client, and the dedup race is correctly handled with an atomic `onConflictDoNothing` pattern.

Two critical issues require fixing before this phase ships. First, the `extractDocumentAction` Server Action does not validate that the caller-supplied `documentId` belongs to the authenticated user before updating the document status to `"extracting"` — only the final ownership check (select with userId filter) happens later. Second, the filename supplied by the browser is written directly into an HTTP `Content-Disposition` header without RFC 5987 encoding, which can corrupt the header for non-ASCII characters (German umlauts in filenames).

Several warnings cover logic correctness issues: a retry loop that can double-trigger extraction on an already-done document, a missing `await` on the transaction that silently discards persistence errors, an unchecked `USD_TO_EUR` env-var that accepts `NaN`, and a file-type check that relies solely on the browser-reported MIME type rather than magic bytes.

---

## Critical Issues

### CR-01: `extractDocumentAction` updates status before ownership is confirmed

**File:** `lib/extraction/actions.ts:65-68`

**Issue:** The action sets `extractionStatus = "extracting"` with an unconditional `WHERE id = documentId` before the ownership query (`WHERE id = documentId AND userId = session.user.id`) runs. A authenticated user who knows any other user's document UUID (e.g. from the URL bar) can flip that foreign document's status to `"extracting"`, permanently preventing it from being re-extracted (the action returns early when status is `"done"`, but more importantly the initial update fires before the auth check).

The ownership check at line 53-59 _does_ exist and will return `not_found` shortly after, but the state-mutating `UPDATE` at line 65 has already fired against the un-owned row.

**Fix:** Move the ownership-gated `select` (lines 53-59) to run _before_ the status update, and only proceed to update when the row is confirmed to belong to the session user:

```typescript
// Verify ownership FIRST — before any mutation.
const [doc] = await db
  .select()
  .from(document)
  .where(and(eq(document.id, documentId), eq(document.userId, session.user.id)))
  .limit(1);
if (!doc) return { ok: false, documentId, error: "not_found" };

if (doc.extractionStatus === "done") return { ok: true, documentId };

// Only now update — ownership already confirmed above.
await db
  .update(document)
  .set({ extractionStatus: "extracting", errorCode: null })
  .where(and(eq(document.id, documentId), eq(document.userId, session.user.id)));
```

---

### CR-02: Non-ASCII filename in `Content-Disposition` header is not RFC 5987-encoded

**File:** `app/api/documents/[id]/pdf/route.ts:42`

**Issue:** The filename taken from `doc.filename` (user-supplied at upload time) is placed directly into the `Content-Disposition` header value using only `encodeURIComponent`:

```
Content-Disposition: inline; filename="Geburtsurkunde%20M%C3%BCller.pdf"
```

The `filename=` parameter in `Content-Disposition` is defined by RFC 6266 / RFC 5987. Raw `encodeURIComponent` output is not valid inside a quoted `filename=""` token — browsers interpret percent-encoded sequences in this position differently across vendors (Chrome decodes them; Firefox does not). For filenames containing German umlauts (ä, ö, ü, ß), the downloaded filename will be garbled or the header may be rejected entirely.

The correct approach is to use the `filename*` (star) parameter with RFC 5987 encoding alongside a plain ASCII fallback in `filename`:

```typescript
const encoded = encodeURIComponent(doc.filename);
"Content-Disposition": `inline; filename="document.pdf"; filename*=UTF-8''${encoded}`,
```

---

## Warnings

### WR-01: Transaction `await` is missing — persistence errors are silently swallowed

**File:** `lib/extraction/actions.ts:89`

**Issue:** `db.transaction(...)` with better-sqlite3 is synchronous and returns the callback's return value. The `try { db.transaction(...) }` block at line 89 is _not_ awaited (there is no `await` keyword). This means if any of the `.run()` calls inside the transaction throw (e.g. a constraint violation), the thrown error propagates synchronously out of the `try` block and is caught — but if the transaction callback itself returned a rejected `Promise` from an async operation, that rejection would be silently unhandled.

More concretely: the current callback is synchronous (all `.run()` calls are sync), so the logic happens to work today. But the pattern is fragile — if a future developer makes any inner call `async`, the transaction will silently become a no-op. Add a note or restructure:

```typescript
// better-sqlite3 transactions must use the synchronous .run() API.
// Do NOT add async/await inside this callback — the promise would be
// silently ignored. See: https://orm.drizzle.team/docs/transactions#sqlite
db.transaction((tx) => {
  // ... all .run() calls ...
});
// No await — this is intentional: better-sqlite3 is synchronous.
```

The second, more immediate problem: the `catch {}` block at line 130 catches sync throws but the outer `try` has no `await`, so any async rejection that escapes the callback body is unhandled. At minimum, document this clearly.

---

### WR-02: Retry logic re-runs extraction even when document status is already `"done"`

**File:** `lib/extraction/actions.ts:63`

**Issue:** The early-return guard `if (doc.extractionStatus === "done") return { ok: true, documentId }` (line 63) is checked against the `doc` row fetched at line 53. After the ownership check passes and the action sets status to `"extracting"` (line 65), a second concurrent call to `extractDocumentAction` for the same document will see `"extracting"` — not `"done"` — and will proceed through the whole Claude call again in parallel. 

This creates a race where two concurrent calls to extract the same document both call the Claude API and both attempt to insert extraction rows. The `onConflictDoNothing` on the extraction insert at line 102 prevents a DB constraint error, but it means one of the two Claude calls is wasted (tokens billed, result discarded). For a single-user internal tool this is acceptable, but the status guard should also cover `"extracting"`:

```typescript
if (doc.extractionStatus === "done" || doc.extractionStatus === "extracting") {
  return { ok: true, documentId };
}
```

---

### WR-03: `USD_TO_EUR` env-var is not validated — `NaN` silently propagates into cost column

**File:** `lib/extraction/cost.ts:14`

**Issue:** `Number(process.env.USD_TO_EUR ?? "0.92")` returns `NaN` when the env var is set to any non-numeric string (e.g. a typo like `"0,92"` using a comma). `NaN * usd` is `NaN`, and `Number(NaN.toFixed(6))` is also `NaN`. Inserting `NaN` into the `cost_eur REAL NOT NULL` SQLite column will either store `NULL` (SQLite coerces `NaN` to `NULL` for `REAL`) or throw a constraint violation, depending on the driver. Either outcome silently breaks cost tracking without any error surfacing to the operator.

```typescript
const rawRate = process.env.USD_TO_EUR ?? "0.92";
const rate = Number(rawRate);
if (!Number.isFinite(rate) || rate <= 0) {
  throw new Error(`USD_TO_EUR env var is invalid: "${rawRate}"`);
}
```

---

### WR-04: File MIME type check relies solely on browser-reported value

**File:** `lib/validations/upload.ts:11`

**Issue:** The `FileInput` Zod schema's final refine at line 11 checks `f.type === "application/pdf"`. The `File.type` field in a FormData upload is the MIME type as reported by the browser, which is not verified by the server. An attacker (or a browser bug) can set `Content-Type: application/pdf` on any file. 

The defense-in-depth magic-bytes check in `pdf-validate.ts` (`"%PDF"` at offset 0) does partially mitigate this — but only after the file has already been parsed by `pdf-lib`, which parses the full byte structure. The order is correct: `validatePdf` runs before the disk write. The risk is therefore low. However, the MIME check creates false confidence; the only trustworthy gate is the magic-byte + pdf-lib check in `validatePdf`. Consider removing the `f.type` refine or adding a comment noting it is advisory:

```typescript
// NOTE: f.type is browser-supplied and untrusted.
// The authoritative check is validatePdf() in the Server Action.
.refine((f) => f.type === "application/pdf", { message: "invalid_pdf" })
```

---

### WR-05: `getExtractionsForDocument` has no ownership check

**File:** `lib/documents/queries.ts:31-43`

**Issue:** `getExtractionsForDocument(documentId)` queries extractions by `documentId` alone — it does not filter by `userId`. This function is only called from `DocumentDetailPage` (line 41 of `documents/[id]/page.tsx`) _after_ `getDocumentForUser(id, session.user.id)` has already confirmed ownership, so there is no live path that bypasses the auth gate today.

However, if a future call site invokes `getExtractionsForDocument` directly without the prior ownership check, it will silently return another user's extracted data. Given the data contains personal information (full names, document types), this is a latent authorization risk. Adding a `userId` join to the query makes it safe by default:

```typescript
export async function getExtractionsForDocument(
  documentId: string,
  userId: string,  // require caller to supply — prevents accidental misuse
): Promise<ExtractionRow[]> {
  return db
    .select({ ... })
    .from(extraction)
    .innerJoin(document, eq(extraction.documentId, document.id))
    .where(and(eq(extraction.documentId, documentId), eq(document.userId, userId)));
}
```

---

### WR-06: `UploadClient` batch-limit check uses stale `rows.length` closure value

**File:** `app/(app)/upload/_components/UploadClient.tsx:93`

**Issue:** The `onDrop` callback captures `rows.length` via the dependency array (`[rows.length, runPipeline]`). If two drop events fire in the same React render cycle (rare but possible in programmatic tests or keyboard-and-mouse simultaneous drops), both callbacks see the same pre-update `rows.length` and both may pass the `rows.length + accepted.length > MAX_BATCH_FILES` guard, resulting in more than 10 files being queued. React batches state updates in event handlers, so the stale closure is a real concern. Use the functional updater form of `setRows` instead of a guard based on the captured length:

```typescript
// Use functional setRows to read the latest state, not a stale closure.
setRows((current) => {
  if (current.length + accepted.length > MAX_BATCH_FILES) {
    setRejectMsg(ERROR_COPY.batch_limit);
    return current; // reject
  }
  return [...current, ...newRows];
});
```

---

## Info

### IN-01: `unauthenticated` error copy is misleading for the end user

**File:** `app/(app)/upload/_components/ErrorCopy.ts:4`

**Issue:** The copy for `"unauthenticated"` is `"Analyse fehlgeschlagen. Bitte erneut versuchen."` — the same text as `"unknown"`. A session expiry mid-upload is a distinct, actionable failure; the user should be told to re-sign in rather than simply retry.

**Fix:**
```typescript
unauthenticated: "Sitzung abgelaufen. Bitte neu anmelden und erneut versuchen.",
```

---

### IN-02: `extractDocumentAction` does not validate `documentId` format before querying

**File:** `lib/extraction/actions.ts:45-46`

**Issue:** `documentId` is a `string` passed directly from the client. There is no length check or UUID-format validation before it is used in the Drizzle `eq(document.id, documentId)` predicate. Drizzle uses parameterised queries so there is no SQL injection risk, but an arbitrarily long string (e.g. 10 KB) will hit the DB and return empty with no early rejection. A brief length/format guard would be a good defensive pattern.

**Fix:**
```typescript
if (!/^[0-9a-f-]{36}$/.test(documentId)) {
  return { ok: false, documentId, error: "not_found" };
}
```

---

### IN-03: Singleton Claude client is module-level mutable state

**File:** `lib/extraction/claude.ts:18-25`

**Issue:** `let _client: Anthropic | null = null` is module-level mutable state. In Next.js App Router, modules are cached per worker process, so this is correct for production. However, in test environments this shared singleton can leak state between test cases (different `ANTHROPIC_API_KEY` values across tests will use the first one). Document the singleton assumption or use `const client = new Anthropic(...)` at module level (safe since the module only loads when the env var is present):

```typescript
// Lazily initialised once per process. Tests that need a different key
// must isolate the module (jest.resetModules() / vi.resetModules()).
```

---

### IN-04: Seed script uses a fake `sha256` value that violates data integrity assumptions

**File:** `scripts/seed-extraction-fixture.ts:107`

**Issue:** `sha256: \`seed-fixture-${SEED_DOC_ID}\`` is not a valid 64-hex-character SHA-256 digest. If any future code path validates the `sha256` column format (e.g. a migration check constraint or an integrity audit query), the seed document will fail. The seed comment notes this is intentional for dedup idempotency, which is valid reasoning. But it is worth a schema-level note: the `document` table has no `CHECK` constraint on the `sha256` column format, so this is harmless for now. No code change required — just awareness.

---

_Reviewed: 2026-04-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
