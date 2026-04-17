---
phase: 03-review-authority-lookup
plan: 05
subsystem: ui
tags: [nextjs, server-component, client-component, shadcn, select, review, forms, zod, sonner]

# Dependency graph
requires:
  - phase: 03-review-authority-lookup
    provides: listDocumentTypes + listStates (Plan 01), CorrectedFieldsSchema (Plan 02), resolveAuthority + ResolverResult (Plan 03), approveAndResolve + chooseAmbiguousAuthority Server Actions (Plan 04)
  - phase: 02-document-upload-ai-extraction
    provides: PdfPreview component, getDocumentForUser/getExtractionsForDocument, extraction rows with confidence, /api/documents/[id]/pdf route handler
  - phase: 01-foundation-authentication
    provides: better-auth session API, shadcn Button/Card/Input/Label/Badge/Table, buttonVariants pattern (base-ui Button lacks asChild)
provides:
  - Server Component route /documents/[id]/review (ownership + done-status gate + dropdown data fetch)
  - ReviewForm client orchestrator (6-field controlled form + dirty tracking + beforeunload guard + Server Action call + result panel)
  - FieldRow client subcomponent (confidence badge + 2px accent left-border edited indicator + Ursprünglich caption)
  - AuthorityResultPanel (matched / ambiguous / not_found variants with UI-SPEC verbatim copy)
  - DiscardDialog (minimal alertdialog — no new shadcn component added)
  - ReviewLinkButton (enabled when extractionStatus='done', disabled span otherwise — wired into documents/[id]/page.tsx)
affects: [phase-04-cases-laufliste, phase-05-admin-reupload]

tech-stack:
  added: []
  patterns:
    - "Server Component loads ALL data (doc + extractions + Behörden dropdowns) then hydrates client form via props — no client data fetching"
    - "Controlled useState form (no react-hook-form) with Zod safeParse on submit; focus first invalid field"
    - "Client calls Server Actions via useTransition; discriminated-union result handled before rendering panel"
    - "Minimal accessible alertdialog built directly (no AlertDialog primitive) to honor CONTEXT D-17 (only `select` added this phase)"
    - "Link-as-button via buttonVariants() on next/link (base-ui Button has no asChild)"

key-files:
  created:
    - app/(app)/documents/[id]/review/page.tsx
    - app/(app)/documents/[id]/review/_components/ReviewForm.tsx
    - app/(app)/documents/[id]/review/_components/FieldRow.tsx
    - app/(app)/documents/[id]/review/_components/DiscardDialog.tsx
    - app/(app)/documents/[id]/review/_components/AuthorityResultPanel.tsx
    - app/(app)/documents/[id]/_components/ReviewLinkButton.tsx
    - __tests__/ui/review-form.test.tsx
    - __tests__/ui/authority-result-panel.test.tsx
  modified:
    - app/(app)/documents/[id]/page.tsx

key-decisions:
  - "Build the Verwerfen confirmation as a hand-rolled accessible modal (role=alertdialog + Escape handler + focus management) instead of adding shadcn AlertDialog — CONTEXT D-17 locks new shadcn components to `select` only this phase."
  - "Route-level dropdown data fetch in Promise.all(listDocumentTypes, listStates) — Server Component is the single source; the Bundesland sentinel 'Unbekannt / Sonstiges' is appended client-side so the DB stays pure."
  - "Dokumenttyp and Bundesland Select values store the display_name/name (not the slug id) — the resolver slugifies at lookup time (matches Plan 03 resolver contract)."
  - "No react-hook-form — controlled useState is simpler here, avoids a second validation layer on top of Zod, and matches research 'Don't hand-roll' exception."

patterns-established:
  - "Pattern: Server-Action-via-useTransition — pending state disables CTA, swaps label to in-flight copy ('Behörde wird ermittelt …'), re-enables on settle"
  - "Pattern: Field-edited indicator — 2px border-primary on left of control wrapper + muted 'Ursprünglich: …' caption (or — nicht erkannt when original was blank)"
  - "Pattern: beforeunload guard — window listener mounted only while anyDirty is true, cleaned up on unmount or when dirty becomes false"

requirements-completed: [REVW-01, REVW-02, REVW-03, REVW-04, LKUP-01, LKUP-02, LKUP-03, LKUP-04]

# Metrics
duration: 6min
completed: 2026-04-17
---

# Phase 3 Plan 05: Review page — ReviewForm + FieldRow + AuthorityResultPanel Summary

**Ships /documents/[id]/review — two-column PDF+form Server Component, 6-field controlled client form with dirty tracking + Zod submit + Server Action call, and a 3-variant (matched/ambiguous/not_found) authority result panel; also enables the previously-disabled 'Zur Überprüfung' CTA on the detail page.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-17T10:00:57Z
- **Completed:** 2026-04-17T10:06:57Z
- **Tasks:** 3
- **Files created/modified:** 9

## Accomplishments

