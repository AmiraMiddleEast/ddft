---
phase: 5
plan: "05-03"
subsystem: re-upload
tags: [upload, versioning, ui]
requires: [05-01]
provides: [replaceDocumentPdfAction, reanalyzeDocumentAction, ReplaceScanDialog, ReanalyzeButton]
affects: [lib/uploads/, lib/extraction/, app/(app)/documents/[id]/]
tech_stack_added: []
key_files_created:
  - lib/uploads/replace.ts
  - lib/uploads/replace.test.ts
  - lib/extraction/reanalyze.ts
  - app/(app)/documents/[id]/_components/ReplaceScanDialog.tsx
  - app/(app)/documents/[id]/_components/ReanalyzeButton.tsx
key_files_modified:
  - app/(app)/documents/[id]/page.tsx
decisions:
  - Archive OLD version row into document_version BEFORE updating document row
  - Write new file as data/uploads/{docId}-v{N}.pdf (prior file preserved)
  - Synchronous db.transaction ensures atomic archive+bump
  - Added reanalyzeDocumentAction wrapper (Rule 2 — extractDocumentAction short-circuits when status=done)
  - reanalyze wipes stale extraction rows + resets status inside one transaction
  - Cleanup orphan file on DB failure via fs.unlink
tasks_completed: 2
task_commits:
  - f0ac055: feat(05-03) add replaceDocumentPdfAction with version history
  - a7fbe92: feat(05-03) add re-upload dialog + re-analyze button on doc detail
duration: ~12min
completed: 2026-04-17
---

# Phase 5 Plan 03: Document Re-upload Summary

**One-liner:** `replaceDocumentPdfAction` + `ReplaceScanDialog` let users upload a better scan in place while preserving prior versions via `document_version`; `ReanalyzeButton` re-runs Claude extraction on demand.

## What Was Built

### Server Action (`lib/uploads/replace.ts`)
- `replaceDocumentPdfAction(documentId, formData)` → `{ok,newVersion,storagePath} | {ok:false,error}`
- Pipeline: session gate → ownership → PDF validation → sha256 → write new file → archive old row + bump version inside one sync transaction
- Orphan file cleanup on DB failure (`fs.unlink`)
- Error codes: `unauthenticated`, `not_found`, `no_file`, `invalid_pdf`, `encrypted_pdf`, `file_too_large`, `db_error`

### Re-analyze Action (`lib/extraction/reanalyze.ts`)
- New `reanalyzeDocumentAction(documentId)` wrapper
- Deletes stale `extraction` rows + resets `document.extraction_status` to `pending` + clears `errorCode` in one sync transaction
- Then calls existing `extractDocumentAction(documentId)` which now runs end-to-end

### UI Components
- `ReplaceScanDialog.tsx` — shadcn Dialog + react-dropzone (single PDF, 10MB cap); shows selected filename; Abbrechen/Hochladen footer; toasts + error banner; `router.refresh()` on success
- `ReanalyzeButton.tsx` — useTransition button calling `reanalyzeDocumentAction`; shows "Wird analysiert …" while pending
- `app/(app)/documents/[id]/page.tsx` header split: metadata on left, `ReplaceScanDialog` + `ReanalyzeButton` on right; now shows `Version {N}`

### Tests
- 4 unit tests in `lib/uploads/replace.test.ts`:
  - Happy path: v1 → v2 with document_version archived and storagePath updated
  - Unauthenticated gate
  - Invalid PDF rejected (no version bump, no document_version row)
  - Cross-user blocked (zero-leak `not_found`)
- All pass (`lib/uploads --no-file-parallelism` → 17/17 green)

## Verification

```
grep "replaceDocumentPdfAction" lib/uploads/replace.ts  — match
test -f app/(app)/documents/[id]/_components/ReplaceScanDialog.tsx — ok
test -f app/(app)/documents/[id]/_components/ReanalyzeButton.tsx — ok
grep "Neuer Scan hochladen" app/(app)/documents/[id]/_components/ReplaceScanDialog.tsx — match
npx tsc --noEmit — clean
```

## Deviations from Plan

**[Rule 2 - Missing critical functionality] Added `reanalyzeDocumentAction` wrapper**
- **Found during:** Task 05-03-02 implementation
- **Issue:** `extractDocumentAction` is idempotent — it short-circuits with `ok:true` when `extractionStatus='done'`. Plan prescribed calling it directly from ReanalyzeButton, which means the button would have no effect when the document already finished extracting.
- **Fix:** Introduced `lib/extraction/reanalyze.ts` that resets status + wipes extraction rows in one transaction before delegating to `extractDocumentAction`. Button now calls the wrapper.
- **Files modified:** `lib/extraction/reanalyze.ts` (new); `app/(app)/documents/[id]/_components/ReanalyzeButton.tsx` imports new wrapper
- **Commit:** a7fbe92

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: lib/uploads/replace.ts
- FOUND: lib/uploads/replace.test.ts
- FOUND: lib/extraction/reanalyze.ts
- FOUND: app/(app)/documents/[id]/_components/ReplaceScanDialog.tsx
- FOUND: app/(app)/documents/[id]/_components/ReanalyzeButton.tsx
- FOUND: f0ac055 (feat(05-03): add replaceDocumentPdfAction with version history)
- FOUND: a7fbe92 (feat(05-03): add re-upload dialog + re-analyze button on doc detail)
