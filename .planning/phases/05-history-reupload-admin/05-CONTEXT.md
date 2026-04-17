# Phase 5: History, Re-upload & Admin - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous)

<domain>
## Phase Boundary

Delivers: Lauflisten history with search/filter (date, person name), re-download for prior PDFs; document re-upload that replaces the PDF in place (keeping ID, extractions preserved); Behörden admin UI (view/search/edit authorities, add document types, edit routing rules). This is the final phase of v1.0.

</domain>

<decisions>
## Implementation Decisions

### Lauflisten History (HIST-01/02/03)
- **D-01** New route `/history` — table of ALL lauflisten across all cases for this user. Columns: generated_at, person_name (from case), document_count, file_size, actions (Herunterladen, Zum Fall).
- **D-02** Search: single text input matching against person_name (case-insensitive LIKE); Filter: date-range picker (from, to) on generated_at.
- **D-03** Pagination: 20 per page; nuqs URL state so filters are shareable.
- **D-04** Re-download reuses Phase 4 route handler — no new auth logic needed.
- **D-05** Query: `getLauflistenHistoryForUser(userId, {search?, dateFrom?, dateTo?, page, pageSize})` — JOINs laufliste + case.

### Document Re-upload (UPLD-03)
- **D-06** On `/documents/[id]` add a "Neuer Scan hochladen" button. Opens a dialog with single-file dropzone (same react-dropzone).
- **D-07** Re-upload Server Action: `replaceDocumentPdfAction(documentId, file)`:
  - auth + ownership check
  - validate PDF (magic bytes + pdf-lib encryption check)
  - compute new sha256
  - write new file to `data/uploads/{documentId}-v{N}.pdf` (versioned filename)
  - update `document.storagePath` to new versioned path, add `document.version` INTEGER column incrementing
  - KEEP the old file on disk (immutable history) — reference it via new `document_version` table
  - KEEP existing extraction rows (user can decide to re-extract separately)
  - return {ok:true, newVersion}
- **D-08** New `document_version` table: id, document_id FK, version_number, storage_path, sha256, uploaded_at, size. When a new version is uploaded, insert row for the OLD version first.
- **D-09** "Neu analysieren" button next to the re-uploaded document — triggers extractDocumentAction on the latest version, replacing extraction rows. This is optional (user can re-upload without re-extracting if the content is identical enough).
- **D-10** PDF preview route must serve the CURRENT version; prior versions are accessible via `/api/documents/[id]/versions/[versionNumber]/pdf`.

### Behörden Admin (ADMN-01/02/03)
- **D-11** New route group `/admin/behoerden/*` — ALL signed-in users have admin access (single-user internal tool per CLAUDE.md, no roles needed).
- **D-12** Sub-routes:
  - `/admin/behoerden` — dashboard: counts (states, doc types, authorities, needs_review). Link to sub-areas.
  - `/admin/behoerden/authorities` — searchable/filterable table of all authorities; filters: state, document type, needs_review. Edit button per row.
  - `/admin/behoerden/authorities/[id]/edit` — form for name, address, phone, email, website, office_hours, notes, special_rules, needs_review flag
  - `/admin/behoerden/document-types` — list all doc types; add new (+), edit display_name
  - `/admin/behoerden/routing` — view-only at v1: the city→Regierungsbezirk map. Add/edit later (ENHC).
- **D-13** Authority edit Server Action: `updateAuthorityAction(id, patch)` — auth check (any logged-in user), Zod validate, UPDATE row, redirect back to list with toast.
- **D-14** New doc type action: `createDocumentTypeAction(displayName)` — slugifies, checks uniqueness, inserts row.
- **D-15** NO deletion for v1 — edits only. Delete would require cascade thinking (document_review references). Defer.

### Navigation
- **D-16** Add "Historie" and "Behörden" to top nav in `app/(app)/layout.tsx`.
- **D-17** Home page adds a "Historie" link in the existing CTA row.

### Data Model Additions
- `document_version` table (1 new)
- `document.version` INTEGER default 1 (ALTER)

### Validation
- **D-18** Admin edits: Zod schemas in `lib/validations/admin.ts`
- **D-19** Optimistic UI on admin edits (shadcn form + useActionState)

### Claude's Discretion
- Exact search query behavior (LIKE vs trigram — LIKE is fine for this scale)
- Whether to show version diffs in UI (punt — just show latest)
- Admin table sort orders
- Specific copy for empty-state / no-results

### German Copy (key strings)
- "Historie", "Suchen", "Zeitraum von", "Zeitraum bis", "Herunterladen", "Zum Fall"
- "Neuer Scan hochladen", "Version {N}", "Neu analysieren"
- "Behörden", "Behörde bearbeiten", "Dokumentenarten", "Routing", "Neue Dokumentenart"
- Needs-review pill: "Prüfen"
- Save success toasts German

### Security
- **D-20** Re-upload inherits document ownership check
- **D-21** Admin routes require auth but no role check (single-user tool per CLAUDE.md)
- **D-22** Content-Disposition RFC 5987 on all version downloads

</decisions>

<code_context>
## Existing (Phase 1-4)
- All patterns established — reuse heavily
- lib/cases/queries.ts — pagination pattern (none yet, establish in Phase 5)
- lib/behoerden/queries.ts — read queries
- lib/uploads/* — re-upload can reuse validate + storage
- shadcn: Dialog, Sheet, Table, Badge, Select, Input, Label, Button, Separator, Skeleton, Form already vendored
- nuqs — need to install for URL state (per CLAUDE.md)

## Integration Points
- New nav entries in layout.tsx
- New admin route group — consider /admin route group parallel to (app) for visual separation, or keep inside (app)/admin/
</code_context>

<specifics>
- Same ANTHROPIC_API_KEY usage pattern for re-extraction
- data/behoerden-parsed.json is the seed source for authorities — admin edits persist to DB only; source JSON stays immutable (or gets regenerated on --force seed)
</specifics>

<deferred>
- Roles / permissions → future
- Authority deletion → future
- Bulk import of Behörden from CSV → future
- Document version diff UI → future
- Laufliste bilingual output → ENHC-01 future
- Audit log of admin edits → future
- Undo on admin edits → future
</deferred>