- /documents/[id]/review route: ownership check, done-status gate (redirects non-done docs to /documents/[id]), PDF preview + ReviewForm rendered side-by-side at lg, stacked below.
- ReviewForm: 6 editable fields — Dokumenttyp + Bundesland as shadcn Selects (DB-populated + client-side 'Unbekannt / Sonstiges' sentinel on Bundesland), 4 Inputs (Ausstellende Behörde, Ausstellungsort, Ausstellungsdatum [type=date], Voller Name). Client-side Zod parse before Server Action call; first invalid field focused on validation fail. Submit calls approveAndResolve; on success AuthorityResultPanel renders beneath form.
- AuthorityResultPanel: matched variant (routing breadcrumb with U+203A separator, authority heading, 2-col definition list for Anschrift/Telefon/E-Mail/Website/Öffnungszeiten, optional PRÜFEN banner when needs_review, Besonderheit callout when specialRules). Ambiguous variant (Kandidaten shadcn Table, 'Diese Behörde übernehmen' per row invokes chooseAmbiguousAuthority). Not_found variant (CircleAlert icon, destructive heading, 'Eingaben anpassen' CTA scrolls focus back to Dokumenttyp).
- DiscardDialog: minimal role=alertdialog modal with UI-SPEC verbatim copy ('Änderungen verwerfen?' / body / 'Verwerfen' / 'Abbrechen'), Escape-to-cancel, backdrop-click-to-cancel, auto-focus on confirm.
- ReviewLinkButton: enabled-when-done link via buttonVariants() on next/link; disabled-span fallback for other statuses. Wired into documents/[id]/page.tsx replacing the Phase 2 stub disabled Button.
- 11 new vitest cases (5 ReviewForm + 6 AuthorityResultPanel) — full suite 117/117 green, TypeScript clean.

## Task Commits

1. **Task 1: Server Component route + enabled review link** — `b1de892` (feat)
2. **Task 2: ReviewForm + FieldRow + DiscardDialog** — `27a11b4` (feat)
3. **Task 3: AuthorityResultPanel + UI tests** — `408dbde` (feat)

## Files Created/Modified

- `app/(app)/documents/[id]/review/page.tsx` — Server Component route (ownership, done-gate, dropdown data fetch)
- `app/(app)/documents/[id]/review/_components/ReviewForm.tsx` — controlled 6-field client form + Server Action call + result wiring
- `app/(app)/documents/[id]/review/_components/FieldRow.tsx` — label + control slot + confidence badge + dirty indicator
- `app/(app)/documents/[id]/review/_components/DiscardDialog.tsx` — minimal accessible discard confirmation modal
- `app/(app)/documents/[id]/review/_components/AuthorityResultPanel.tsx` — three-variant result panel
- `app/(app)/documents/[id]/_components/ReviewLinkButton.tsx` — enabled-when-done link-as-button
- `app/(app)/documents/[id]/page.tsx` — swaps stub disabled Button for ReviewLinkButton
- `__tests__/ui/review-form.test.tsx` — 5 tests: labels/CTAs present, disabled-Verwerfen, dirty caption, approveAndResolve shape, discard dialog copy
- `__tests__/ui/authority-result-panel.test.tsx` — 6 tests: matched variants (with/without needs_review and specialRules and missing contacts), ambiguous click handler, not_found destructive heading + onAdjustInputs

## Decisions Made

- Hand-rolled DiscardDialog rather than adding shadcn AlertDialog — CONTEXT D-17 restricts new shadcn components to `select`. The dialog uses role=alertdialog, auto-focus on confirm, Escape-to-cancel, and backdrop-click-to-cancel.
- Data-fetching happens fully in the Server Component via Promise.all(listDocumentTypes, listStates); client components receive all data via props. No client-side DB calls.
- Controlled useState over react-hook-form — simpler, and research explicitly accepts hand-rolled state for this small form.
- Select values store display_name / state name (not slug); the resolver (Plan 03) slugifies at lookup time, so the UI can stay human-readable.

## Deviations from Plan

None - plan executed exactly as written. All three tasks completed per spec, UI-SPEC copy verbatim, no Rule 1/2/3 auto-fixes needed.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- /documents/[id]/review is the final user-facing surface for Phase 3; review status visible via the 'Zur Überprüfung' CTA on the detail page.
- Phase 4 (cases + Laufliste PDF) can begin — document_review rows created by approveAndResolve provide the resolved authority + corrected fields needed for routing slip generation.
- No blockers or concerns.

## Self-Check: PASSED

- FOUND: app/(app)/documents/[id]/review/page.tsx
- FOUND: app/(app)/documents/[id]/review/_components/ReviewForm.tsx
- FOUND: app/(app)/documents/[id]/review/_components/FieldRow.tsx
- FOUND: app/(app)/documents/[id]/review/_components/DiscardDialog.tsx
- FOUND: app/(app)/documents/[id]/review/_components/AuthorityResultPanel.tsx
- FOUND: app/(app)/documents/[id]/_components/ReviewLinkButton.tsx
- FOUND: __tests__/ui/review-form.test.tsx
- FOUND: __tests__/ui/authority-result-panel.test.tsx
- FOUND: commit b1de892
- FOUND: commit 27a11b4
- FOUND: commit 408dbde

---
*Phase: 03-review-authority-lookup*
*Completed: 2026-04-17*
