# Phase 2: Document Upload & AI Extraction - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous — recommended defaults, no grey areas presented)

<domain>
## Phase Boundary

This phase delivers: PDF upload (single + batch via file picker or drag-and-drop) with server-side persistence to local filesystem, AI extraction via Claude Vision for the 6 structured fields (dokumenten_typ, ausstellende_behoerde, ausstellungsort, bundesland, ausstellungsdatum, voller_name), confidence indicators (high/medium/low) per field, and a read-only display of extracted data. Deferred: editing extracted values (Phase 3), grouping into cases (Phase 4), re-upload (Phase 5).

</domain>

<decisions>
## Implementation Decisions

### Upload Flow & UX
- **D-01** Single upload surface at `/upload` route (authenticated, inside `(app)` group). Accessible from home page.
- **D-02** Dropzone + file picker combined: a single visible drop area with an embedded "Dateien auswählen" button. Built with `react-dropzone` (lightweight, well-tested, works with Next 16/React 19). Accept: `application/pdf` only.
- **D-03** Batch upload supported from day one. Each file processed independently — per-file status (queued/uploading/extracting/done/error) so one failure doesn't block others.
- **D-04** Max file size: 10 MB per PDF. Max batch: 10 files. Server rejects larger.
- **D-05** Progress feedback: per-file row with status badge + spinner. Sonner toast on batch complete.

### File Storage
- **D-06** Local filesystem per CLAUDE.md. Path: `data/uploads/{documentId}.pdf` where documentId is a UUID. Originals immutable — never overwritten. Re-uploads in Phase 5 get new IDs and a versioned link.
- **D-07** Database stores only metadata: id, user_id, filename (original), size, hash (sha256), mime, uploaded_at, storage_path.
- **D-08** SHA-256 dedup: if an identical file was already uploaded by this user, reuse the existing `document` row (saves Claude API calls).

### AI Extraction
- **D-09** Claude API via `@anthropic-ai/sdk` 0.88 with document content block (base64-encoded PDF). Model: `claude-sonnet-4-20250514` per CLAUDE.md (best cost/quality for structured extraction).
- **D-10** Response format: structured JSON, enforced via a detailed prompt + Zod validation on response. No tool-use API — plain JSON response with a strict schema in the prompt.
- **D-11** Confidence levels derived from Claude's own self-reported confidence per field. Prompt asks for `{value, confidence: "high"|"medium"|"low", reasoning}` per field. No secondary model or heuristic scoring.
- **D-12** Missing/unreadable fields: Claude returns `{value: null, confidence: "low", reasoning: "..."}`. UI shows "— nicht erkannt" in destructive color.
- **D-13** Extraction happens server-side in a Server Action (long-running allowed with Next 16 Server Actions up to ~60s). Not a client-side API call.
- **D-14** API errors surfaced to user: rate limit → retry banner; network → "Erneut versuchen" button; content policy → "Dokument konnte nicht analysiert werden" (rare).
- **D-15** Cost guardrail: log `input_tokens`, `output_tokens`, `cost_eur` per extraction to `extraction_log` table for audit.

### Data Model (phase-scoped additions)
- **D-16** New Drizzle tables:
  - `document` (id TEXT PK uuid, user_id, filename, size, sha256 UNIQUE per user, mime, storage_path, uploaded_at, extracted_at, extraction_status enum)
  - `extraction` (id, document_id FK, field_name, field_value TEXT NULL, confidence enum, reasoning TEXT, created_at) — one row per extracted field per document.
  - `extraction_log` (id, document_id FK, input_tokens, output_tokens, cost_eur, claude_model, created_at)
- **D-17** Alternative considered: JSON column on `document` for extraction — rejected. Per-field rows make Phase 3 review/edit simpler.

### UI Surfaces
- **D-18** New surfaces:
  - `/upload` — Upload dropzone + current batch status list
  - `/documents/[id]` — Single document view: extracted fields table with confidence badges, PDF preview (iframe or pdfjs), "Zur Überprüfung" button (Phase 3 teaser, non-functional for now)
  - Home page (`/`) updated: "Dokumente hochladen" primary button, "Zuletzt hochgeladen" list (last 5 documents)
- **D-19** Confidence badge colors: high = neutral/green-ish, medium = amber, low = destructive. Following shadcn Badge variants (add `variant="warning"` if needed — but use default+secondary+destructive to keep to UI-SPEC palette discipline).

### Language & Copy
- **D-20** All UI German. Keep existing UI-SPEC typography/spacing rules. Extracted field labels in German: "Dokumenttyp", "Ausstellende Behörde", "Ausstellungsort", "Bundesland", "Ausstellungsdatum", "Voller Name".

### Security & Limits
- **D-21** Server-side validation: file-type sniffing (not just extension), size limit, PDF structural validation (reject encrypted/password-protected PDFs with a clear German error).
- **D-22** Claude API key in `.env.local` as `ANTHROPIC_API_KEY`. Never logged. Never sent to client.
- **D-23** Rate limiting on the upload endpoint: 20 uploads/min per user (generous for batch, but guards against abuse).

### Claude's Discretion
- Exact confidence thresholds for UI color-coding (following D-11 Claude-reported values)
- Prompt engineering details for optimal extraction (documented in RESEARCH.md)
- Whether to preview uploaded PDFs inline (iframe) or link-out
- Specific error message wordings
- Whether to run extraction in parallel or serial for batch uploads (recommend parallel with concurrency=3 to respect rate limits)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets (from Phase 1)
- `app/(app)/layout.tsx` — authoritative session gate. All new surfaces (`/upload`, `/documents/[id]`) go inside this group.
- `lib/auth.ts` — `auth.api.getSession` available in Server Components and Server Actions
- `db/client.ts` — Drizzle client with WAL+FK pragmas
- shadcn components vendored: Button, Card, Input, Label, Form, Sonner
- Sonner is already mounted in root layout

### Established Patterns
- Server Actions or Server Components call `auth.api.getSession({ headers: await headers() })` for auth
- German UI copy, system fonts, Tailwind v4 `@theme` directive (no tailwind.config.ts)
- Tests: Vitest + happy-dom for UI, `// @vitest-environment node` for integration
- Test isolation: fresh SQLite per test file via `createTestDb()` fixture

### Integration Points
- New Drizzle schema additions — will extend `db/schema.ts`, NOT overwrite the better-auth tables
- Sidebar navigation — none yet; Phase 2 introduces a simple header nav or dashboard-style home page
- Validation: reuse Zod pattern from `lib/validations/auth.ts`

</code_context>

<specifics>
## Specific Ideas

- The test PDFs already committed to the repo root (e.g. `Publication_Record_SH.pdf`, `transcript.pdf`) can serve as initial fixtures for extraction testing, as can `Dokumenten Laufliste Dr. Sandra Hertel-2.pdf`.
- `behoerden_db.json` at the repo root is the authority data used later in Phase 3 — do not parse it in Phase 2.

</specifics>

<deferred>
## Deferred Ideas

- Editing extracted values → Phase 3
- Authority lookup from extracted bundesland/dokumenten_typ → Phase 3
- Grouping documents into cases → Phase 4
- Laufliste PDF generation → Phase 4
- Re-upload with versioning → Phase 5
- Extraction retry UI → Phase 5 (show failed extractions with retry button)
- Image uploads (JPG/PNG) — future. V1 is PDF-only per CLAUDE.md.
- OCR fallback when Claude can't read the PDF — future
- Per-document tagging / labels — future

</deferred>
