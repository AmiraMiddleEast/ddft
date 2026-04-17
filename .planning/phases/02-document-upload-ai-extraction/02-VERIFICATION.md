---
phase: 02-document-upload-ai-extraction
verified: 2026-04-17T11:45:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Drag-drop UX on /upload — drag a PDF onto the dropzone card"
    expected: "Border color changes on hover, copy swaps to 'Zum Hochladen loslassen', on drop a row appears in queued state and progresses through uploading → extracting → done"
    why_human: "Real browser drag events cannot be simulated in vitest node environment; react-dropzone's drag-enter/drag-leave styling requires browser event dispatch"
  - test: "Batch upload progress — select all 4 repo-root PDFs simultaneously"
    expected: "4 rows appear; first 3 transition to 'Wird analysiert' in parallel; 4th waits (p-limit(3)); Sonner toast fires ONCE at batch completion with 'Analyse abgeschlossen.' or 'Analyse abgeschlossen. {n} Datei(en) mit Fehler.'"
    why_human: "p-limit concurrency gating and real file I/O timings require a running dev server; toast de-duplication via lastBatchSignal ref requires human observation"
  - test: "iframe PDF preview on /documents/{id}"
    expected: "Two-column layout renders; left iframe shows the PDF file at min-height 480px using /api/documents/{id}/pdf; right table shows 6 extracted fields with confidence badges; Skeleton rows appear while extraction is pending"
    why_human: "iframe rendering and cross-browser CSP behavior require a real browser; visual layout correctness (two-column breakpoint at lg) requires human inspection"
  - test: "Extraction accuracy against real German PDF (transcript.pdf) with live ANTHROPIC_API_KEY"
    expected: "All 6 fields populated with plausible German values; confidence levels match legibility of source; no fabricated Bundesland; 'Niedrig' badge shown for any unreadable field (not an error, acceptable D-12 behavior)"
    why_human: "Requires ANTHROPIC_API_KEY set in .env.local and a running Claude API call; extraction quality is subjective — requires human to compare extracted values against the physical document"
---

# Phase 02: Document Upload + AI Extraction — Verification Report

