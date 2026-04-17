---
phase: 02-document-upload-ai-extraction
plan: 06
subsystem: ui
tags: [nextjs, server-components, route-handler, shadcn, drizzle, pdf-preview]

requires:
  - phase: 02-document-upload-ai-extraction
    provides: "document + extraction tables; upload flow persists PDFs under data/uploads/{id}.pdf"

provides:
  - "Document detail surface at /documents/[id] with two-column layout (PDF preview + 6-field extraction table)"
  - "Session-gated PDF streaming endpoint GET /api/documents/[id]/pdf (owner-only, 401/404)"
  - "Home page (/) updated with 'Übersicht' heading, primary 'Dokumente hochladen' CTA, and 'Zuletzt hochgeladen' table (last 5 uploads)"
  - "Server-only query helpers: getDocumentForUser, listRecentDocumentsForUser, getExtractionsForDocument"
  - "Shadcn Table + Skeleton primitives vendored"

affects: [phase-3-review-authority-lookup, phase-4-case-grouping, phase-5-reupload]

tech-stack:
  added: [shadcn-table, shadcn-skeleton]
  patterns:
    - "server-only query modules co-located under lib/documents/"
    - "owner-scoped Drizzle queries (userId filter in WHERE, no separate RBAC layer)"
    - "asset route handlers using path.resolve(process.cwd(), storagePath) with private no-store cache"
    - "link-as-button via buttonVariants() (project Button is base-ui, no asChild/Slot support)"

key-files:
  created:
    - "app/(app)/documents/[id]/page.tsx"
    - "app/(app)/documents/[id]/_components/PdfPreview.tsx"
    - "app/(app)/documents/[id]/_components/ExtractionTable.tsx"
    - "app/api/documents/[id]/pdf/route.ts"
    - "lib/documents/queries.ts"
    - "components/ui/table.tsx"
    - "components/ui/skeleton.tsx"
  modified:
    - "app/(app)/page.tsx"

key-decisions:
  - "Iframe PDF preview via route handler, not public static path — preserves per-request ownership enforcement"
  - "Cache-Control: private, no-store on PDF stream to prevent shared/CDN caching of private docs"
  - "Confidence badge variants locked: high→secondary, medium→warning, low→destructive (UI-SPEC)"
  - "Missing extraction values render as '— nicht erkannt' in destructive color with a Niedrig badge (never omit badge)"
  - "No tests added — plan authored with no TDD flag and Plan 02-07 owns the verification sweep"

patterns-established:
  - "Pattern: server-only query modules — import 'server-only' at top; functions accept (resourceId, userId) to enforce ownership in the query itself"
  - "Pattern: Route Handler file-streaming — resolve storagePath against cwd, read buffer, convert to sliced ArrayBuffer for Response, set Content-Type/Length/Disposition/Cache-Control"
  - "Pattern: link-as-button — use <Link className={buttonVariants({variant, size})}> when semantics require anchor tag (this project's Button primitive is base-ui and does not expose asChild)"

requirements-completed: [EXTR-01, EXTR-02, UPLD-01, UPLD-02]

duration: 18min
completed: 2026-04-17
---

# Phase 02 Plan 06: Document Detail Surface + PDF Streaming + Home Update Summary

**Document detail page with iframe PDF preview and 6-field confidence-badged extraction table, session-gated PDF Route Handler, and home page rebuilt around 'Übersicht' with an upload CTA and a 5-row recent-uploads table.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-04-17T05:00:00Z (approx)
- **Completed:** 2026-04-17T05:18:59Z
- **Tasks:** 3/3
- **Files created:** 7
- **Files modified:** 1

## Accomplishments
- `/documents/[id]` renders a two-column layout: left iframe PDF preview (min-height 480px) inside a shadcn Card, right table of all 6 extraction fields with German labels and confidence badges
- `/api/documents/[id]/pdf` streams the stored PDF file only to the authenticated owner (401 unauthenticated, 404 if not owned, 410 if file missing on disk), with `Cache-Control: private, no-store`
- Home page (`/`) now shows "Übersicht" heading, primary "Dokumente hochladen" CTA linking to `/upload`, and a "Zuletzt hochgeladen" table of the last 5 documents with status badges — empty state reads "Noch keine Dokumente"
- Query module (`lib/documents/queries.ts`) exports three server-only helpers scoped by user id
- Skeleton loading state and extraction error banner wired into the detail page

## Task Commits

