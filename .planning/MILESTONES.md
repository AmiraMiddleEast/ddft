# Milestones

## v1.0 v1.0 (Shipped: 2026-04-17)

**Phases completed:** 5 phases, 29 plans, 48 tasks

**Key accomplishments:**

- 1. [Rule 1 - Bug] shadcn CLI flags changed in v4.3.0
- `db/schema.ts`
- Operator seed script with D-14 guard + A1 fallback, plus a 21-test integration suite proving AUTH-01, AUTH-02 cookie persistence mechanism, AUTH-03, and proxy gate behavior
- Phase 2 dependency + config scaffold: Next 16 body limits raised to 15 MB, @anthropic-ai/sdk 0.88.0 + react-dropzone 15.0.0 + pdf-lib 1.17.1 + p-limit 7.3.0 exact-pinned, ANTHROPIC_API_KEY placeholder wired, data/uploads/ gitignore scaffolded.
- Three new SQLite tables (document, extraction, extraction_log) with SHA-256 dedup, per-field extraction rows, and cost-tracking log — wired to the Phase 1 user table via cascade FKs and applied to data/angela.db.
- Server-side single-file upload pipeline: validate PDF structure (magic bytes + pdf-lib encryption detection), compute SHA-256, short-circuit on per-user dedup hit, write original to `data/uploads/{uuid}.pdf`, insert `document` row with `extraction_status='pending'` — all via one `"use server"` Server Action with discriminated-union return.
- 1. [Rule 3 - Blocker] better-sqlite3 sync transaction
- `/upload` route with react-dropzone, p-limit(3) fan-out of upload+extract Server Actions, and locked German per-row status UI.
- Document detail page with iframe PDF preview and 6-field confidence-badged extraction table, session-gated PDF Route Handler, and home page rebuilt around 'Übersicht' with an upload CTA and a 5-row recent-uploads table.
- End-to-end integration suite (upload → extract → query + Route Handler ownership) with Claude mocked, plus idempotent seed script for UAT, closing out Phase 2's document-upload-ai-extraction workstream.
- Five new Drizzle tables (behoerden_state/regierungsbezirk/document_type/authority, document_review) + review_status/reviewed_at columns on document, fastest-levenshtein@1.0.16 pinned, and shadcn Select vendored — Phase 3 foundation ready.
- Claude-driven markdown→structured-JSON Behörden seed with idempotent Drizzle insert, committed 16-state cache, and mock-driven idempotency tests.
- 1. [Rule 3 - Blocking] Duplicate map keys in city-to-regierungsbezirk.ts
- Transactional Server Actions wrapping the Phase 3 resolver: session + Zod + ownership gates, then upsert document_review + flip document to 'approved' in one sync SQLite transaction; chooseAmbiguousAuthority transitions ambiguous reviews to matched without duplicating rows.
- Ships /documents/[id]/review — two-column PDF+form Server Component, 6-field controlled client form with dirty tracking + Zod submit + Server Action call, and a 3-variant (matched/ambiguous/not_found) authority result panel; also enables the previously-disabled 'Zur Überprüfung' CTA on the detail page.
- End-to-end integration suite (approveAndResolve + chooseAmbiguousAuthority against real in-memory DB + real resolver) plus Server Component branch tests, closing Phase 3 with live-browser UAT deferred under autonomous mode.
- Drizzle schema for case/case_document/laufliste with global one-case-per-doc unique index, @react-pdf/renderer@4.5.1 exact-pinned, and four shadcn primitives (dialog/sheet/checkbox/textarea) vendored — Phase 4 waves 2-6 can now import types, push PDFs, and build UI without further setup.
- One-liner:
- 1. [Rule 3 - Inconsistency] Plan's own truths vs. inline action body on Führungszeugnis Vorbeglaubigung kind
- 1. [Rule 3 — Blocking] UI test could not import CaseDetailPage — transitive `server-only` chain
- One-liner:
- One-liner:
- One-liner:
- One-liner:
- One-liner:

---
