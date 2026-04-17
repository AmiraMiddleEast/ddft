---
phase: 02-document-upload-ai-extraction
plan: 03
subsystem: uploads
tags: [server-actions, upload, validation, dedup, sha256, pdf-lib]

requires:
  - phase: 02-document-upload-ai-extraction
    plan: 01
    provides: "Next 16 body size config (15mb), pdf-lib installed, react-dropzone installed, ANTHROPIC_API_KEY placeholder"
  - phase: 02-document-upload-ai-extraction
    plan: 02
    provides: "document table with UNIQUE (user_id, sha256), extraction_status enum with pending/extracting/done/error, ON DELETE CASCADE"
provides:
  - "uploadSingleDocumentAction(prev, formData): Promise<UploadResult> — Server Action, discriminated-union result"
  - "sha256Hex(bytes): Promise<string> — Web Crypto SHA-256 helper, 64-char lowercase hex"
  - "validatePdf(bytes): Promise<PdfValidation> — magic-byte + pdf-lib encryption check"
  - "writeUploadToDisk(id, bytes): Promise<string> — persists to data/uploads/{id}.pdf"
  - "UploadErrorCode union — enumerates all user-visible upload errors"
  - "FileInput Zod schema + MAX_FILE_BYTES + MAX_BATCH_FILES"
  - "__fixtures__/encrypted.pdf — hand-crafted minimal encrypted PDF for tests (no qpdf)"
affects: [02-04, 02-05, 02-06, 02-07]

tech-stack:
  added: []
  patterns:
    - "Server Action returns discriminated-union (ok:true|false) — never throws for user errors (RESEARCH Anti-Patterns)"
    - "Hash BEFORE disk write, dedup check via onConflictDoNothing, re-select on conflict (RESEARCH Pitfalls 5 & 8)"
    - "Magic-byte sniff + pdf-lib PDFDocument.load (ignoreEncryption:false) before any filesystem side-effect (D-21)"
    - "Vitest isolation via createTestDb fixture + vi.mock for next/headers and @/lib/auth"
    - "Zod issue-message convention: message is the UploadErrorCode string so the first issue maps directly to the error"

key-files:
  created:
    - lib/uploads/errors.ts
    - lib/uploads/hash.ts
    - lib/uploads/pdf-validate.ts
    - lib/uploads/storage.ts
    - lib/uploads/actions.ts
    - lib/uploads/helpers.test.ts
    - lib/uploads/actions.test.ts
    - lib/validations/upload.ts
    - scripts/make-encrypted-pdf.mjs
    - __fixtures__/encrypted.pdf
  modified:
    - vitest.config.ts

key-decisions:
  - "Hand-crafted encrypted PDF fixture via raw byte writer in scripts/make-encrypted-pdf.mjs — qpdf is not installed and pdf-lib cannot emit encrypted PDFs; a /Encrypt trailer is sufficient to trigger pdf-lib's EncryptedPDFError"
  - "Zod FileInput uses refinement message as the UploadErrorCode literal so first-issue message can be mapped directly with a narrow allowlist (file_too_large|invalid_pdf)"
  - "Store storagePath as the relative form 'data/uploads/{id}.pdf' — matches Phase 1's DATABASE_URL path convention and stays portable across dev/build/test"
  - "On dedup hit: do NOT write bytes to disk (saves FS IO; the existing file at {existingId}.pdf is already correct)"
  - "Vitest include list extended to lib/**/*.test.ts so co-located tests are discovered (previously only __tests__/**)"
  - "Fall back to error:'unknown' if onConflictDoNothing returns no row AND the re-select also returns nothing — only possible in a race we can't reason about; surfaces as a generic error instead of throwing"

requirements-completed: [UPLD-01, UPLD-02]

duration: 4m
completed: 2026-04-17
---

# Phase 2 Plan 03: Upload Server Action + SHA-256 Dedup + PDF Validation Summary

**Server-side single-file upload pipeline: validate PDF structure (magic bytes + pdf-lib encryption detection), compute SHA-256, short-circuit on per-user dedup hit, write original to `data/uploads/{uuid}.pdf`, insert `document` row with `extraction_status='pending'` — all via one `"use server"` Server Action with discriminated-union return.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-17T04:48:11Z
- **Completed:** 2026-04-17T04:52:20Z
- **Tasks:** 2 (both `type="auto"` + `tdd="true"`)
- **Files created:** 10
- **Files modified:** 1

## Accomplishments