**Phase Goal:** User can upload PDF documents and receive AI-extracted structured data from them
**Verified:** 2026-04-17T11:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can upload a single PDF via file picker or drag-and-drop | VERIFIED | `UploadClient.tsx` uses `useDropzone` with `accept: { "application/pdf": [".pdf"] }`, `multiple: true`, renders a `<Button type="button">Dateien auswählen</Button>`; `uploadSingleDocumentAction` tested in 6 unit tests |
| 2 | User can upload multiple PDFs at once | VERIFIED | Dropzone configured with `maxFiles: MAX_BATCH_FILES` (10); `onDrop` processes `accepted: File[]` array; `runPipeline` called per file; batch state tracked in `rows` array |
| 3 | System displays extracted fields (6 fields) after upload | VERIFIED | `ExtractionTable.tsx` iterates `FIELD_NAMES` (6 fields from db/schema.ts); renders rows from `getExtractionsForDocument` DB query; data flows through `extractDocumentAction` → `extraction` table → `getExtractionsForDocument` → `ExtractionTable` |
| 4 | Each extracted field shows a confidence indicator (high/medium/low) | VERIFIED | `CONFIDENCE_VARIANT = { high: "secondary", medium: "warning", low: "destructive" }` mapped to Badge; `CONFIDENCE_LABEL = { high: "Hoch", medium: "Mittel", low: "Niedrig" }`; `warning` variant added to badge.tsx with CSS token `--color-warning: oklch(0.77 0.15 80)` |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `next.config.ts` | bodySizeLimit + proxyClientMaxBodySize = 15mb | VERIFIED | Both keys present at `"15mb"` |
| `package.json` | react-dropzone@15.0.0, pdf-lib@1.17.1, p-limit@7.3.0, @anthropic-ai/sdk@0.88.0 | VERIFIED | All four at exact pinned versions, no `^` or `~` |
| `.env.local.example` | ANTHROPIC_API_KEY placeholder | VERIFIED | `ANTHROPIC_API_KEY=` present (empty value, no real key) |
| `.gitignore` | data/uploads/ ignored | VERIFIED | `data/uploads/*` + `!data/uploads/.gitkeep` present |
| `db/schema.ts` | document, extraction, extraction_log tables with FKs + CHECK constraints | VERIFIED | All 3 tables, 3 ON DELETE CASCADE FKs, CHECK constraints for status/confidence/field_name, uniqueIndex on (user_id,sha256) and (document_id,field_name) |
| `lib/uploads/hash.ts` | sha256Hex(bytes) | VERIFIED | Exports `sha256Hex`, uses Web Crypto `crypto.subtle.digest` |
| `lib/uploads/pdf-validate.ts` | validatePdf(bytes) with magic byte + pdf-lib check | VERIFIED | Returns `{ok: true}`, `{ok:false, reason:"invalid_pdf"}`, `{ok:false, reason:"encrypted_pdf"}` |
| `lib/uploads/storage.ts` | writeUploadToDisk(id, bytes) | VERIFIED | Writes to `data/uploads/{id}.pdf`, returns relative path |
| `lib/uploads/errors.ts` | UploadErrorCode union type | VERIFIED | 7-value union exported |
| `lib/validations/upload.ts` | FileInput Zod schema + MAX_FILE_BYTES | VERIFIED | `MAX_FILE_BYTES = 10 * 1024 * 1024` |
| `lib/uploads/actions.ts` | uploadSingleDocumentAction Server Action | VERIFIED | `"use server"`, discriminated-union return, dedup via `onConflictDoNothing`, sha256 before write |
| `lib/extraction/prompt.ts` | EXTRACTION_PROMPT with 6 fields | VERIFIED | German-aware prompt, `<result>` envelope, all 6 field names |
| `lib/extraction/schema.ts` | ExtractionResponse Zod schema + parseExtractionResponse | VERIFIED | 6-field schema, `nullable()` on values, date regex validation |
| `lib/extraction/cost.ts` | computeCostEur + PRICING_PER_MTOK | VERIFIED | Sonnet 4 pricing, returns 0 for unknown models |
| `lib/extraction/claude.ts` | extractFields(storagePath) SDK wrapper | VERIFIED | `type: "document"`, `claude-sonnet-4-20250514`, content-block find |
| `lib/extraction/actions.ts` | extractDocumentAction Server Action | VERIFIED | `"use server"`, `db.transaction`, 6 field inserts + 1 log, status transitions, 429 retry |
| `app/(app)/upload/page.tsx` | /upload Server Component | VERIFIED | Exports default function, heading "Dokumente hochladen", renders `<UploadClient />` |
| `app/(app)/upload/_components/UploadClient.tsx` | Dropzone + batch state manager | VERIFIED | `"use client"`, `useDropzone`, `pLimit(3)`, `uploadSingleDocumentAction`, `extractDocumentAction`, Sonner toast in `useEffect` |
| `app/(app)/upload/_components/BatchRow.tsx` | Per-file row with status badge | VERIFIED | Status badges: secondary/outline/destructive, "Ansehen" link, "Erneut versuchen", "Entfernen" |
| `app/(app)/upload/_components/ErrorCopy.ts` | German error-code copy table | VERIFIED | All 7 error codes + `not_found` mapped to German strings |
| `components/ui/badge.tsx` | shadcn Badge + warning variant | VERIFIED | `warning` variant with `bg-[--color-warning]` present |
| `components/ui/progress.tsx` | shadcn Progress | VERIFIED | File exists (installed, not actively wired — acceptable for Phase 2) |
| `components/ui/separator.tsx` | shadcn Separator | VERIFIED | File exists, used in UploadClient |
| `app/(app)/documents/[id]/page.tsx` | Document detail Server Component | VERIFIED | `getDocumentForUser`, `getExtractionsForDocument`, `notFound()` on cross-user, two-column layout |
| `app/(app)/documents/[id]/_components/PdfPreview.tsx` | iframe wrapper | VERIFIED | `src=/api/documents/${id}/pdf`, fallback link |
| `app/(app)/documents/[id]/_components/ExtractionTable.tsx` | 6-row confidence table | VERIFIED | All 6 FIELD_NAMES, German labels, `— nicht erkannt` in destructive, Skeleton on pending |
| `app/api/documents/[id]/pdf/route.ts` | PDF streaming Route Handler | VERIFIED | Session-gated, owner-only via `getDocumentForUser(id, session.user.id)`, `Content-Type: application/pdf`, `Cache-Control: private, no-store`, 401/404/410 |
| `lib/documents/queries.ts` | getDocumentForUser, listRecentDocumentsForUser, getExtractionsForDocument | VERIFIED | `import "server-only"`, ownership-scoped queries, `getExtractionsForDocument` uses `innerJoin` + userId filter |
| `app/(app)/page.tsx` | Home page with CTA + recent uploads | VERIFIED | "Übersicht" heading, "Dokumente hochladen" CTA → /upload, "Zuletzt hochgeladen" table or empty state, `listRecentDocumentsForUser` |
| `__tests__/phase2-integration.test.ts` | End-to-end integration test | VERIFIED | 4 tests: happy path, dedup, cross-user 404, unauth 401 — all pass |
| `scripts/seed-extraction-fixture.ts` | Dev seed script | VERIFIED | File exists, idempotent via onConflictDoNothing |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `lib/uploads/actions.ts` | `lib/auth.ts` | `auth.api.getSession({ headers: await headers() })` | WIRED | Line 22 |
| `lib/uploads/actions.ts` | `db/schema.ts document` | `onConflictDoNothing({ target: [document.userId, document.sha256] })` | WIRED | Line 71 |
| `lib/uploads/actions.ts` | `lib/uploads/pdf-validate.ts` | `validatePdf(bytes)` before write | WIRED | Lines 47-50 |
| `lib/uploads/actions.ts` | `lib/uploads/hash.ts` | `sha256Hex` called before `writeUploadToDisk` | WIRED | Lines 53, 76 — sha before write confirmed |
| `lib/extraction/actions.ts` | `db/schema.ts document + extraction + extractionLog` | `db.transaction(tx => { ... })` with 6 inserts + 1 log + status update | WIRED | Lines 95-135 |
| `lib/extraction/claude.ts` | `@anthropic-ai/sdk` | `messages.create` with `type: "document"` content block | WIRED | Lines 38-51 |
| `lib/extraction/schema.ts` | `lib/extraction/prompt.ts` | `<result>...</result>` regex extraction + Zod.parse | WIRED | `parseExtractionResponse` uses `/<result>([\s\S]*?)<\/result>/` |
| `UploadClient.tsx` | `lib/uploads/actions.ts` | `uploadSingleDocumentAction(null, fd)` per-file | WIRED | Line 60 |
| `UploadClient.tsx` | `lib/extraction/actions.ts` | `extractLimit(() => extractDocumentAction(...))` with pLimit(3) | WIRED | Line 66 |
| `UploadClient.tsx` | sonner toast | `toast.success` / `toast.error` inside `useEffect` | WIRED | Lines 43-47 |
| `app/(app)/documents/[id]/page.tsx` | `lib/documents/queries.ts` | `getDocumentForUser + getExtractionsForDocument` | WIRED | Lines 36-41 |
| `PdfPreview.tsx` | `app/api/documents/[id]/pdf/route.ts` | `iframe src=/api/documents/${id}/pdf` | WIRED | Line 2-5 |
| `app/(app)/page.tsx` | `/upload` | `<Link href="/upload">Dokumente hochladen</Link>` | WIRED | CTA present |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `ExtractionTable.tsx` | `rows: ExtractionRow[]` | `getExtractionsForDocument(id, userId)` → Drizzle SELECT from `extraction` JOIN `document` | Yes — real DB query with userId ownership filter | FLOWING |
| `app/(app)/page.tsx` | `docs` | `listRecentDocumentsForUser(session.user.id, 5)` → Drizzle SELECT from `document` | Yes — real DB query, descending by `uploadedAt`, limit 5 | FLOWING |
| `app/(app)/documents/[id]/page.tsx` | `doc`, `rows` | `getDocumentForUser` + `getExtractionsForDocument` — conditionally skipped when `pending=true` | Yes — DB queries, ownership-scoped | FLOWING |
| `app/api/documents/[id]/pdf/route.ts` | `bytes` | `readFile(path.resolve(process.cwd(), doc.storagePath))` | Yes — reads actual file from disk at stored path | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 53 vitest tests pass | `npx vitest run` | 15 test files, 53 tests, 0 failures, 7.42s | PASS |
| TypeScript compilation clean | `npx tsc --noEmit` | No output (exit 0) | PASS |
| SQLite DB has all 3 Phase 2 tables | `sqlite3 data/angela.db ".tables"` | `document extraction extraction_log` all present | PASS |
| Package versions exact-pinned | `package.json` | `react-dropzone@15.0.0`, `pdf-lib@1.17.1`, `p-limit@7.3.0`, `@anthropic-ai/sdk@0.88.0` | PASS |
| Server Action body limits set | `next.config.ts` | `bodySizeLimit: "15mb"`, `proxyClientMaxBodySize: "15mb"` | PASS |
| Warning CSS token present | `app/globals.css` | `--color-warning: oklch(0.77 0.15 80)` | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| UPLD-01 | 02-03, 02-05 | Single PDF via file picker or drag-and-drop | SATISFIED | react-dropzone + uploadSingleDocumentAction + 6 unit tests including valid PDF acceptance |
| UPLD-02 | 02-03, 02-05 | Multiple PDFs at once (batch upload) | SATISFIED | Batch state machine in UploadClient, p-limit(3) concurrency, MAX_BATCH_FILES=10 |
| EXTR-01 | 02-04, 02-06 | Structured extraction via Claude Vision (6 fields) | SATISFIED | extractDocumentAction → claude.ts → ExtractionTable renders 6 fields from DB |
| EXTR-02 | 02-04, 02-06 | Confidence indicators (high/medium/low) per extracted field | SATISFIED | confidence column in extraction table, CONFIDENCE_VARIANT badge mapping, Zod schema enforces enum |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/(app)/documents/[id]/page.tsx` | 100 | `<Button disabled title="Verfügbar in der nächsten Version.">Zur Überprüfung</Button>` | Info | Intentional Phase 3 teaser — disabled button per UI-SPEC. Not a stub; no data flows through it. |

No blockers or warnings found. The disabled button is documented as a Phase 3 integration point in the plan spec.

### Human Verification Required

Four manual-only behaviors from `02-VALIDATION.md` were auto-approved in autonomous mode per user instruction. They remain unverified in a real browser and require operator sign-off before Phase 2 is considered fully shipped.

#### 1. Dropzone drag-drop UX (UPLD-01)

**Test:** Navigate to `/upload`. Drag `Publication_Record_SH.pdf` from Finder onto the dropzone card.
**Expected:** Border changes to `border-primary` on hover, copy changes to "Zum Hochladen loslassen", on release a row appears showing the filename and transitions from "In Warteschlange" → "Wird hochgeladen" → "Wird analysiert" → "Fertig". Also test: drop a non-PDF — expect inline red message under the dropzone.
**Why human:** Real browser drag events cannot be dispatched in vitest; react-dropzone's visual drag-enter/drag-leave state requires browser rendering.

#### 2. Batch upload progress — p-limit(3) gating (UPLD-02)

**Test:** Select 4 PDFs simultaneously from the file picker (or drop them all at once).
**Expected:** All 4 rows appear immediately as "In Warteschlange". The first 3 transition to "Wird analysiert" in parallel; the 4th waits until one slot frees up. Sonner toast fires EXACTLY once when the last row settles.
**Why human:** Real p-limit gating timing and the single-toast de-duplication via `lastBatchSignal` ref require a running dev server and human observation of the UI.

#### 3. iframe PDF preview (EXTR-01)

**Test:** Click "Ansehen" on a completed upload row (or navigate to `/documents/{id}` directly).
**Expected:** Two-column layout renders — left: iframe sourced from `/api/documents/{id}/pdf` showing the PDF at min-height 480px; right: table of 6 extracted fields each with a colored confidence Badge (Hoch/Mittel/Niedrig). While pending: Skeleton rows visible with "Analyse läuft …" text.
**Why human:** iframe rendering and cross-browser CSP behavior require a real browser; visual layout at the `lg` breakpoint requires human inspection.

#### 4. Extraction accuracy (EXTR-01, EXTR-02)

**Test:** Requires `ANTHROPIC_API_KEY` in `.env.local`. Upload `transcript.pdf` via the upload page. Navigate to the resulting `/documents/{id}`.
**Expected:** All 6 fields show plausible German values extracted from the document. Confidence badges reflect legibility. No fabricated Bundesland for a German document. Fields that are genuinely unreadable may show "— nicht erkannt" in destructive red with "Niedrig" badge — this is acceptable D-12 behavior, not a defect.
**Why human:** Requires a live Claude API call; extraction quality is subjective — requires a human to compare extracted values against the physical source document.

**Setup instructions:** `ANTHROPIC_API_KEY=sk-... npm run dev`, sign in, upload PDFs. Alternatively run `npx tsx scripts/seed-extraction-fixture.ts` to seed a pre-populated document view without burning API tokens (verifies rendering but not actual extraction accuracy).

### Gaps Summary

No automated gaps found. All 4 roadmap success criteria are verified through the codebase. The 53 vitest tests (including 4 Phase 2 integration tests) pass. TypeScript compiles cleanly. All key links are wired and data flows from DB queries through to rendered components.

The sole outstanding items are the 4 manual UAT behaviors documented in `02-VALIDATION.md` that were auto-approved in autonomous mode and require operator sign-off in a real browser session with a real API key.

---

_Verified: 2026-04-17T11:45:00Z_
_Verifier: Claude (gsd-verifier)_
