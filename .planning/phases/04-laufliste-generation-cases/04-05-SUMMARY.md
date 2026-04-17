---
phase: 04-laufliste-generation-cases
plan: 05
subsystem: cases-ui
tags: [ui, cases, shadcn, forms, laufliste]
dependency_graph:
  requires:
    - 04-02-cases-domain
    - 04-04-laufliste-generation
  provides:
    - /cases (list route)
    - /cases/new (create form)
    - /cases/[id] (detail route + add/remove/reorder + generate CTA)
    - Top-nav Fälle link
  affects:
    - app/(app)/layout.tsx (nav bar)
    - app/(app)/page.tsx (home CTA row)
tech_stack:
  added: []
  patterns:
    - "useTransition wrapper for Server Action calls from client components"
    - "Optimistic list reorder with rollback on action failure"
    - "aria-live status region for reorder announcements"
    - "Controlled-form pattern (Phase 3 Plan 05 precedent) with local Zod-mirrored validation"
key_files:
  created:
    - app/(app)/cases/page.tsx
    - app/(app)/cases/new/page.tsx
    - app/(app)/cases/new/CreateCaseForm.tsx
    - app/(app)/cases/[id]/page.tsx
    - app/(app)/cases/[id]/CaseDetailClient.tsx
    - app/(app)/cases/[id]/DocumentsTable.tsx
    - app/(app)/cases/[id]/AddDocumentsSheet.tsx
    - app/(app)/cases/[id]/RemoveDocumentDialog.tsx
    - app/(app)/cases/[id]/RegenerateDialog.tsx
    - __tests__/ui/cases-list.test.tsx
    - __tests__/ui/case-detail.test.tsx
  modified:
    - app/(app)/layout.tsx
    - app/(app)/page.tsx
decisions:
  - Mirror Phase 3 Plan 05 ReviewForm controlled-form pattern (useState + useTransition) rather than introducing react-hook-form for the small create-case form
  - Count documents per case on the list page via a secondary groupBy query merged client-side (avoids altering the Plan 02 listCasesForUser query)
  - Optimistic reorder in DocumentsTable — swap rows immediately, rollback on action failure; keeps UI responsive under slower networks
  - Pass assignableDocs server-rendered from page.tsx into the Sheet (CONTEXT D-04 recommendation) instead of a second Server Action on sheet open
  - AddDocumentsSheet is mounted both in the Documents card header and inside the DocumentsTable empty state so a user with zero docs still has a single CTA
  - Top-nav Fälle/Hochladen links added to app layout for one-click navigation between the three main surfaces
metrics:
  duration: "~9 minutes"
  completed: 2026-04-17
  tasks_completed: 3
  deviations: 2
  tests_added: 2 files / 4 test cases
  loc_added: ~1280
---

# Phase 4 Plan 05: Cases UI Summary

Three new UI routes — `/cases`, `/cases/new`, `/cases/[id]` — that wrap the Plan 02 case Server Actions and the Plan 04 Laufliste generation action with German-verbatim copy, optimistic reorder, and blocker-aware generate CTA.

## Commits

| Hash       | Message                                                                          |
| ---------- | -------------------------------------------------------------------------------- |
| `c324c3a`  | feat(04-05): add /cases list + /cases/new create form                            |
| `79db898`  | feat(04-05): add /cases/[id] detail page + documents table + generate CTA        |
| `e72fd3e`  | feat(04-05): add AddDocumentsSheet + remove/regenerate dialogs                   |
| `61fd0da`  | feat(04-05): add top-nav links to /cases and /upload + home Fälle CTA            |
| `308ace3`  | test(04-05): add UI render tests for cases list + case detail                    |

## Tasks Executed

### Task 1 — `/cases` list + `/cases/new` create form (commit `c324c3a`)
- `/cases` server component with ownership-scoped `listCasesForUser`, status badges (`In Bearbeitung` / `Bereit` / `Laufliste erstellt`), secondary `groupBy` for per-case document counts, empty-state card with CTA
- `/cases/new` wraps a 560px Card around `CreateCaseForm`
- `CreateCaseForm` (client): controlled state for personName / personBirthdate / notes, local Zod-mirrored validation (`Pflichtfeld.` / `Bitte ein gültiges Datum eingeben.` / `Eingabe ist zu lang.`), focus-first-error on submit, toast on success + redirect, toast on server error
- tsc clean.

