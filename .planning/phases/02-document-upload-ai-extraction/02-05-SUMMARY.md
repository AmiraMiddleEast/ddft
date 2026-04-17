---
phase: 02-document-upload-ai-extraction
plan: 05
subsystem: ui
tags: [upload, react-dropzone, p-limit, sonner, shadcn, server-actions]

requires:
  - phase: 02-document-upload-ai-extraction
    provides: "uploadSingleDocumentAction (Plan 03), extractDocumentAction (Plan 04), ERROR_COPY source (UploadErrorCode union)"
provides:
  - "/upload route (Server Component) reachable from authenticated (app) group"
  - "UploadClient orchestrator: per-file pipeline upload -> extract with p-limit(3) fan-out"
  - "BatchRow + ErrorCopy: shadcn Badge-based status UI with locked German copy"
  - "shadcn badge/progress/separator vendored; new 'warning' Badge variant for medium-confidence"
  - "--color-warning / --color-warning-foreground Tailwind v4 @theme tokens"
affects: [02-06-documents-detail, 02-07-ui-polish, 03-review-edit]

tech-stack:
  added: []  # react-dropzone@15 and p-limit@7 were already installed in prior plans
  patterns:
    - "Client-side per-file Server Action invocation (one FormData per request to stay under Next 16 body limit)"
    - "p-limit(3) module-scoped concurrency gate around extractDocumentAction"
    - "Batch-complete toast via useEffect with string-signal ref discriminator (fires exactly once per batch transition)"
    - "shadcn custom cva variant via raw CSS custom-property (--color-warning) when the variant is state-only (not a theme-wide addition)"

key-files:
  created:
    - "app/(app)/upload/page.tsx"
    - "app/(app)/upload/_components/UploadClient.tsx"
    - "app/(app)/upload/_components/BatchRow.tsx"
    - "app/(app)/upload/_components/ErrorCopy.ts"
    - "components/ui/badge.tsx"
    - "components/ui/progress.tsx"
    - "components/ui/separator.tsx"
  modified:
    - "components/ui/badge.tsx  (added 'warning' variant)"
    - "app/globals.css  (added --color-warning, --color-warning-foreground tokens)"

key-decisions:
  - "Used Next Link styled via buttonVariants() instead of <Button asChild> for the 'Ansehen' action — the project's Button is @base-ui/react, not Radix Slot, so it has no asChild prop."
  - "Reset lastBatchSignal ref on every new drop so follow-up drops in the same session re-trigger the completion toast."
  - "Rejected files show inline red copy for 5s; self-clearing setTimeout avoids adding another piece of state."

patterns-established:
  - "Fan-out pattern: server action (upload) -> p-limit(concurrency=3) server action (extract) per file, with per-file state held in React and updated via a small patch() helper."
  - "Locked German copy pulled from ERROR_COPY — no inline error strings in components."

requirements-completed: [UPLD-01, UPLD-02, EXTR-01, EXTR-02]

duration: 4min
completed: 2026-04-17
---

# Phase 02 Plan 05: Upload UI + Client Orchestration Summary

**`/upload` route with react-dropzone, p-limit(3) fan-out of upload+extract Server Actions, and locked German per-row status UI.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-17T05:08:06Z
- **Completed:** 2026-04-17T05:11:55Z
- **Tasks:** 2
- **Files created:** 7
- **Files modified:** 2

## Accomplishments

- `/upload` Server Component page rendering inside the authenticated `(app)` group (inherits session gate).
- `UploadClient` (`"use client"`) integrates `react-dropzone` inside a shadcn Card with the locked UI-SPEC copy ("PDFs hierher ziehen" / "Zum Hochladen loslassen") and wires an accept filter of `application/pdf` + 10 MB / 10-file caps.
- Per-file pipeline: `uploadSingleDocumentAction(null, FormData)` → on success → `extractDocumentAction(documentId)`, with the extraction fan-out gated by `pLimit(3)` (module-scoped) so that the upload phase stays parallel but Claude-bound extraction respects the rate-limit discipline from RESEARCH.
- Status rows transition `queued → uploading → extracting → done|error` with the UI-SPEC Badge palette (`secondary` / `secondary+spinner` / `outline` / `destructive`) and locked German copy from `ERROR_COPY`.
- Batch-complete Sonner toast fires exactly once per batch transition via a `useEffect` + signal-string `useRef` discriminator (no toast-in-Server-Action anti-pattern).
- `Erneut versuchen` re-runs the same file through the pipeline (using the retained `File` in an inflight `Map<string, File>` ref) and re-arms the toast discriminator.
- Installed shadcn `badge`, `progress`, `separator`; added a `warning` variant to `badge.tsx` and the matching `--color-warning` / `--color-warning-foreground` OKLCH tokens to `@theme inline` in `app/globals.css` (reserved for medium-confidence usage in Plan 06).

## Task Commits

Each task was committed atomically:

1. **Task 1: Install shadcn components + add --color-warning theme tokens** — `4d9a489` (chore)
2. **Task 2: /upload page + UploadClient + BatchRow + ErrorCopy** — `6bb7064` (feat)

## Files Created/Modified

