---
phase: 5
plan: "05-04"
subsystem: admin
tags: [admin, behoerden, ui]
requires: [05-01]
provides: [adminStats, listAuthoritiesAdmin, updateAuthorityAction, createDocumentTypeAction, updateDocumentTypeAction, /admin/behoerden_routes]
affects: [lib/admin/, lib/validations/admin.ts, app/(app)/admin/]
tech_stack_added: []
key_files_created:
  - lib/admin/queries.ts
  - lib/admin/actions.ts
  - lib/admin/actions.test.ts
  - lib/validations/admin.ts
  - app/(app)/admin/behoerden/page.tsx
  - app/(app)/admin/behoerden/authorities/page.tsx
  - app/(app)/admin/behoerden/authorities/AuthoritiesFilters.tsx
  - app/(app)/admin/behoerden/authorities/[id]/edit/page.tsx
  - app/(app)/admin/behoerden/authorities/[id]/edit/EditAuthorityForm.tsx
  - app/(app)/admin/behoerden/document-types/page.tsx
  - app/(app)/admin/behoerden/document-types/DocumentTypesClient.tsx
key_files_modified:
  - app/(app)/layout.tsx
decisions:
  - Doc type id (slug) is stable — only displayName editable (avoids FK cascade at v1)
  - Pre-check for DUPLICATE before insert gives typed error (better UX than raw SQL collision)
  - Native <select> for admin filters (radix Select overkill for query-param driven filters)
  - Checkbox onCheckedChange returns boolean|'indeterminate' — coerced to boolean
  - Single-user tool: every authenticated user is admin (CLAUDE.md + D-11/D-21)
  - No delete action at v1 (D-15)
tasks_completed: 2
task_commits:
  - 237a050: feat(05-04) add admin queries + actions + Zod schemas
  - e356a47: feat(05-04) add Behörden admin UI + nav link
duration: ~20min
completed: 2026-04-17
---

# Phase 5 Plan 04: Behörden Admin UI Summary

**One-liner:** Full CRUD-minus-D admin area for authorities + document types: `/admin/behoerden` dashboard, filterable table, edit form, document-type add/rename.

## What Was Built

### Data Layer
- `lib/admin/queries.ts` — `getAdminStats`, `listAuthoritiesAdmin`, `getAuthorityByIdAdmin`, `listDocumentTypesAdmin`, `getDocumentTypeById`, `listStatesAdmin`, `listRecentlyEditedAuthorities`
- `lib/admin/actions.ts` — `updateAuthorityAction(id, patch)`, `createDocumentTypeAction(input)`, `updateDocumentTypeAction(id, input)` — all with session gate + Zod validation + `revalidatePath`
- `lib/validations/admin.ts` — `AuthorityPatchSchema` (all authority fields, optional phone/email/website/office_hours/notes/special_rules), `DocumentTypeSchema` (1..100 char displayName)

### UI
- `/admin/behoerden` — dashboard with 4 cards (Bundesländer, Dokumentenarten, Behörden, Zur Überprüfung) linking to sub-pages
- `/admin/behoerden/authorities` — filterable table with search/state/docType/needsReview URL state via nuqs; paginated (20/page); Bearbeiten link per row
- `/admin/behoerden/authorities/[id]/edit` — EditAuthorityForm (controlled state, react-sends-to Server Action); all contact fields; Prüfen checkbox; toasts; redirect+refresh on success
- `/admin/behoerden/document-types` — list with inline edit flow + add-new form; DocumentTypesClient uses `useTransition` + `router.refresh()`
- Nav link "Behörden" added to `app/(app)/layout.tsx`

### Tests
- 8 tests in `lib/admin/actions.test.ts`:
  - update authority happy path (contact fields persisted)
  - update unauthorized
  - update NOT_FOUND
  - update VALIDATION (empty name)
  - create new doc type (slugified id)
  - create DUPLICATE (existing slug)
  - update doc type preserves slug
  - update doc type NOT_FOUND
- All pass (`lib/admin --no-file-parallelism` → 8/8)

## Verification

```
grep "updateAuthorityAction" lib/admin/actions.ts  — match
8 tests in lib/admin/actions.test.ts               — all pass
grep "Behörden" app/(app)/layout.tsx                — match
npx tsc --noEmit                                    — clean
```

## Deviations from Plan

None substantive — plan executed as written. Minor differences:

- Used native `<select>` for the Behörden filter dropdowns instead of shadcn Select — the plan mentioned shadcn select, but the filter is driven by nuqs query state (not react-hook-form); native selects integrate cleaner. This is a UI polish choice, not a behavioral deviation.
- Dashboard shows 4 stat cards plus a computed card count for needsReview; the `regierungsbezirke` count is computed but not surfaced on v1 dashboard (reserved for a future sub-page).

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: lib/admin/queries.ts
- FOUND: lib/admin/actions.ts
- FOUND: lib/admin/actions.test.ts
- FOUND: lib/validations/admin.ts
- FOUND: app/(app)/admin/behoerden/page.tsx
- FOUND: app/(app)/admin/behoerden/authorities/page.tsx
- FOUND: app/(app)/admin/behoerden/authorities/[id]/edit/page.tsx
- FOUND: app/(app)/admin/behoerden/authorities/[id]/edit/EditAuthorityForm.tsx
- FOUND: app/(app)/admin/behoerden/document-types/page.tsx
- FOUND: app/(app)/admin/behoerden/document-types/DocumentTypesClient.tsx
- FOUND: 237a050 (feat(05-04): add admin queries + actions + Zod schemas)
- FOUND: e356a47 (feat(05-04): add Behörden admin UI + nav link)