### Task 2 — `/cases/[id]` detail page + DocumentsTable + CaseDetailClient (commit `79db898`)
- Server component with `getCaseForUser` ownership guard → `notFound()` on mismatch (prevents case-id enumeration, T-04-19)
- Parallel loads documents / lauflisten / assignableDocs
- Person header card with status badge, breadcrumb `Übersicht / Fälle / {person_name}`, dd.MM.yyyy birthdate formatter, `— nicht hinterlegt` placeholder for empty meta
- Blocker banners: `Bitte mindestens ein Dokument hinzufügen.` (empty) / `Mindestens ein Dokument ist noch nicht geprüft.` (any unapproved)
- `DocumentsTable` (client): position column, filename, status badges (`Geprüft` outline / `Noch nicht geprüft` warning), `Ansehen` link to `/documents/[id]`, up/down arrow `icon-sm` buttons with tooltips and disabled edge states, `Entfernen` destructive button
- Optimistic reorder via `useTransition` with rollback on action failure; `aria-live` status region announces `Position {n} von {total}.` (UI-SPEC Interaction Contract)
- `CaseDetailClient` (client): primary CTA swaps between `Laufliste generieren` (first time) and `Erneut generieren` (subsequent); disabled+tooltip on empty/unreviewed; inline `Loader2Icon` + label `Laufliste wird erstellt …` while pending; calls `generateLauflisteAction` via `useTransition`; `router.refresh()` on success; regenerate click opens `RegenerateDialog` first
- Historie card with per-row download links pointed at `/api/cases/[id]/laufliste/[lauflisteId]/download` (route handler lands in Plan 06)
- tsc clean.

### Task 3 — AddDocumentsSheet + RemoveDocumentDialog + RegenerateDialog (commit `e72fd3e`)
- `AddDocumentsSheet`: shadcn `Sheet` right side, 480px max-width, assignableDocs rendered as a scrollable table with Checkbox column + accent/10 highlight on checked row; sticky footer `{n} hinzufügen` CTA (disabled when 0); empty state with `Dokument hochladen` link; toasts for single/multiple add, cross-case assignment conflict (`Dokument ist bereits einem anderen Fall zugeordnet.`), and generic error
- `RemoveDocumentDialog`: shadcn `Dialog`, `Entfernen` destructive button wired to `removeDocumentFromCaseAction`, toast `Dokument entfernt.`
- `RegenerateDialog`: shadcn `Dialog`, `Erneut generieren` accent button delegates confirm back to `CaseDetailClient`
- Wired into both the Documents-card header and the DocumentsTable empty state
- tsc clean.

### Additional — Navigation links (commit `61fd0da`)
- `app/(app)/layout.tsx` header gains Fälle + Hochladen nav links
- `app/(app)/page.tsx` CTA row adds outline Fälle button alongside primary upload CTA

### Additional — Tests (commit `308ace3`)
- `__tests__/ui/cases-list.test.tsx`: empty state (verbatim German copy) + populated table with status badge + Öffnen action
- `__tests__/ui/case-detail.test.tsx`: empty-case blocker banner + unreviewed-doc banner + generate CTA disabled state + person-name heading + section headings + Historie empty state
- 4 tests, all green.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] UI test could not import CaseDetailPage — transitive `server-only` chain**
- **Found during:** Task 5 (tests)
- **Issue:** `lib/laufliste/actions.ts` imports `build-input.ts`, which imports `server-only`; Vite/vitest under happy-dom cannot resolve it
- **Fix:** Added `vi.mock("@/lib/laufliste/actions", …)` and `vi.mock("@/lib/cases/actions", …)` to the case-detail test so the transitive chain is stubbed out at the action boundary
- **Files modified:** `__tests__/ui/case-detail.test.tsx`
- **Commit:** `308ace3`

