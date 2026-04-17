# Phase 4: Laufliste Generation & Cases - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous)

<domain>
## Phase Boundary

Delivers: Cases (named groupings of documents for a single person), Laufliste PDF generation covering the full authentication chain (Vorbeglaubigung → Endbeglaubigung → UAE-Legalisation) per document, case-level consolidated Laufliste covering all docs in a case, and PDF download. Static UAE embassy data + static Endbeglaubigung data (Bundesverwaltungsamt / BfJ etc.).

</domain>

<decisions>
## Implementation Decisions

### Data Model
- **D-01** New tables:
  - `case` (id TEXT PK, user_id FK, person_name TEXT, person_birthdate DATE NULL, notes TEXT NULL, status enum 'open'|'ready_for_pdf'|'pdf_generated', created_at, updated_at)
  - `case_document` (id, case_id FK, document_id FK, position INTEGER, added_at) — unique(case_id, document_id)
  - `laufliste` (id, case_id FK, user_id FK, pdf_storage_path, generated_at, document_count INTEGER, file_size INTEGER)
- **D-02** Document can only be in ONE case at a time (uniqueness enforced at `case_document.document_id` — violated → offer to move).

### Case UI Surfaces
- **D-03** New routes:
  - `/cases` — list all cases (card grid or table)
  - `/cases/new` — create case form (person name required)
  - `/cases/[id]` — case detail: person info, document list with add/remove, "Laufliste generieren" button, generated Lauflisten history
- **D-04** Adding a document: from case detail page, show a picker of user's reviewed documents (extraction_status=done AND review_status=approved) that aren't in another case. Multi-select.
- **D-05** Re-ordering documents within a case: simple up/down arrow buttons on each row; store position as INTEGER.

### Endbeglaubigung + Embassy Static Data
- **D-06** Endbeglaubigung authority for Phase 4 v1: always **Bundesverwaltungsamt (BVA)** in Köln (for most docs) OR **Bundesamt für Justiz (BfJ)** for Führungszeugnisse. Static lookup by document category. Codified in `lib/laufliste/endbeglaubigung.ts` as a small hardcoded map.
- **D-07** UAE Embassy data: static, hardcoded in `lib/laufliste/embassy.ts`. Fields: name, address, phone, email, hours. Single entry (UAE Embassy Berlin).
- **D-08** Special cases from Phase 3 flow through: Führungszeugnis → Apostille (no UAE Legalisation); Reisepass → no legalization needed. Laufliste handles these as terminal shorter chains.

### PDF Generation (Core)
- **D-09** Library: @react-pdf/renderer 4.5 (per CLAUDE.md). Server-side render in a Server Action via `renderToStream`.
- **D-10** Layout: A4 portrait, 20mm margins, Helvetica font family (built-in; handles umlauts correctly via font descriptors). Header with "Laufliste" title + person name + generation date. One section per document showing the 3-step chain.
- **D-11** Per-document section shows:
  1. Document header: type, date, originating authority, ausstellungsort
  2. Step 1 Vorbeglaubigung: authority name, address, contact, hours, special rules, [PRÜFEN] flag if present
  3. Step 2 Endbeglaubigung: static BVA or BfJ block
  4. Step 3 Legalisation: UAE Embassy Berlin static block
  5. Exceptions: Führungszeugnis → steps 2-3 replaced with "Apostille (Bundesamt für Justiz)"; Reisepass → "Keine Legalisation erforderlich"
- **D-12** Case-level summary on page 1: total documents, person name, generation date, page count.
- **D-13** Use existing sample `Dokumenten Laufliste Dr. Sandra Hertel-2.pdf` at repo root as visual reference only — don't try to pixel-match, just capture the essential structure (hierarchy, section breaks, contact block formatting).

### PDF Storage + Download
- **D-14** Save PDF to `data/lauflisten/{caseId}-{timestamp}.pdf`. Immutable — regenerating creates a new file + new `laufliste` row.
- **D-15** Download endpoint: `/api/cases/[id]/laufliste/[lauflisteId]/download` Route Handler — auth ownership check, stream file, `Content-Disposition: attachment; filename*=UTF-8''Laufliste-{person-slug}-{date}.pdf` (RFC 5987).
- **D-16** Case detail page shows the last generated Laufliste with "Erneut herunterladen" + a Historie list of prior generations.

### Validation
- **D-17** Case can generate Laufliste only if ≥1 document AND all documents have `review_status=approved`.
- **D-18** Authority lookups re-executed at generation time (not cached from Phase 3 review) — reasoning: Behörden DB may have been refreshed; generation should always use current data. Each document's stored `document_review.corrected_fields` provides inputs to the resolver.

### German Copy
- **D-19** All UI + PDF output German. PDF key strings: "Laufliste", "Dokumentart", "Vorbeglaubigung", "Endbeglaubigung", "Legalisation durch VAE-Botschaft", "Besondere Hinweise", "Person", "Erstellt am", "Sonderregelung: Apostille", "Keine Legalisation erforderlich".

### Security
- **D-20** Ownership checks on all case routes (user_id = session.user.id).
- **D-21** Download route: authenticate + verify case ownership + verify laufliste row belongs to that case.

### Claude's Discretion
- Exact visual details of PDF section dividers, table widths, font sizes (14pt body, 18pt headings, 10pt small print — planner may tune)
- Case list sort order (default: updated_at DESC)
- Whether to show a PDF preview in-browser before download (nice-to-have; deferred)
- Locking behavior if a document is in a case and user tries to re-review (soft-lock, allow with warning)
</decisions>

<code_context>
## Existing Code
- lib/behoerden/resolve.ts — reuse for re-lookup at generation time
- lib/review/actions.ts — reference for Server Action auth pattern
- lib/documents/queries.ts — reference for ownership-scoped queries
- app/api/documents/[id]/pdf/route.ts — reference for PDF serving route
- shadcn components: Button, Card, Input, Label, Badge, Select, Table, Separator, Skeleton — all vendored

## Patterns
- Server Actions with auth inside; Zod validation; ownership predicates on all mutations
- Tests: createTestDb fixture; mock external deps
- PDF rendering: `renderToBuffer` for simpler Server Action return
</code_context>

<specifics>
- `Dokumenten Laufliste Dr. Sandra Hertel-2.pdf` at repo root — reference format
- Current .env.local has working (placeholder) auth; no real UAE Embassy data exists in repo yet — hardcode in code
</specifics>

<deferred>
- Bilingual Laufliste (German/English) — Phase 5 ENHC-01
- PDF customization (configurable header, optional sections) — Phase 5 ENHC-01
- Email Laufliste to customer — future
- Digital signature on generated PDFs — future
- Status tracking of actual submission — not in scope per CLAUDE.md
</deferred>
