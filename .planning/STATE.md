---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 04-04-PLAN.md
last_updated: "2026-04-17T11:39:21.133Z"
last_activity: 2026-04-17
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 24
  completed_plans: 22
  percent: 92
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-16)

**Core value:** Upload documents, get a correct and complete Laufliste PDF with the right authorities for each document -- fast and without manual research.
**Current focus:** Phase 4 — laufliste-generation-cases

## Current Position

Phase: 4 (laufliste-generation-cases) — EXECUTING
Plan: 5 of 6
Status: Ready to execute
Last activity: 2026-04-17

Progress: [..........] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 18
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 5 | - | - |
| 02 | 7 | - | - |
| 03 | 6 | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 01 P01 | 13 | 2 tasks | 27 files |
| Phase 01 P02 | 4 | 2 tasks | 4 files |
| Phase 01 P03 | 7 | 3 tasks | 10 files |
| Phase 01-foundation-authentication P04 | 4 | 2 tasks | 9 files |
| Phase 01-foundation-authentication P05 | 15 | 4 tasks | 11 files |
| Phase 02 P01 | 4 | 3 tasks | 7 files |
| Phase 02 P02 | 4min | 2 tasks | 4 files |
| Phase 02-document-upload-ai-extraction P03 | 4m | 2 tasks | 11 files |
| Phase 02 P04 | 10min | 3 tasks | 8 files |
| Phase 02-document-upload-ai-extraction P05 | 4min | 2 tasks | 9 files |
| Phase 02-document-upload-ai-extraction P06 | 18min | 3 tasks | 8 files |
| Phase 02-document-upload-ai-extraction P07 | 10min | 1 task + 1 checkpoint tasks | 2 files files |
| Phase 03 P01 | 5min | 2 tasks | 7 files |
| Phase 03-review-authority-lookup P02 | 7min | 3 tasks | 6 files |
| Phase 03 P03 | 8min | 4 tasks | 8 files |
| Phase 03 P04 | 5min | 2 tasks tasks | 4 files files |
| Phase 03-review-authority-lookup P05 | 6min | 3 tasks | 9 files |
| Phase 03 P06 | 4min | 3 tasks | 2 files |
| Phase 04 P01 | 4min | 3 tasks | 11 files |
| Phase 04 P02 | 6min | 2 tasks | 5 files |
| Phase 04-laufliste-generation-cases P03 | 7 | 3 tasks | 11 files |
| Phase 04 P04 | 45m | 2 tasks | 5 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

-

