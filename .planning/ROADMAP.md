# Roadmap: Angela App

## Overview

The Angela App delivers a complete pipeline from document upload to Laufliste PDF output. The roadmap follows the natural workflow: establish the foundation with auth, build the input pipeline (upload and AI extraction), connect it through review and authority lookup, produce the PDF output organized by cases, then layer on history and admin capabilities. Each phase delivers a verifiable, end-to-end capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation & Authentication** - Project scaffolding, database setup, and password-based login
- [ ] **Phase 2: Document Upload & AI Extraction** - Upload PDFs and extract structured data via Claude Vision
- [ ] **Phase 3: Review & Authority Lookup** - Review/edit extraction results and resolve correct Vorbeglaubigung authorities
- [ ] **Phase 4: Laufliste Generation & Cases** - Generate PDF Laufliste output and organize documents into cases
- [ ] **Phase 5: History, Re-upload & Admin** - Browse past Lauflisten, re-upload documents, and maintain Behoerden database

## Phase Details

### Phase 1: Foundation & Authentication
**Goal**: User can access a running web application with secure login
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03
**Success Criteria** (what must be TRUE):
  1. User can log in with username and password and see the main application screen
  2. User can close the browser, reopen it, and still be logged in
  3. User can log out and be prevented from accessing the app without logging in again
**Plans:** 5 plans
Plans:
- [x] 01-01-PLAN.md — Scaffold Next.js 16.2 + Tailwind v4 + shadcn (new-york) + Vitest (Wave 1)
- [x] 01-02-PLAN.md — Install better-sqlite3 + Drizzle ORM, write db/client.ts + drizzle.config.ts (Wave 2)
- [x] 01-03-PLAN.md — better-auth config + schema generation + catch-all route + proxy.ts (Wave 3)
- [x] 01-04-PLAN.md — Login page + protected layout + logout button + German copy (Wave 4)
- [x] 01-05-PLAN.md — Seed user script + integration tests + human verification (Wave 5)
**UI hint**: yes

### Phase 2: Document Upload & AI Extraction
**Goal**: User can upload PDF documents and receive AI-extracted structured data from them
**Depends on**: Phase 1
**Requirements**: UPLD-01, UPLD-02, EXTR-01, EXTR-02
**Success Criteria** (what must be TRUE):
  1. User can upload a single PDF via file picker or drag-and-drop and see it accepted by the system
  2. User can upload multiple PDFs at once and see each one processed
  3. After upload, system displays extracted fields (dokumenten_typ, ausstellende_behoerde, ausstellungsort, bundesland, ausstellungsdatum, voller_name) for the document
  4. Each extracted field shows a confidence indicator (high/medium/low) so the user knows what needs review
**Plans**: 7 plans
Plans:
- [x] 02-01-PLAN.md — Next config body limits + install react-dropzone/pdf-lib/p-limit/@anthropic-ai/sdk + env setup (Wave 1)
- [x] 02-02-PLAN.md — Drizzle schema: document/extraction/extraction_log + BLOCKING migration push (Wave 2)
- [x] 02-03-PLAN.md — Upload Server Action: validate + hash + pdf-lib check + dedup + fs persist (Wave 3)
- [x] 02-04-PLAN.md — Extraction Server Action: Claude SDK + prompt + Zod + cost log + transactional writes (Wave 3)
- [x] 02-05-PLAN.md — /upload page: react-dropzone + useActionState + p-limit(3) client orchestration (Wave 4)
- [x] 02-06-PLAN.md — /documents/[id] + /api/documents/[id]/pdf Route Handler + home page update (Wave 5)
- [x] 02-07-PLAN.md — Integration tests + human-verify checkpoint (Wave 6)
**UI hint**: yes

### Phase 3: Review & Authority Lookup
**Goal**: User can verify and correct AI extraction results, then trigger authority lookup to see the correct Vorbeglaubigung authority with full contact details
**Depends on**: Phase 2
**Requirements**: REVW-01, REVW-02, REVW-03, REVW-04, LKUP-01, LKUP-02, LKUP-03, LKUP-04
**Success Criteria** (what must be TRUE):
  1. User sees the original PDF side-by-side with extracted data and can compare them visually
  2. User can edit any extracted field inline, with Bundesland and Dokumententyp selectable from constrained dropdown lists
  3. User can approve extraction results, triggering the system to look up the correct Vorbeglaubigung authority from the Behoerden database
  4. After approval, system displays the resolved authority with full contact details (name, address, phone, email, office hours, website)
  5. System correctly handles Regierungsbezirk sub-routing and displays special routing rules and exceptions where applicable
