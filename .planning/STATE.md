---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 02-05-PLAN.md
last_updated: "2026-04-17T05:13:39.969Z"
last_activity: 2026-04-17
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 12
  completed_plans: 10
  percent: 83
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-16)

**Core value:** Upload documents, get a correct and complete Laufliste PDF with the right authorities for each document -- fast and without manual research.
**Current focus:** Phase 2 — document-upload-ai-extraction

## Current Position

Phase: 2 (document-upload-ai-extraction) — EXECUTING
Plan: 6 of 7
Status: Ready to execute
Last activity: 2026-04-17

Progress: [..........] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 5
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 5 | - | - |

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

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-04-17T05:13:39.966Z
Stopped at: Completed 02-05-PLAN.md
Resume file: None