- [Phase 01]: Use shadcn CLI v4.3 --defaults preset (base-nova) then relabel style to new-york in components.json — the old --style/--base-color flags were removed in shadcn 4.3
- [Phase 01]: Drop shadcn's auto-added Geist Google font; UI-SPEC mandates system font stack in Phase 1
- [Phase 01]: Pin better-sqlite3@12.9.0, drizzle-orm@0.45.2, drizzle-kit@0.31.10 at exact versions (no caret) for reproducible builds
- [Phase 01]: DB client uses path.resolve(process.cwd(), DATABASE_URL) to mitigate cwd-dependent path breakage (P-04) across dev/build/test contexts
- [Phase 01]: Enable journal_mode = WAL and foreign_keys = ON on every connection open (SQLite defaults FK enforcement OFF)
- [Phase 01]: Keep db/schema.ts as placeholder (export {}) — Plan 03 overwrites via better-auth CLI; hand-writing the auth schema is an anti-pattern (P-06)
- [Phase 01]: Plan 03: Use cookie-presence pattern in proxy.ts (no DB call) — avoids Edge-vs-Node runtime decision per P-08. Authoritative session check lives in app/(app)/layout.tsx (Plan 04).
- [Phase 01]: Plan 03: Honor CONTEXT D-15 literally — explicit customRules override sets 5/min on /sign-in/email (stricter than better-auth's 3/10s default).
- [Phase 01]: Plan 03: drizzle-kit push --force materializes data/angela.db, but drizzle-kit generate output (SQL + meta) is committed as source of truth for VPS deployment.
- [Phase 01-foundation-authentication]: Plan 04: Use authClient.signIn.email (client SDK) for login form per research Pattern 3 — simpler than a Server Action and matches official better-auth docs.
- [Phase 01-foundation-authentication]: Plan 04: Client-side Zod failures and server 401/400 both render the same inline string 'E-Mail oder Passwort ungültig.' to prevent user enumeration (T-04-01).
- [Phase 01-foundation-authentication]: Plan 04: Delete app/page.tsx — root / is served by app/(app)/page.tsx inside the (app) route group; avoids two files competing for the same URL.
- [Phase 01-foundation-authentication]: Plan 05: A1 assumption invalidated — auth.api.signUpEmail DOES respect disableSignUp: true. Added ALLOW_SIGNUP=1 env escape hatch in lib/auth.ts (production default unchanged).
- [Phase 01-foundation-authentication]: Plan 05: A2 confirmed — better-auth session cookie name is 'better-auth.session_token' with Max-Age=2592000 (30 days, matches D-11).
- [Phase 01-foundation-authentication]: Plan 05: Integration tests use returnHeaders (not asResponse) and req.cookies.set() (not Headers{cookie}) — happy-dom quirks documented in test files.
- [Phase 02]: Plan 02-01: Locked Option A for Server Action body limits — bodySizeLimit=15mb covers one 10MB PDF per call (not 110MB batched); set BOTH serverActions.bodySizeLimit AND proxyClientMaxBodySize (required for VPS production target per Next 15.5+).
- [Phase 02]: Plan 02-01: Honored CLAUDE.md pin of @anthropic-ai/sdk@0.88.0 (not latest 0.90); exact-pinned react-dropzone@15.0.0, pdf-lib@1.17.1, p-limit@7.3.0 — matches Phase 1 reproducibility pattern.
- [Phase 02]: Plan 02-01: Placed ANTHROPIC_API_KEY=sk-ant-PLACEHOLDER in .env.local (gitignored) so downstream imports don't crash at module-load. Operator must swap to real key before first live Claude extraction.
- [Phase 02]: Plan 02-02: Layered enum enforcement — Drizzle { enum } for TS + check() SQL constraint for DB-level safety
- [Phase 02]: Plan 02-02: Compound UNIQUE (user_id, sha256) for per-user SHA-256 dedup (CONTEXT D-08)
- [Phase 02]: Plan 02-02: drizzle-kit push --force fallback (migrate stalled due to Phase 1 push-applied 0000); plan explicitly permits this
- [Phase 02-document-upload-ai-extraction]: Plan 02-03: Hand-crafted encrypted-PDF fixture (scripts/make-encrypted-pdf.mjs) — qpdf not installed and pdf-lib cannot emit encrypted PDFs
- [Phase 02-document-upload-ai-extraction]: Plan 02-03: Server Action returns discriminated-union; never throws for user errors (RESEARCH Anti-Patterns)
- [Phase 02-document-upload-ai-extraction]: Plan 02-03: sha256Hex + onConflictDoNothing before writeUploadToDisk — no bytes on disk on dedup hit (Pitfalls 5 & 8)
- [Phase 02-document-upload-ai-extraction]: Plan 02-03: Extended vitest include to lib/**/*.test.ts — enables co-located unit+integration tests
- [Phase 02]: Plan 02-04: Use better-sqlite3 sync transaction with .run() — async transaction callbacks rejected with 'cannot return a promise'
- [Phase 02]: Plan 02-04: vi.doMock after vi.resetModules to mock relative imports inside dynamically loaded modules (the established hoisted vi.mock doesn't re-apply after resetModules for transitive static imports)
- [Phase 02-document-upload-ai-extraction]: Plan 02-05: /upload orchestrates upload+extract Server Actions per-file via p-limit(3); Button is @base-ui/react (no asChild) — use buttonVariants() on Link for styled navigation.
- [Phase 02-document-upload-ai-extraction]: PDF preview streamed through /api/documents/[id]/pdf Route Handler with per-request owner check; data/uploads never exposed publicly
- [Phase 02-document-upload-ai-extraction]: Link-as-button via buttonVariants() on <Link> (project Button primitive is base-ui, not Radix Slot, so asChild unsupported)
- [Phase 02-document-upload-ai-extraction]: Plan 02-07: Seed script committed as .ts invoked via tsx (not .mjs) — Node ESM could not resolve named exports from Drizzle .ts modules; matches scripts/seed-user.ts convention
- [Phase 02-document-upload-ai-extraction]: Plan 02-07: Phase 2 human-verify exit gate auto-approved in autonomous mode — 4 browser UAT items (dropzone UX, batch progress, iframe preview, extraction accuracy) remain as deferred operator sign-off
- [Phase 03]: Hoisted REVIEW_STATUS + LOOKUP_STATUS constants above Phase 2 section in db/schema.ts so document ALTER can reference them
- [Phase 03]: Reset dev DB (gitignored) when drizzle-kit push mid-transaction failure left orphan __new_document and dropped document — cleaner than surgical SQL repair
- [Phase 03-review-authority-lookup]: Seed accepts opts.parseState for test injection — avoids vi.mock brittleness across module reset boundaries
- [Phase 03-review-authority-lookup]: Seed idempotency via wipe+re-insert in single transaction — FK-safe and avoids UNIQUE constraint churn on global doc_type dedup
- [Phase 03-review-authority-lookup]: data/behoerden-parsed.json generated synthetically (placeholder ANTHROPIC_API_KEY); regenerate with --force + real key
- [Phase 03-review-authority-lookup]: Added --skip-parse CLI flag for CI / placeholder-key environments — errors if cache missing
- [Phase 03-review-authority-lookup]: CLI entry uses fileURLToPath (not string comparison) because iCloud project path contains spaces/tilde
- [Phase 03]: Plan 03-03: In-memory sqlite.exec(DDL) in resolver tests (no drizzle-kit push subprocess) — hermetic, fast, avoids parallel-test flakiness
- [Phase 03]: Plan 03-03: Pure resolver accepts db as 2nd arg (not imported) so tests inject in-memory DB without vi.mock
- [Phase 03]: Plan 04: review Server Actions use plain-object input (not FormData) to match Phase 2 extractDocumentAction convention; upsert via intra-transaction existence check instead of UNIQUE+onConflictDoUpdate to avoid Plan 01 schema migration.
- [Phase 03-review-authority-lookup]: Plan 05: DiscardDialog hand-rolled (role=alertdialog + focus + Escape) rather than adding shadcn AlertDialog — CONTEXT D-17 locks new components this phase to select only.
- [Phase 03-review-authority-lookup]: Plan 05: Dokumenttyp/Bundesland Selects store display_name/name (not slug); resolver slugifies at lookup time — keeps UI human-readable.
- [Phase 03-review-authority-lookup]: Plan 05: Controlled useState instead of react-hook-form — small form, Zod safeParse on submit is sufficient; focus first invalid field by id.
- [Phase 04]: Plan 04-01: caseTable exported as caseTable (SQL name 'case' via sqliteTable('case', ...)) — 'case' is a TS keyword
- [Phase 04]: Plan 04-01: uniqueIndex on case_document.document_id enforces D-02 one-case-per-doc globally at DB layer (belt-and-suspenders vs compound unique)
- [Phase 04]: Plan 04-01: @react-pdf/renderer added to next.config.ts serverExternalPackages preemptively — avoids Turbopack vs fontkit CJS tree-shaking issues before any import exists
- [Phase 04]: Plan 04-01: Retroactively committed drizzle/meta/0003_snapshot.json (missing from Phase 3) so drizzle-kit migrate works on clean clones
- [Phase 04]: Plan 04-02: DOC_ALREADY_ASSIGNED error returns details.documentId via post-failure lookup so 04-04 picker can offer a move flow
- [Phase 04]: Plan 04-02: Parking-sentinel (position=-1) pattern used for BOTH reorder swap and post-remove renumber — keeps logic future-proof if a compound UNIQUE(case_id, position) is ever added
- [Phase 04-laufliste-generation-cases]: Rendered Laufliste PDF uses @react-pdf/renderer renderToBuffer inside Server Actions (not renderToStream) to get byteLength for file_size column.
- [Phase 04-laufliste-generation-cases]: BVA/BfJ/UAE Embassy contact fields kept as research defaults with @assumed JSDoc; operator must verify against sample PDF before production print.
- [Phase 04]: Followed plan truths (Führungszeugnis -> exception-apostille) over inline prose that suggested 'authority' kind — matches Plan 03 render contract
- [Phase 04]: Split queries into lib/laufliste/queries.ts (mirrors lib/cases/{actions,queries}.ts) so Plan 06 download route imports getLauflisteForDownload without pulling Server Action bundle

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-04-17T11:39:21.129Z
Stopped at: Completed 04-04-PLAN.md
Resume file: None