- Shipped `lib/uploads/actions.ts` — a single `"use server"` function `uploadSingleDocumentAction(prev, formData)` that returns a discriminated-union `UploadResult`, never throws for user errors, and wires together auth, Zod validation, magic-byte + encryption check, SHA-256 hashing, per-user dedup, disk write, and row insert.
- Shipped the four pure helpers the action composes: `sha256Hex` (Web Crypto), `validatePdf` (`%PDF` magic + `pdf-lib` encryption detection), `writeUploadToDisk` (creates `data/uploads/` on demand, writes exact bytes, returns relative path), `UploadErrorCode` union.
- Shipped `lib/validations/upload.ts` with `FileInput` Zod schema, `MAX_FILE_BYTES` (10 MiB per D-04), and `MAX_BATCH_FILES` (10) — refinement messages encode the `UploadErrorCode` literal so the action can map the first issue directly.
- Hand-crafted `__fixtures__/encrypted.pdf` via `scripts/make-encrypted-pdf.mjs` — bypasses the missing `qpdf` tool by writing a minimal PDF with an `/Encrypt` trailer entry, which pdf-lib's `PDFDocument.load()` refuses with a message containing `"encrypted"` (exactly what `validatePdf` matches on).
- 13 passing tests across two files: 7 unit tests for the helpers (SHA-256 known-vector, determinism, non-equal inputs; `validatePdf` accepts real PDF, rejects garbage, rejects <5-byte buffers, rejects encrypted fixture) and 6 integration tests for the action (unauthenticated, non-PDF MIME, >10 MB, encrypted PDF, happy-path insert with real disk file, dedup returns same documentId with no second row or second disk write).
- All integration tests run against a throwaway SQLite DB created by the existing `createTestDb` fixture from Phase 1 — no pollution of the dev `data/angela.db`.
- Extended `vitest.config.ts` `include` list to also match `lib/**/*.test.{ts,tsx}` so co-located helper/action tests are discovered (Rule 3 — blocking config for the plan's `npx vitest run lib/uploads/` acceptance check).

## Task Commits

Each task was committed atomically:

1. **Task 1: Pure helpers (sha256, validatePdf, storage, errors, Zod schema) + unit tests + encrypted fixture** — `247aa9f` (feat)
2. **Task 2: uploadSingleDocumentAction + integration tests** — `9d9afbd` (feat)

## Files Created/Modified

### Created

- `lib/uploads/errors.ts` — `UPLOAD_ERROR_CODES` const array + `UploadErrorCode` union (7 codes).
- `lib/uploads/hash.ts` — `sha256Hex(bytes: Uint8Array): Promise<string>` via `crypto.subtle.digest`.
- `lib/uploads/pdf-validate.ts` — `validatePdf(bytes)` → `{ok:true}` | `{ok:false, reason:'invalid_pdf'|'encrypted_pdf'}`.
- `lib/uploads/storage.ts` — `UPLOADS_DIR` (`<cwd>/data/uploads`) + `writeUploadToDisk(id, bytes)`.
- `lib/uploads/actions.ts` — `"use server"` + `uploadSingleDocumentAction` + `UploadResult` type.
- `lib/uploads/helpers.test.ts` — 7 unit tests for sha256Hex + validatePdf using real `transcript.pdf` + encrypted fixture.
- `lib/uploads/actions.test.ts` — 6 integration tests with mocked auth + real in-memory-ish SQLite via `createTestDb`.
- `lib/validations/upload.ts` — `FileInput` Zod schema, `MAX_FILE_BYTES`, `MAX_BATCH_FILES`.
- `scripts/make-encrypted-pdf.mjs` — one-shot generator for `__fixtures__/encrypted.pdf` (rerunnable).
- `__fixtures__/encrypted.pdf` — hand-crafted 1-page PDF with `/Encrypt` in its trailer.

### Modified

- `vitest.config.ts` — added `lib/**/*.test.{ts,tsx}` to the `include` list (Rule 3 deviation).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Extended vitest `include` to discover `lib/**/*.test.ts`**

- **Found during:** Task 1 test setup
- **Issue:** The acceptance criterion `npx vitest run lib/uploads/` relies on Vitest's glob discovery, but the existing `include: ["__tests__/**/*.test.{ts,tsx}"]` excludes `lib/`, so Vitest would report "No test files found" unless each file was passed explicitly.
- **Fix:** Added `"lib/**/*.test.{ts,tsx}"` to the `include` array in `vitest.config.ts`.
- **Files modified:** `vitest.config.ts`
- **Commit:** `247aa9f`

**2. [Rule 2 — Correctness] Encrypted-PDF fixture path (no `qpdf` on dev machine)**

- **Found during:** Task 1 (pre-test)
- **Issue:** The plan suggested `qpdf --encrypt` to build the fixture, but `qpdf` is not installed and pdf-lib cannot emit encrypted PDFs via `save()`. Without a real encrypted fixture, the `encrypted_pdf` branch of `validatePdf` would be untested — defeating the whole purpose of D-21.
- **Fix:** Wrote `scripts/make-encrypted-pdf.mjs` that emits a minimal hand-crafted PDF whose trailer points at an `/Encrypt` dictionary (Standard security handler, RC4-40, synthetic O/U/P). pdf-lib detects this and throws `EncryptedPDFError` — confirmed via one-shot Node probe before committing.
- **Files modified:** `scripts/make-encrypted-pdf.mjs`, `__fixtures__/encrypted.pdf`
- **Commit:** `247aa9f`

**3. [Rule 3 — Blocking] Integration test DB isolation via `createTestDb`**

- **Found during:** Task 2 test scaffolding
- **Issue:** The plan's sample test imported `db` from `@/db/client` directly, which would hit the real dev `data/angela.db` and leak `document`/`user` rows across runs (the beforeEach does `db.delete(user)` — dangerous against the real DB).
- **Fix:** Reused the Phase 1 `createTestDb` fixture: overrides `DATABASE_URL` to a throwaway `mkdtemp` file, runs `drizzle-kit push --force` against it, and cleans up on `afterAll`. Mocks for `next/headers` and `@/lib/auth` were kept as the plan specified.
- **Files modified:** `lib/uploads/actions.test.ts`
- **Commit:** `9d9afbd`

### Not Deviated

- No `throw` statements added for user-visible errors (RESEARCH Anti-Patterns honored — `grep -E 'throw\s' lib/uploads/actions.ts` returns nothing).
- No `console.*` in any source file (`grep -R 'console\.' lib/uploads/ lib/validations/upload.ts` returns nothing).
- No extra dependencies added (pdf-lib, zod, drizzle-orm were already in package.json from Plans 02-01 / 02-02).

## Acceptance Verification

### Task 1

| Criterion | Result |
|-----------|--------|
| `lib/uploads/hash.ts` exports `sha256Hex` | PASS |
| `lib/uploads/pdf-validate.ts` exports `validatePdf`, `PdfValidation` | PASS |
| `lib/uploads/storage.ts` exports `writeUploadToDisk`, `UPLOADS_DIR` | PASS |
| `lib/uploads/errors.ts` exports `UploadErrorCode` union | PASS |
| `lib/validations/upload.ts` exports `FileInput`, `MAX_FILE_BYTES` (10485760), `MAX_BATCH_FILES` (10) | PASS |
| `npx vitest run lib/uploads/helpers.test.ts` passes ≥ 4 tests | PASS — 7/7 |
| `npx tsc --noEmit` passes | PASS |
| No `console.` in helpers | PASS |

### Task 2

| Criterion | Result |
|-----------|--------|
| `lib/uploads/actions.ts` starts with `"use server";` | PASS |
| `grep -q 'onConflictDoNothing' lib/uploads/actions.ts` | PASS (line 71) |
| `grep -q 'await sha256Hex' lib/uploads/actions.ts` | PASS (line 53) |
| sha256Hex call (line 53) precedes writeUploadToDisk call (line 76) | PASS |
| All 5 specified test cases pass | PASS — 6/6 (added an extra encrypted-PDF case) |
| Test file uses `@vitest-environment node` | PASS |
| No `throw` for user-visible errors | PASS |
| `npx tsc --noEmit` passes | PASS |

### Plan-level Success Criteria

| Criterion | Result |
|-----------|--------|
| UPLD-01: single-file upload via Server Action works end-to-end | PASS (actions.test.ts happy path) |
| UPLD-02 (server side): per-file independent error return shape | PASS (discriminated-union per call, never throws) |
| D-08 dedup enforced at BOTH DB (unique index) and app (onConflictDoNothing + fetch) | PASS (dedup test asserts single row after two uploads) |
| D-21 encryption + magic-byte validation rejects bad inputs before disk write | PASS (both checks run before any `writeUploadToDisk`) |

## Authentication Gates

None — the plan did not require any auth gate. The Server Action's own unauthenticated path is covered by the mocked-session test.

## Known Stubs

None. The action is fully wired end-to-end against real disk + real SQLite — no placeholder data sources remain.

## Self-Check: PASSED

- `lib/uploads/errors.ts` — FOUND
- `lib/uploads/hash.ts` — FOUND
- `lib/uploads/pdf-validate.ts` — FOUND
- `lib/uploads/storage.ts` — FOUND
- `lib/uploads/actions.ts` — FOUND
- `lib/uploads/helpers.test.ts` — FOUND
- `lib/uploads/actions.test.ts` — FOUND
- `lib/validations/upload.ts` — FOUND
- `scripts/make-encrypted-pdf.mjs` — FOUND
- `__fixtures__/encrypted.pdf` — FOUND
- `vitest.config.ts` — MODIFIED
- Commit `247aa9f` — FOUND
- Commit `9d9afbd` — FOUND