**2. [Rule 3 — Blocking] useRouter missing from next/navigation mock**
- **Found during:** Task 5 (tests)
- **Issue:** `AddDocumentsSheet` and `DocumentsTable` call `useRouter`; the plan's mock only stubbed `redirect` + `notFound`
- **Fix:** Added `useRouter` to the `vi.mock("next/navigation", …)` block returning vitest-stubbed push/refresh/etc.
- **Files modified:** `__tests__/ui/case-detail.test.tsx`
- **Commit:** `308ace3`

### Plan-adjacent additions (Rule 2)
- **Top-nav Fälle/Hochladen links** (commit `61fd0da`): the `<env_notes>` block in the prompt asked for this explicitly; it would also be a Rule 2 correctness addition on its own because the new `/cases` surface is otherwise unreachable from the home page except via the single CTA on the home page.

## Verification

- `npx tsc --noEmit` → 0 errors across all 11 created/modified files
- `npx vitest run __tests__/ui lib/cases lib/laufliste` → 76 passed, 0 failed, 0 new skips
- `npx vitest run __tests__/ui/cases-list.test.tsx __tests__/ui/case-detail.test.tsx` → 4 passed
- Grep confirms every client component that calls a Server Action uses `useTransition`:
  - `CreateCaseForm` → createCaseAction via useTransition
  - `DocumentsTable` → reorderCaseDocumentsAction via useTransition
  - `CaseDetailClient` → generateLauflisteAction via useTransition
  - `AddDocumentsSheet` → addDocumentsToCaseAction via useTransition
  - `RemoveDocumentDialog` → removeDocumentFromCaseAction via useTransition
- German copy spot-check PASS: `Fall anlegen`, `Laufliste generieren`, `Dokumente hinzufügen`, `Erneut generieren`, `Nach oben` / `Nach unten` tooltips, `Erstellt am`, `Mindestens ein Dokument ist noch nicht geprüft.`, `Bitte mindestens ein Dokument hinzufügen.`

## Known Stubs

- **Historie download links** (`app/(app)/cases/[id]/page.tsx` lines 232–238) and **Herunterladen secondary CTA** in `CaseDetailClient.tsx` point at `/api/cases/${id}/laufliste/${lauflisteId}/download`. This route is stubbed pending Plan 06 which will add the Route Handler. Documented in the plan objective and is tracked as a deferred dependency (not a missed requirement).
- **Dokumenttyp column in DocumentsTable** currently renders `—`. The `listCaseDocuments` query in Plan 02 does not yet return extracted `dokumenten_typ`; this is consistent with the plan's field list and will be surfaced in a follow-up if needed. Safe placeholder for now.

## Deferred Issues

- Pre-existing `beforeAll` hook timeout on several DB-seeding tests (`lib/documents/actions.test.ts`, `lib/uploads/actions.test.ts`, `lib/review/actions.test.ts`, etc.) when running the **full** suite in parallel. Runs green when executed individually or in a narrow subset. This is an infrastructure issue (iCloud-synced path + parallel sqlite file creation), **not caused by this plan's changes** (verified by running the affected tests in isolation). Logged for later investigation; does not block plan completion.

## Threat Flags

None — all new routes use the existing ownership predicates from Plan 02 queries. No new endpoints, no new authentication surface, no new trust boundaries introduced.

## Self-Check: PASSED

- Created files verified on disk:
  - FOUND: app/(app)/cases/page.tsx
  - FOUND: app/(app)/cases/new/page.tsx
  - FOUND: app/(app)/cases/new/CreateCaseForm.tsx
  - FOUND: app/(app)/cases/[id]/page.tsx
  - FOUND: app/(app)/cases/[id]/CaseDetailClient.tsx
  - FOUND: app/(app)/cases/[id]/DocumentsTable.tsx
  - FOUND: app/(app)/cases/[id]/AddDocumentsSheet.tsx
  - FOUND: app/(app)/cases/[id]/RemoveDocumentDialog.tsx
  - FOUND: app/(app)/cases/[id]/RegenerateDialog.tsx
  - FOUND: __tests__/ui/cases-list.test.tsx
  - FOUND: __tests__/ui/case-detail.test.tsx
- Commits verified in git log:
  - FOUND: c324c3a
  - FOUND: 79db898
  - FOUND: e72fd3e
  - FOUND: 61fd0da
  - FOUND: 308ace3