- `app/(app)/upload/page.tsx` — Server Component; title, heading, subtext, mounts `<UploadClient />`.
- `app/(app)/upload/_components/UploadClient.tsx` — `"use client"`; dropzone + batch state manager + p-limit fan-out + completion toast.
- `app/(app)/upload/_components/BatchRow.tsx` — per-file row with Badge + action (Ansehen / Erneut versuchen / Entfernen).
- `app/(app)/upload/_components/ErrorCopy.ts` — `ERROR_COPY: Record<UploadErrorCode | "not_found", string>` with verbatim UI-SPEC German strings.
- `components/ui/badge.tsx` — shadcn Badge + new `warning` variant (reads `--color-warning`).
- `components/ui/progress.tsx` — shadcn Progress (vendored; not wired yet per plan note — reserved for later use).
- `components/ui/separator.tsx` — shadcn Separator (used between dropzone and batch list).
- `app/globals.css` — two new OKLCH tokens inside the existing `@theme inline` block.

## Decisions Made

- **Button `asChild` replacement:** The vendored Button wraps `@base-ui/react/button`, which does not implement an `asChild` prop (unlike Radix). The plan snippet used `<Button asChild variant="ghost" size="sm"><Link /></Button>`; this was replaced by `<Link className={buttonVariants({ variant: "ghost", size: "sm" })}>` to preserve visual parity without introducing a TS error.
- **Dropzone typing:** Imported `FileRejection` from `react-dropzone` and used it as the parameter type for `onDrop` (instead of the hand-written structural type in the plan snippet, which conflicted with `readonly FileError[]`).
- **Toast re-arm on new drop:** Added `lastBatchSignal.current = ""` at the end of `onDrop` (in addition to the retry path). Without this, a second drop whose row count happens to collide with the previous signal string would silently skip its toast.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Button does not support `asChild`**
- **Found during:** Task 2 (first `npx tsc --noEmit` run).
- **Issue:** `TS2322` — `BatchRow.tsx` used `<Button asChild variant="ghost" size="sm">` as shown in the plan snippet, but the project's Button is built on `@base-ui/react/button` (not Radix `Slot`) and has no `asChild` prop. Build would fail.
- **Fix:** Imported `buttonVariants` + `cn`; replaced the wrapper with `<Link className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>` for visual equivalence. This matches Next's own recommendation for styled `Link` navigation.
- **Files modified:** `app/(app)/upload/_components/BatchRow.tsx`
- **Verification:** `npx tsc --noEmit` clean; Ansehen action still renders as a ghost-sm button and navigates to `/documents/{id}`.
- **Committed in:** `6bb7064` (Task 2 commit)

**2. [Rule 3 - Blocking] `react-dropzone` `FileRejection.errors` is `readonly FileError[]`**
- **Found during:** Task 2 (same `tsc` run).
- **Issue:** `TS2322` — `onDrop: (accepted, rejected: { file: File; errors: { code: string }[] }[])` was incompatible with the library's `readonly FileError[]` tuple.
- **Fix:** Imported the library's own `FileRejection` type and used it directly.
- **Files modified:** `app/(app)/upload/_components/UploadClient.tsx`
- **Verification:** `npx tsc --noEmit` clean; no behavior change — still reads `rejected[0].errors[0]?.code`.
- **Committed in:** `6bb7064` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — Blocking type errors caused by plan-snippet drift from the actual in-repo Button / react-dropzone types).
**Impact on plan:** None to behavior, UX, or acceptance criteria. Both fixes are compile-time-only adjustments; the runtime contract is preserved byte-for-byte.

## Issues Encountered

- None beyond the two type drift fixes documented above.

## Verification

- `npx tsc --noEmit` — clean (no output).
- `npm run test:run` — 49/49 tests pass (no regressions; this plan adds no new tests per plan scope).
- `npm run lint` — 0 errors. 2 pre-existing warnings in `activepieces_logic.js` (out of scope per SCOPE BOUNDARY).
- All automated `grep` acceptance checks pass (`useDropzone`, `pLimit(3)`, `uploadSingleDocumentAction`, `extractDocumentAction`, `Analyse abgeschlossen`, `Dokumente hochladen`).
- `grep -R 'TODO' app/(app)/upload/` — empty.

## User Setup Required

None.

## Next Phase Readiness

- `/upload` is the surface UPLD-01 / UPLD-02 / EXTR-01 / EXTR-02 user-acceptance paths run against.
- Plan 06 (`/documents/[id]`) can now deep-link in from the `Ansehen` ghost link on completed rows.
- The `warning` Badge variant + CSS tokens are ready for the medium-confidence badge on the detail page (Plan 06) — no further CSS changes needed there.
- `Progress` component is vendored but not yet wired; Plan 06/07 can adopt it for the document detail skeleton / extraction-running state.

## Self-Check: PASSED

Verified via filesystem + git:

- `app/(app)/upload/page.tsx` — FOUND
- `app/(app)/upload/_components/UploadClient.tsx` — FOUND
- `app/(app)/upload/_components/BatchRow.tsx` — FOUND
- `app/(app)/upload/_components/ErrorCopy.ts` — FOUND
- `components/ui/badge.tsx` — FOUND (with `warning:` variant)
- `components/ui/progress.tsx` — FOUND
- `components/ui/separator.tsx` — FOUND
- `app/globals.css` — contains `--color-warning`, `--color-warning-foreground`
- Commit `4d9a489` — FOUND
- Commit `6bb7064` — FOUND

---
*Phase: 02-document-upload-ai-extraction*
*Completed: 2026-04-17*