1. **Task 1: queries + PDF route + shadcn table/skeleton** — `482c7eb` (feat)
2. **Task 2: document detail page + PdfPreview + ExtractionTable** — `2b1fe0e` (feat)
3. **Task 3: home page 'Übersicht' + upload CTA + recent list** — `be218be` (feat)

## Files Created/Modified
- `lib/documents/queries.ts` — server-only Drizzle helpers (getDocumentForUser, listRecentDocumentsForUser, getExtractionsForDocument) with user-scoped filters
- `app/api/documents/[id]/pdf/route.ts` — GET handler; reads file from resolved storagePath and streams as application/pdf, owner-gated
- `app/(app)/documents/[id]/page.tsx` — Server Component with session + ownership check, breadcrumb, two-column layout, error/pending branches
- `app/(app)/documents/[id]/_components/PdfPreview.tsx` — iframe wrapper with fallback link
- `app/(app)/documents/[id]/_components/ExtractionTable.tsx` — 6-row table; confidence badges (high→secondary, medium→warning, low→destructive); "— nicht erkannt" in destructive color; Skeleton rows when pending
- `components/ui/table.tsx`, `components/ui/skeleton.tsx` — shadcn primitives (new-york preset)
- `app/(app)/page.tsx` — rewritten: Übersicht heading, Dokumente hochladen CTA, recent-uploads table or empty state

## Decisions Made
- **Iframe over pdf.js** — iframe preview matches UI-SPEC D-Discretion decision; lightweight, native browser PDF rendering, no added bundle cost
- **Route Handler for PDF serving** — chosen over exposing `data/uploads/` as a public path so ownership is enforced on every fetch
- **ArrayBuffer slice for Response body** — explicitly convert Buffer to `ArrayBuffer` slice to satisfy TypeScript's Response body types under Node 20+
- **buttonVariants on Link instead of asChild** — the vendored Button is built on `@base-ui/react/button` and does not accept the Radix Slot `asChild` prop; using `buttonVariants()` on a `<Link>` preserves identical styling without touching the shared Button primitive

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Button `asChild` not supported by project's base-ui Button primitive**
- **Found during:** Task 3 (home page rewrite)
- **Issue:** Plan-provided snippet used `<Button asChild><Link ...>` but `components/ui/button.tsx` uses `@base-ui/react/button`, which does not accept an `asChild` prop. `npx tsc --noEmit` failed with "Property 'asChild' does not exist on type 'ButtonProps'".
- **Fix:** Replaced `<Button asChild>` + nested `<Link>` with `<Link className={buttonVariants({variant, size})}>` at three call sites (header CTA, empty-state CTA, recent-list row action). Same visual output, type-safe.
- **Files modified:** `app/(app)/page.tsx`
- **Verification:** `npx tsc --noEmit` passes clean; all grep acceptance checks (Übersicht, Dokumente hochladen, Zuletzt hochgeladen, listRecentDocumentsForUser, Noch keine Dokumente, no residual "Willkommen") pass.
- **Committed in:** `be218be` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Cosmetic-only adaptation to the local Button primitive. No scope creep; no behavior change.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None — no new environment variables, services, or manual configuration.

## Next Phase Readiness
- Phase 2 surfaces fully wired: upload (Plan 05) → detail (this plan) → home recent list
- Plan 02-07 (final phase sweep) can now run: end-to-end smoke + verification of EXTR-01/02, UPLD-01/02, plus the cross-user 404 and 401 paths on the PDF route
- Phase 3 (authority lookup + review) will drop in on the existing `/documents/[id]` page — the disabled "Zur Überprüfung" button is the integration point

## Self-Check: PASSED

- `lib/documents/queries.ts` — FOUND
- `app/api/documents/[id]/pdf/route.ts` — FOUND
- `app/(app)/documents/[id]/page.tsx` — FOUND
- `app/(app)/documents/[id]/_components/PdfPreview.tsx` — FOUND
- `app/(app)/documents/[id]/_components/ExtractionTable.tsx` — FOUND
- `components/ui/table.tsx` — FOUND
- `components/ui/skeleton.tsx` — FOUND
- `app/(app)/page.tsx` — FOUND (modified)
- Commit `482c7eb` — FOUND
- Commit `2b1fe0e` — FOUND
- Commit `be218be` — FOUND
- `npx tsc --noEmit` — CLEAN

---
*Phase: 02-document-upload-ai-extraction*
*Completed: 2026-04-17*