**Plans**: 6 plans
Plans:
- [x] 03-01-PLAN.md — Schema additions + [BLOCKING] migration push + install fastest-levenshtein + vendor shadcn select (Wave 1)
- [x] 03-02-PLAN.md — Behörden seed script: parse 16 states via Claude, cache data/behoerden-parsed.json, insert authorities (Wave 2)
- [x] 03-03-PLAN.md — Resolver library (slug, city-map, fuzzy resolveAuthority) + unit tests (Wave 2)
- [x] 03-04-PLAN.md — approveAndResolve Server Action + Zod validations + chooseAmbiguousAuthority (Wave 3)
- [x] 03-05-PLAN.md — Review page UI: ReviewForm + FieldRow + AuthorityResultPanel + enabled review link (Wave 4)
- [x] 03-06-PLAN.md — Integration tests + human-verify checkpoint (Wave 5)
**UI hint**: yes

### Phase 4: Laufliste Generation & Cases
**Goal**: User can organize documents into cases and generate a complete, professionally formatted Laufliste PDF covering the full authentication chain
**Depends on**: Phase 3
**Requirements**: LAFL-01, LAFL-02, LAFL-03, CASE-01, CASE-02, CASE-03
**Success Criteria** (what must be TRUE):
  1. User can create a named case for a person and add multiple documents to it
  2. System generates a PDF Laufliste showing the full chain per document (Vorbeglaubigung -> Endbeglaubigung -> Legalisation) with correct authority details
  3. Generated PDF matches the existing Laufliste format with professional layout and correct German characters (umlauts)
  4. User can download the generated PDF to their local machine
**Plans:** 6 plans
Plans:
- [x] 04-01-PLAN.md — Schema additions (case, case_document, laufliste) + [BLOCKING] drizzle-kit push + install @react-pdf/renderer@4.5.1 + vendor shadcn dialog/sheet/checkbox/textarea (Wave 1)
- [ ] 04-02-PLAN.md — Cases queries + Server Actions: create, addDocs, remove, reorder (Wave 2)
- [ ] 04-03-PLAN.md — Laufliste PDF generator: static BVA/BfJ + UAE Embassy + React-PDF document tree + renderLaufliste + storage helper + slug util (Wave 3)
- [ ] 04-04-PLAN.md — buildLauflisteInput composer + generateLauflisteAction + laufliste queries (Wave 4)
- [ ] 04-05-PLAN.md — Cases UI: /cases, /cases/new, /cases/[id] + AddDocumentsSheet + Remove/Regenerate dialogs (Wave 5)
- [ ] 04-06-PLAN.md — Download Route Handler + Historie + integration test + human-verify checkpoint (Wave 6)
**UI hint**: yes

### Phase 5: History, Re-upload & Admin
**Goal**: User can browse and search past Lauflisten, replace document scans, and maintain the Behoerden database without code changes
**Depends on**: Phase 4
**Requirements**: HIST-01, HIST-02, HIST-03, UPLD-03, ADMN-01, ADMN-02, ADMN-03
**Success Criteria** (what must be TRUE):
  1. User can view a list of past Lauflisten showing date, person name, and document count
  2. User can search and filter history by name or date and re-download any previously generated PDF
  3. User can re-upload a better scan for an existing document without recreating the case, and the system re-processes it
  4. User can view, search, and filter the Behoerden database and edit authority contact details
  5. User can add new document types or modify routing rules through the admin interface
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Authentication | 0/5 | Not started | - |
| 2. Document Upload & AI Extraction | 0/7 | Not started | - |
| 3. Review & Authority Lookup | 2/6 | In Progress|  |
| 4. Laufliste Generation & Cases | 0/6 | Not started | - |
| 5. History, Re-upload & Admin | 0/0 | Not started | - |
