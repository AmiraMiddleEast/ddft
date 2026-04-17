# Phase 3: Review & Authority Lookup - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous — recommended defaults)

<domain>
## Phase Boundary

Delivers: side-by-side review UI for a single document (PDF left, editable field form right), inline editing of the 6 extracted fields with constrained Bundesland/Dokumententyp dropdowns, an "Approve & Lookup" action that persists the corrected values and resolves the responsible Vorbeglaubigung authority from a structured Behörden database, and an authority detail display with full contact info + Regierungsbezirk routing + exception rules. Deferred: grouping into cases (Phase 4), Laufliste PDF (Phase 4), re-upload (Phase 5), Behörden admin CRUD UI (Phase 5).

</domain>

<decisions>
## Implementation Decisions

### Behörden Data Ingestion (CRITICAL)
- **D-01** `behoerden_db.json` currently contains raw markdown per state (`dokumente_raw`) — unstructured for queries. **Parse once at seed time** into structured Drizzle tables. This phase delivers both the seed script AND the lookup.
- **D-02** New tables:
  - `behoerden_state` (id TEXT PK = bundesland slug e.g. "bayern", name TEXT e.g. "Bayern", hat_regierungsbezirke BOOLEAN, besonderheiten TEXT)
  - `behoerden_regierungsbezirk` (id PK, state_id FK, name TEXT e.g. "Oberbayern", slug)
  - `behoerden_document_type` (id TEXT PK = slug e.g. "approbationsurkunde", display_name TEXT e.g. "Approbationsurkunde")
  - `behoerden_authority` (id PK, state_id FK, regierungsbezirk_id FK NULL, document_type_id FK, name TEXT, address TEXT, phone TEXT NULL, email TEXT NULL, website TEXT NULL, office_hours TEXT NULL, notes TEXT NULL, special_rules TEXT NULL, needs_review BOOLEAN — true when source had [PRÜFEN] marker)
- **D-03** Seed script `scripts/seed-behoerden.ts` parses `behoerden_db.json`. Parsing strategy: use Claude Sonnet to convert each state's `dokumente_raw` markdown into a structured JSON array of authorities. This is a ONE-TIME cost per build, cached. The seed script writes a derived `data/behoerden-parsed.json` snapshot so subsequent runs don't re-call Claude.
- **D-04** Parsing is idempotent: seed script checks if `data/behoerden-parsed.json` exists, skips re-parse unless `--force` flag. CI could commit the parsed snapshot for deterministic builds.
- **D-05** Handle [PRÜFEN] markers: parser flags these entries with `needs_review: true`. UI surfaces a subtle warning icon + "Angaben bitte prüfen" note.
- **D-06** Special rules parser: Führungszeugnis exception ("no Vorbeglaubigung needed — goes direct to Apostille") and Reisepass exception (no legalization at all) stored as `special_rules` text on the matching authority row; lookup returns them explicitly.

### Review UI
- **D-07** Route: `/documents/[id]/review`. Linked from the "Zur Überprüfung" button created (disabled) in Phase 2. Enable it now for documents with `extraction_status=done`.
- **D-08** Layout: two-column on desktop (≥1024px), stacked on mobile. Left: iframe PDF preview (same component as Phase 2). Right: editable form.
- **D-09** All 6 fields are editable:
  - `dokumenten_typ` → shadcn Select, options = `behoerden_document_type.display_name` list (sorted alphabetically, ~30-40 entries)
  - `bundesland` → shadcn Select, 16 German states alphabetical + "Unbekannt/Sonstiges" sentinel
  - `ausstellende_behoerde`, `ausstellungsort`, `ausstellungsdatum`, `voller_name` → free-text Input
  - `ausstellungsdatum` uses `type="date"` with German locale
- **D-10** Each field shows its original Claude extraction value, confidence badge, and current edited value (if changed). Visual diff indicator: modified field gets a subtle accent border.
- **D-11** "Verwerfen" (discard edits) and "Speichern & Behörde ermitteln" (primary CTA) buttons at bottom.

