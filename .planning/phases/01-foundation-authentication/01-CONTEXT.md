# Phase 1: Foundation & Authentication - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — defaults chosen from research findings

<domain>
## Phase Boundary

Establish the full-stack foundation (Next.js project, SQLite + Drizzle ORM, Tailwind + shadcn/ui) and deliver password-based authentication. Delivers a running web application where the user can log in, stay logged in across refresh, and log out — and is prevented from accessing the app without logging in.

Out of scope: any document processing, AI calls, file upload, PDF generation, Behoerden data — those belong to Phases 2–5.

</domain>

<decisions>
## Implementation Decisions

### Stack Foundation
- **D-01:** Next.js 16.2 with App Router and Turbopack
- **D-02:** TypeScript 6.0 (strict mode)
- **D-03:** SQLite via better-sqlite3 12.9, database file at `./data/angela.db` (gitignored), schema and migrations managed by Drizzle ORM 0.45
- **D-04:** Tailwind CSS 4.2 with @theme directives (no tailwind.config.js)
- **D-05:** shadcn/ui (CLI v4) for UI components — install Button, Card, Input, Label, Form, Sonner on first use
- **D-06:** Deployment target: VPS (Docker/PM2 behind Nginx). SQLite path on persistent filesystem. Vercel is explicitly rejected (ephemeral FS incompatible with SQLite).
- **D-07:** Project structure: standard Next.js App Router layout — `app/`, `components/`, `lib/`, `db/`, `data/`. Put Drizzle schema in `db/schema.ts`, Drizzle client in `db/client.ts`.

### Authentication
- **D-08:** Use better-auth 1.6 with emailAndPassword plugin
- **D-09:** Username is the email field (better-auth's native shape); no separate username
- **D-10:** No self-service signup in v1 — single operator account is seeded via a one-time CLI script (`scripts/seed-user.ts`) or environment variable bootstrap. Login form has NO "register" link.
- **D-11:** Session storage: better-auth default (session row in SQLite + httpOnly secure cookie). Session duration: 30 days rolling (extends on activity).
- **D-12:** Protected routes: everything except `/login` requires auth. Implement via a single `middleware.ts` at project root that redirects unauthenticated requests to `/login`.
- **D-13:** Logout: POST to `/api/auth/sign-out` (better-auth built-in), then redirect to `/login`.
- **D-14:** Password policy: minimum 12 characters. No complexity rules — operator-managed, length beats complexity.
- **D-15:** Rate limiting: use better-auth's built-in rate limiting for login attempts (5/min default).

### UI
- **D-16:** Login page at `/login` — centered card with email/password inputs and a single "Anmelden" button. German-language UI (per PROJECT.md: app UI can be German).
- **D-17:** Main application shell at `/` (home route) — simple header showing the logged-in user's email + logout button. Body says "Willkommen" (placeholder until Phase 2 adds upload).
- **D-18:** Error states: failed login shows inline error "E-Mail oder Passwort ungültig." Use sonner toast for unexpected errors.
- **D-19:** Loading state on login: button shows spinner and is disabled during submission.

### Environment & Config
- **D-20:** `.env.local` for secrets (BETTER_AUTH_SECRET, DATABASE_URL). `.env.example` committed as template. Never commit `.env.local`.
- **D-21:** `data/` directory gitignored (contains SQLite file and uploaded PDFs later). Create `data/.gitkeep`.
- **D-22:** Node 22 LTS as the minimum runtime. Pin via `.nvmrc` or `package.json` engines field.

### Claude's Discretion
- Exact Tailwind theme colors (pick a neutral, professional palette — this is an internal tool, not a marketing site)
- Font choice (system font stack is fine; no custom font unless Phase 4 requires one for PDF)
- Exact directory layout for tests (start with `__tests__/` at root, move later if needed)
- Whether to include a brief splash/loading screen — skip unless trivially easy

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context
- `.planning/PROJECT.md` — Project vision, constraints, core value
- `.planning/REQUIREMENTS.md` — v1 requirement list, AUTH-01 through AUTH-03 for this phase
- `.planning/ROADMAP.md` — Phase 1 goal and success criteria

### Research
- `.planning/research/STACK.md` — Full stack decisions with versions and rationale
- `.planning/research/ARCHITECTURE.md` — Monolithic Next.js App Router pattern, Server Actions vs API routes
- `.planning/research/PITFALLS.md` — Authentication pitfalls, session handling, deployment gotchas
- `.planning/research/SUMMARY.md` — Cross-cutting synthesis and roadmap implications

### External docs (to consult via Context7 during planning)
- `better-auth` — `emailAndPassword` plugin, Drizzle adapter setup for SQLite
- `drizzle-orm` — better-sqlite3 integration, drizzle-kit migrations
- `next` — App Router middleware, Server Actions patterns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
None — greenfield project. Phase 1 scaffolds everything.

### Established Patterns
None yet — Phase 1 establishes patterns for later phases:
- Server Actions for mutations (auth, later: upload, generate)
- Drizzle schema as single source of truth for DB structure
- shadcn/ui components copied to `components/ui/`
- Form validation via Zod schemas shared between client and server

### Integration Points
- Phase 2 will add document upload routes — all behind the middleware gate from Phase 1
- Phase 5 admin routes will use the same auth gate

</code_context>

<specifics>
## Specific Ideas

- Internal tool, 1–3 users max — resist any urge to over-engineer auth (no OAuth, no 2FA, no magic links, no self-service signup)
- German UI is fine and preferred ("Anmelden" not "Sign in")
- The Laufliste output in Phase 4 must render German umlauts correctly — verify font embedding works from day one, but that's Phase 4 scope

</specifics>

<deferred>
## Deferred Ideas

- Self-service signup — out of scope (internal tool, single operator)
- OAuth / social login — out of scope (see REQUIREMENTS.md Out of Scope)
- 2FA — not requested, adds complexity for low threat model
- Password recovery flow — operator runs seed script to reset; no email service in v1
- User management UI (add/remove users, roles) — future milestone if team grows
- Audit log of login attempts — deferred; better-auth rate limiting is sufficient for now
- Docker / CI setup — separate infrastructure phase later

</deferred>

---

*Phase: 01-foundation-authentication*
*Context gathered: 2026-04-17*