### Authority Lookup
- **D-12** Lookup is a Server Action triggered by "Speichern & Behörde ermitteln". Input: corrected 6 fields. Output: `{authority, routing_path, special_rules, needs_review}` or `{not_found: true, reason}`.
- **D-13** Resolution algorithm:
  1. Normalize inputs: slugify dokumenten_typ, match to nearest behoerden_document_type (case-insensitive, fuzzy via edit distance ≤ 2).
  2. Look up state by bundesland.
  3. If state `hat_regierungsbezirke`, infer Regierungsbezirk from `ausstellungsort` (city → Regierungsbezirk via a small hardcoded city lookup OR Claude fallback for unknown cities).
  4. Query `behoerden_authority` for matching (state_id, doc_type_id, regierungsbezirk_id).
  5. Return first match; if multiple, return all with a "multiple candidates" warning.
- **D-14** Handle misses: if no exact match, return the state's most general authority as a suggestion + a `low confidence` flag. If the dokumenten_typ is unknown to the DB, surface "Kein Eintrag — bitte prüfen".
- **D-15** Persist the approval: create a new `document_review` row with (document_id, approved_by_user_id, approved_at, corrected_fields JSON, resolved_authority_id, lookup_status enum 'matched'|'ambiguous'|'not_found'). Set `document.review_status='approved'`.

### Authority Detail Display
- **D-16** After successful lookup, show a result panel below the form:
  - Authority name (heading, 24px)
  - Address block
  - Phone, email, website (clickable: tel:, mailto:, target="_blank")
  - Office hours
  - Special rules callout (if any) — warning Badge color
  - "[PRÜFEN]" warning if `needs_review=true`
  - Routing breadcrumb: "Bayern › Oberbayern › Approbationsurkunde" so user sees the path taken

### UI Additions
- **D-17** No new shadcn components needed — reuse Button, Card, Select (need to add), Input, Label, Badge, Separator. Add `select`.
- **D-18** German-only copy per UI-SPEC discipline. Reuse the warning color token from Phase 2.

### Data Model Additions (summary)
- 4 new Behörden tables (state, regierungsbezirk, document_type, authority)
- 1 new `document_review` table tracking approvals
- Update `document` table: add `review_status TEXT` enum ('pending'|'approved') and `reviewed_at TIMESTAMP NULL`

### Security
- **D-19** Review/approve actions require ownership check (same pattern as Phase 2 PDF route).
- **D-20** Server Action validates all field inputs with Zod. Length limits enforced.

### Claude's Discretion
- Exact markdown → JSON parsing prompt structure (in RESEARCH.md)
- Whether to use ISO-639 normalization on document type strings
- Exact city → Regierungsbezirk mapping (small hardcoded dict is fine for major cities; Claude fallback optional)
- Fuzzy match threshold
- UI micro-interactions (save-disabled-while-submitting, etc.)
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets (from Phase 1/2)
- `lib/auth.ts` — `auth.api.getSession`
- `lib/extraction/claude.ts` — Anthropic client (already configured with retry + cost logging)
- `lib/documents/queries.ts` — ownership-checked document queries
- `app/(app)/documents/[id]/_components/PdfPreview.tsx` — iframe component
- shadcn Button, Card, Input, Label, Badge, Separator, Table already vendored
- Warning color token in globals.css

### Patterns to Follow
- Server Actions for all mutations with `"use server"` and auth check inside
- Drizzle queries with `eq(table.userId, session.user.id)` predicates
- Zod schemas in `lib/validations/`
- Error returns use discriminated union `{ok: true, data} | {ok: false, error}`
- Tests: vitest + happy-dom for UI, `// @vitest-environment node` for integration, createTestDb fixture

### Integration Points
- New queries live in `lib/behoerden/queries.ts`
- Lookup logic in `lib/behoerden/resolve.ts`
- Seed script in `scripts/seed-behoerden.ts` follows `scripts/seed-user.ts` convention
- Route `/documents/[id]/review` nested under existing `(app)/documents/[id]/` group
</code_context>

<specifics>
- `behoerden_db.json` at repo root — 155KB, 16 states, raw markdown per state with bilingual tables
- The `[PRÜFEN]` tokens embedded in raw text MUST be preserved as warnings
- Städte→Regierungsbezirk mappings for BY/BW/HE/NRW are small and well-known; hardcode or use existing published lists

</specifics>

<deferred>
- Behörden admin CRUD UI → Phase 5
- Bulk authority import from another source → Phase 5
- Cross-document authority caching → not needed (lookup is cheap after parse)
- Re-triggering lookup if source JSON updates → out of scope (Phase 5 admin refresh)
</deferred>
