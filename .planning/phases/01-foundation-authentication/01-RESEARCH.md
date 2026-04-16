# Phase 1: Foundation & Authentication - Research

**Researched:** 2026-04-17
**Domain:** Next.js 16 App Router scaffolding, SQLite+Drizzle persistence, better-auth email/password authentication
**Confidence:** HIGH

## Summary

Phase 1 delivers a running Next.js 16.2 app with a single-operator login (email+password), persistent sessions across browser close, logout, and a protected route gate. The stack is fully locked in CLAUDE.md and CONTEXT.md: Next.js 16.2 / React 19.2 / TypeScript 6.0 / Tailwind 4.2 / better-sqlite3 12.9 / Drizzle ORM 0.45 / better-auth 1.6 / shadcn/ui (new-york). All versions verified live against the npm registry on 2026-04-17.

One major finding forces a deviation from CONTEXT.md wording: **Next.js 16 (released pre-April 2026) deprecated and renamed `middleware.ts` to `proxy.ts`**. The file lives at the same path, same exports, same matcher semantics — only the filename and function name change. CONTEXT.md D-12 says "middleware.ts at project root"; the planner must substitute `proxy.ts`. The CLI codemod `npx @next/codemod@canary middleware-to-proxy .` exists but is not needed since we are greenfield.

Two other planner-shaping findings: (1) Next.js officially warns that proxy/middleware is not a sufficient auth boundary — every Server Action and protected page must re-check the session server-side, which is one extra line per protected surface. (2) better-auth ships a schema-generator CLI (`npx @better-auth/cli generate`) that produces the Drizzle table definitions automatically; hand-writing the user/session/account/verification schema is a small but avoidable pitfall.

**Primary recommendation:** Scaffold with `create-next-app` (Next 16.2, TS, Tailwind, App Router, `src/` off), then layer Drizzle → better-auth schema generation → better-auth config → `proxy.ts` gate → shadcn/ui init → login page → authed shell → seed script. Use better-auth's built-in `emailAndPassword` with `disableSignUp: true` and `minPasswordLength: 12`. Keep `middleware.ts` out of the repo — write `proxy.ts` directly. Never rely on `proxy.ts` as the only auth boundary; call `auth.api.getSession` inside every protected page and Server Action.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Stack Foundation**
- **D-01:** Next.js 16.2 with App Router and Turbopack
- **D-02:** TypeScript 6.0 (strict mode)
- **D-03:** SQLite via better-sqlite3 12.9, database file at `./data/angela.db` (gitignored), schema and migrations managed by Drizzle ORM 0.45
- **D-04:** Tailwind CSS 4.2 with `@theme` directives (no `tailwind.config.js`)
- **D-05:** shadcn/ui (CLI v4) for UI components — install Button, Card, Input, Label, Form, Sonner on first use
- **D-06:** Deployment target: VPS (Docker/PM2 behind Nginx). SQLite path on persistent filesystem. Vercel is explicitly rejected (ephemeral FS incompatible with SQLite).
- **D-07:** Project structure: standard Next.js App Router layout — `app/`, `components/`, `lib/`, `db/`, `data/`. Put Drizzle schema in `db/schema.ts`, Drizzle client in `db/client.ts`.

**Authentication**
- **D-08:** Use better-auth 1.6 with `emailAndPassword` plugin
- **D-09:** Username is the email field (better-auth's native shape); no separate username
- **D-10:** No self-service signup in v1 — single operator account is seeded via a one-time CLI script (`scripts/seed-user.ts`) or environment variable bootstrap. Login form has NO "register" link.
- **D-11:** Session storage: better-auth default (session row in SQLite + httpOnly secure cookie). Session duration: 30 days rolling (extends on activity).
- **D-12:** Protected routes: everything except `/login` requires auth. Implement via a single `middleware.ts` at project root that redirects unauthenticated requests to `/login`. **⚠ Planner override required:** In Next.js 16 this file is now named `proxy.ts` (see Common Pitfalls §P-01). Semantics and location identical.
- **D-13:** Logout: POST to `/api/auth/sign-out` (better-auth built-in), then redirect to `/login`.
- **D-14:** Password policy: minimum 12 characters. No complexity rules — operator-managed, length beats complexity.
- **D-15:** Rate limiting: use better-auth's built-in rate limiting for login attempts (5/min default). *Note: better-auth's documented sign-in default is 3 requests / 10 seconds — see §Authentication Details. 5/min is stricter and must be explicitly configured.*

**UI**
- **D-16:** Login page at `/login` — centered card with email/password inputs and a single "Anmelden" button. German-language UI.
- **D-17:** Main application shell at `/` — simple header showing the logged-in user's email + logout button. Body says "Willkommen" (placeholder until Phase 2 adds upload).
- **D-18:** Error states: failed login shows inline error "E-Mail oder Passwort ungültig." Use sonner toast for unexpected errors.
- **D-19:** Loading state on login: button shows spinner and is disabled during submission.

**Environment & Config**
- **D-20:** `.env.local` for secrets (BETTER_AUTH_SECRET, DATABASE_URL). `.env.example` committed as template. Never commit `.env.local`.
- **D-21:** `data/` directory gitignored (contains SQLite file and uploaded PDFs later). Create `data/.gitkeep`.
- **D-22:** Node 22 LTS as the minimum runtime. Pin via `.nvmrc` or `package.json` engines field.

### Claude's Discretion
- Exact Tailwind theme colors (neutral professional palette per UI-SPEC — OKLCH values via `@theme`)
- Font choice (system font stack per UI-SPEC — no custom font in Phase 1)
- Test directory layout (start with `__tests__/` at root, move later if needed)
- Whether to include a brief splash/loading screen (skip unless trivially easy)

### Deferred Ideas (OUT OF SCOPE)
- Self-service signup
- OAuth / social login
- 2FA
- Password recovery flow (operator re-runs seed script)
- User management UI
- Audit log of login attempts
- Docker / CI setup (separate infrastructure phase later)

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can log in with username and password | better-auth `emailAndPassword` plugin — email is the username per D-09. See §Authentication Details and §Code Examples (auth.ts, login action). |
| AUTH-02 | User session persists across browser refresh | better-auth default sessions are cookie-based with server-side session rows; sessions survive browser close because the cookie has a `Max-Age` (not a session cookie). 30-day rolling expiry configured via `session.expiresIn` (D-11). See §Authentication Details. |
| AUTH-03 | User can log out | POST `/api/auth/sign-out` (D-13) — mounted by the `[...all]` catch-all route handler. See §Code Examples (logout button). |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 16.2.4 | Framework, router, server actions, build | Locked in CLAUDE.md. Verified current. `[VERIFIED: npm view next version → 16.2.4, 2026-04-17]` |
| `react` | 19.2.5 | UI runtime | Ships with Next 16; do not install separately. `[CITED: CLAUDE.md Version Compatibility]` |
| `typescript` | 6.0.2 | Type system (strict mode) | `[CITED: CLAUDE.md]` |
| `tailwindcss` | 4.2.0 | Styling, `@theme` CSS-first config | No `tailwind.config.js` (D-04). `[CITED: CLAUDE.md, infoq.com Tailwind 4.2 release]` |
| `better-sqlite3` | 12.9.0 | Sync SQLite driver | `[VERIFIED: npm view better-sqlite3 version → 12.9.0]` |
| `drizzle-orm` | 0.45.2 | Type-safe SQL | `[VERIFIED: npm view drizzle-orm version → 0.45.2]` |
| `drizzle-kit` | 0.31.10 | Migrations + Studio | `[VERIFIED: npm view drizzle-kit version → 0.31.10]` |
| `better-auth` | 1.6.5 | Auth | CLAUDE.md lists 1.6.4; npm registry has 1.6.5 (minor bump). Use `^1.6.4` or `1.6.5` — semver-compatible. `[VERIFIED: npm view better-auth version → 1.6.5]` |
| `zod` | 4.3.6 | Validation | `[VERIFIED: npm view zod version → 4.3.6]` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | latest | Icons | Default icon set for shadcn; only needed if an icon is used in Phase 1 (header logout icon — optional). `[CITED: CLAUDE.md]` |
| `sonner` | latest | Toast notifications | D-18 — installed via `npx shadcn@latest add sonner`. `[CITED: UI-SPEC]` |
| `clsx` + `tailwind-merge` | latest | `cn()` helper | Auto-installed by `shadcn init`. |
| `@hookform/resolvers` + `react-hook-form` | latest | Form state for shadcn `<Form>` | Required by shadcn `form` component. `[CITED: ui.shadcn.com/docs/components/form]` |

### Dev-Only
| Library | Version | Purpose |
|---------|---------|---------|
| `@types/better-sqlite3` | latest | TS types for the driver |
| `@types/node` | latest | Node types |
| `tsx` | latest | Run `scripts/seed-user.ts` without a compile step |
| `eslint` + `eslint-config-next` | bundled | Linting (from create-next-app) |
| `prettier` + `prettier-plugin-tailwindcss` | latest | Auto-sort Tailwind classes |

### Alternatives Considered (per CLAUDE.md, locked — do not revisit)
| Instead of | Not Using | Reason |
|------------|-----------|--------|
| better-auth | NextAuth/Auth.js v5 | Auth.js team joined better-auth; better-auth is simpler for email/password. [CITED: CLAUDE.md] |
| better-sqlite3 | Postgres | Single-user tool, no concurrent writes. [CITED: CLAUDE.md] |
| Drizzle | Prisma | Lighter, better SQLite, faster cold start. [CITED: CLAUDE.md] |

**Installation (single command sequence):**
```bash
# 1. Scaffold
npx create-next-app@16.2.4 angela-app --ts --tailwind --app --no-src-dir --import-alias "@/*" --turbopack --eslint --no-git

cd angela-app

# 2. Core deps
npm install better-sqlite3@12.9.0 drizzle-orm@0.45.2 better-auth@1.6.5 zod@4.3.6

# 3. Dev deps
npm install -D drizzle-kit@0.31.10 @types/better-sqlite3 tsx

# 4. shadcn/ui init (Tailwind v4, new-york style)
npx shadcn@latest init

# 5. Add required components
npx shadcn@latest add button card input label form sonner
```

**Version verification performed 2026-04-17** against `npm view`:
- `next@16.2.4` (CLAUDE.md: 16.2 ✓)
- `better-auth@1.6.5` (CLAUDE.md: 1.6.4 — patch-level drift, accept newer)
- `drizzle-orm@0.45.2` ✓
- `drizzle-kit@0.31.10` (CLAUDE.md did not pin — use this)
- `better-sqlite3@12.9.0` ✓
- `zod@4.3.6` ✓

---

## Architecture Patterns

### Recommended Project Structure

Aligned with CONTEXT D-07 (flat `db/` at root, not inside `lib/`). Diverges from `.planning/research/ARCHITECTURE.md` (which put DB under `lib/db/`) — CONTEXT D-07 is the locked decision.

```
angela-app/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx              # /login — unauthenticated
│   ├── (app)/
│   │   ├── layout.tsx                # authed shell: header + logout
│   │   └── page.tsx                  # / — "Willkommen" placeholder
│   ├── api/
│   │   └── auth/
│   │       └── [...all]/
│   │           └── route.ts          # better-auth catch-all (GET + POST)
│   ├── layout.tsx                    # root layout — <Toaster/> lives here
│   └── globals.css                   # Tailwind @theme tokens
├── components/
│   └── ui/                           # shadcn vendored components (button, card, input, label, form, sonner)
├── lib/
│   ├── auth.ts                       # better-auth server instance
│   ├── auth-client.ts                # better-auth client (useSession, signIn, signOut)
│   └── utils.ts                      # cn() helper (from shadcn init)
├── db/
│   ├── client.ts                     # Drizzle + better-sqlite3 connection
│   └── schema.ts                     # user, session, account, verification tables (generated via better-auth CLI)
├── drizzle/                          # generated migrations (committed)
├── scripts/
│   └── seed-user.ts                  # one-time operator bootstrap (D-10)
├── data/
│   ├── .gitkeep                      # folder committed, contents gitignored
│   └── angela.db                     # gitignored
├── __tests__/                        # Phase 1 Nyquist tests
├── proxy.ts                          # ← Next.js 16 name (replaces middleware.ts)
├── drizzle.config.ts
├── components.json                   # shadcn config (new-york, base-color: neutral)
├── next.config.ts
├── tsconfig.json
├── package.json
├── .nvmrc                            # "22"
├── .env.local                        # gitignored
├── .env.example                      # committed template
└── .gitignore                        # +data/, +.env.local, +*.db, +*.db-journal
```

### Pattern 1: better-auth catch-all + proxy gate (not sole gate)

**What:** A single file at `app/api/auth/[...all]/route.ts` exposes every better-auth endpoint (`/api/auth/sign-in/email`, `/api/auth/sign-out`, `/api/auth/get-session`, etc.). A `proxy.ts` at project root reads the session cookie and redirects unauthenticated requests to `/login`.

**When to use:** Always, for Next.js + better-auth.

**Example:** see §Code Examples §CE-03 and §CE-04.

**Anti-pattern:** Trusting `proxy.ts` as the only auth check. Next.js 16 proxy docs explicitly warn: *"Always verify authentication and authorization inside each Server Function rather than relying on Proxy alone."* `[CITED: nextjs.org/docs/app/api-reference/file-conventions/proxy, Execution order note]` — every protected page and every Server Action must also call `auth.api.getSession({ headers: await headers() })` and redirect/throw if null. Phase 1's only protected page (`/`) must do this inside `app/(app)/layout.tsx`.

### Pattern 2: Drizzle schema generated by better-auth CLI

**What:** Instead of hand-writing the `user`/`session`/`account`/`verification` tables, run `npx @better-auth/cli generate` after writing `lib/auth.ts`. The CLI inspects the auth config (which plugins are enabled) and emits a Drizzle schema file matching exactly what the Drizzle adapter expects.

**When to use:** Every time the auth config changes shape (adding plugins, changing fields).

**Flow:**
1. Write `lib/auth.ts` with `drizzleAdapter(db, { provider: "sqlite" })` and `emailAndPassword: { enabled: true }`.
2. Run `npx @better-auth/cli@latest generate --output db/schema.ts` — generates the 4 tables.
3. Run `npx drizzle-kit generate` — emits SQL migration from schema.
4. Run `npx drizzle-kit migrate` — applies migration to `data/angela.db`.

`[CITED: better-auth.com/docs/adapters/drizzle — "The Better Auth CLI allows you to generate or migrate your database schema based on your Better Auth configuration and plugins."]`

**Why this matters:** The Drizzle adapter matches table names by convention. Drift between the schema file and what the adapter expects produces silent "user not found" errors. Using the generator eliminates this class of bug.

### Pattern 3: Server Action + useActionState for login form

**What:** The login form is a React 19 client component calling a Server Action via `useActionState`. The Server Action calls `auth.api.signInEmail(...)` and returns `{ error?: string }`.

**When to use:** All Phase 1+ mutations (login, future upload/generate). Server Actions are the default mutation primitive in App Router. `[CITED: CLAUDE.md — "Server Actions eliminate boilerplate for form submissions"]`.

**Alternative considered:** `authClient.signIn.email(...)` from better-auth's client SDK (a client-side fetch to `/api/auth/sign-in/email`). Functionally equivalent and simpler — one fewer indirection. **Recommendation:** Use the client SDK (`authClient.signIn.email`) for Phase 1 login because (a) better-auth's client already handles the cookie round-trip and error shape, (b) the form is trivially small, and (c) it's what the official docs demonstrate. Reserve Server Actions for mutations that need server-only logic (upload, Claude calls in Phase 2+). `[CITED: better-auth.com/docs/basic-usage]`

### Pattern 4: Authed layout as the server-side gate

**What:** `app/(app)/layout.tsx` is a Server Component. It calls `auth.api.getSession({ headers: await headers() })`. If null, it calls `redirect('/login')`. All child routes inherit the redirect — no per-page check needed inside the `(app)` group.

**When to use:** Phase 1 and every future authenticated route group.

**Example:** see §Code Examples §CE-05.

### Anti-Patterns to Avoid

- **Hand-writing the auth schema** — use the better-auth CLI. Prevents adapter mismatches.
- **`next dev` without `--turbopack`** — Next 16 makes Turbopack the default; do not pass legacy flags that disable it.
- **Running `drizzle-kit push`** in this project — we use generate+migrate so migrations are committed (important for VPS deployment D-06).
- **Storing `BETTER_AUTH_SECRET` in `.env` (not `.env.local`)** — `.env` is committed by default; secrets leak. Only `.env.local` and `.env.*.local` are gitignored by `create-next-app`.
- **Using a session cookie without `Max-Age`** — would lose the session on browser close (fails AUTH-02). better-auth default already sets `Max-Age`; do not override to `undefined`.
- **Putting the login page inside the `(app)` group** — creates an infinite redirect loop. Login lives in `(auth)`.
- **Running middleware-to-proxy codemod on a greenfield project** — the codemod only matters when upgrading. Write `proxy.ts` directly.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Your own bcrypt wrapper | better-auth's built-in (scrypt by default) | Built-in handles salt, pepper, timing-safe compare. [CITED: better-auth.com/docs/authentication/email-password] |
| Session cookie management | Custom `Set-Cookie` parsing + CSRF tokens | better-auth session cookies | httpOnly, Secure, SameSite, signed, rotated — all defaults. [CITED: better-auth.com/docs/concepts/session-management] |
| Rate limiting | `setInterval` counter in memory | better-auth's built-in rate limiter (`rateLimit.enabled: true`) | Per-endpoint defaults (sign-in is stricter). Can be disabled in dev, enabled in prod. [CITED: better-auth.com/docs/concepts/rate-limit] |
| Schema for user/session/account/verification | Write Drizzle tables by hand | `npx @better-auth/cli generate` | Adapter expects exact column names/types; generator guarantees match. [CITED: better-auth.com/docs/adapters/drizzle] |
| Route protection logic | Per-page `if (!session) redirect()` calls in every Server Component | `proxy.ts` + group-level `layout.tsx` session check | Two enforcement points: proxy for fast redirect, layout for authoritative server check. [CITED: nextjs.org/docs/app/api-reference/file-conventions/proxy] |
| CSRF protection for login POST | Custom CSRF token middleware | better-auth built-in (SameSite=Lax cookie + origin check on API routes) | Good-enough for internal tool; better-auth validates origin. [CITED: better-auth.com/docs/concepts/cookies] |
| Form validation | Ad-hoc `if (!email) ...` checks | Zod schema + shadcn `<Form>` + `react-hook-form` `zodResolver` | Same schema runs client + server. [CITED: CLAUDE.md — "Define validation schemas once, use on client and server"] |
| Toast container setup | Custom portal | shadcn `sonner` component — paste `<Toaster/>` once in root layout | Sonner handles stacking, dismiss, a11y. [CITED: UI-SPEC §Copywriting Contract] |

**Key insight:** better-auth is opinionated enough that the entire auth surface — hashing, sessions, cookies, CSRF, rate limiting, API routes — is provided. The phase reduces to (1) wiring the adapter, (2) writing the login form, (3) writing the protected layout, (4) writing `proxy.ts`, (5) writing the seed script. Any temptation to "just add a quick custom X" on top of better-auth should be rejected; fight the framework and you lose its guarantees.

---

## Authentication Details

### better-auth config shape (Phase 1)

```typescript
// lib/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db/client";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "sqlite" }),

  emailAndPassword: {
    enabled: true,
    disableSignUp: true,              // D-10: no self-service signup
    minPasswordLength: 12,            // D-14
    autoSignIn: false,                // not applicable — signup disabled
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30,     // D-11: 30 days
    updateAge:  60 * 60 * 24,         // refresh if older than 1 day (rolling)
  },

  rateLimit: {
    enabled: true,                    // D-15 — default OFF in dev, ON in prod; force ON
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 }, // D-15: 5/min (overrides 3/10s default)
    },
  },

  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
});

export type Session = typeof auth.$Infer.Session;
```

`[CITED: better-auth.com/docs/installation, better-auth.com/docs/concepts/session-management, better-auth.com/docs/concepts/rate-limit]`

### Session persistence across browser close — AUTH-02 proof

By default, better-auth sets the session cookie with `Max-Age = expiresIn` seconds. This produces a **persistent cookie**, not a session cookie — meaning the browser retains it after close and restores it on reopen until expiry. With `expiresIn: 60*60*24*30`, the cookie lives 30 days and AUTH-02 is satisfied without any extra configuration. `[CITED: better-auth.com/docs/concepts/session-management — "Sessions persist in cookies across browser closure by default."]`

The `updateAge` rolling-refresh mechanic: on any request older than `updateAge`, better-auth rewrites the session row's expiry and the cookie's Max-Age. Active users never see a re-login; idle 30+ days does force re-login.

### Rate-limit defaults — documentation vs. CONTEXT D-15

CONTEXT D-15 says "5/min default". The better-auth docs state the **documented default for sign-in is 3 requests per 10 seconds**, and the global production default is 100 req / 60 s. `[CITED: better-auth.com/docs/concepts/rate-limit — "Sign-in endpoint: Stricter limits of '3 requests within 10 seconds'"]`

**Resolution:** Honor CONTEXT D-15 literally — configure an explicit override to 5 per 60 seconds on `/sign-in/email`. This is what the customRules example above does. Flag this to the user: the stated "default" is not the actual better-auth default; we are setting it explicitly.

### Operator bootstrap — D-10 seed flow

No signup UI. One-time script at `scripts/seed-user.ts`:

```typescript
// scripts/seed-user.ts — run via `npx tsx scripts/seed-user.ts`
import { auth } from "../lib/auth";

const email = process.env.SEED_EMAIL;
const password = process.env.SEED_PASSWORD;
if (!email || !password) throw new Error("SEED_EMAIL and SEED_PASSWORD required");
if (password.length < 12) throw new Error("Password must be 12+ chars");

// Temporarily re-enable signups in the auth instance used by this script,
// or call the internal signUpEmail API (still works even with disableSignUp: true
// when called server-side via auth.api, per better-auth docs).
await auth.api.signUpEmail({
  body: { email, password, name: email }
});

console.log(`Seeded operator: ${email}`);
```

`[CITED: better-auth.com/docs/installation — "auth.api.signUpEmail({ email, password })"]`

**⚠ ASSUMED:** better-auth's `disableSignUp` option is documented to block the public `/sign-up/email` endpoint, but whether `auth.api.signUpEmail(...)` still succeeds server-side when that flag is set is not explicitly stated in the docs I fetched. Planner should verify during implementation: if blocked, the seed script can temporarily set `disableSignUp: false` via an env-guarded branch in `lib/auth.ts`, or delete+recreate the config in the script. `[ASSUMED]`

### Getting the session server-side

Three contexts, same API:

```typescript
// In Server Components / layouts / pages:
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const session = await auth.api.getSession({ headers: await headers() });
```

```typescript
// In proxy.ts (Next 16 Node runtime — required):
export const config = { runtime: "nodejs", matcher: [...] };
```

```typescript
// In Server Actions:
"use server";
const session = await auth.api.getSession({ headers: await headers() });
```

`[CITED: better-auth.com/docs/integrations/next]`

---

## Runtime State Inventory

**This is a greenfield phase — no prior runtime state exists.** The section is not applicable. No databases to migrate, no live services, no OS-registered state, no existing secrets, no build artifacts.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | None — SQLite file does not yet exist | First migration creates `data/angela.db` |
| Live service config | None | n/a |
| OS-registered state | None | n/a |
| Secrets/env vars | None existing — new `BETTER_AUTH_SECRET` and `DATABASE_URL` created this phase | Document in `.env.example` |
| Build artifacts | None — no `node_modules`, no `.next/`, no Drizzle output | `npm install` + `drizzle-kit generate` produce fresh artifacts |

---

## Common Pitfalls

### Pitfall P-01: `middleware.ts` was renamed to `proxy.ts` in Next.js 16

**What goes wrong:** Planner/executor creates `middleware.ts` at project root (per CONTEXT D-12 wording). On Next 16.2 this produces a deprecation warning at best; at worst the file is silently ignored in a future minor release. CONTEXT D-12 predates the rename or uses shorthand.

**Why it happens:** "Middleware" is universally used for this concept and every tutorial written before late 2025 calls it that. The rename is recent.

**How to avoid:**
- Create `proxy.ts` at project root. Export function named `proxy` (not `middleware`).
- Use the same `matcher` config syntax — unchanged.
- Do not install `@next/codemod` or run the codemod — this is greenfield, nothing to migrate.

**Warning signs:**
- A `middleware.ts` file exists in the repo.
- `npm run dev` prints a deprecation notice mentioning `proxy.ts`.

**Source:** `[CITED: nextjs.org/docs/app/api-reference/file-conventions/proxy — "The middleware file convention is deprecated and has been renamed to proxy."]` Version history: `v16.0.0 — Middleware is deprecated and renamed to Proxy`.

### Pitfall P-02: Trusting `proxy.ts` as the sole auth boundary

**What goes wrong:** `proxy.ts` redirects unauthenticated users to `/login`, so the developer assumes protected pages and Server Actions are safe. But proxy matchers can be misconfigured, Server Actions are POSTs to the page they live on (so matcher exclusions affect them invisibly), and Next's own docs explicitly warn against this pattern.

**Why it happens:** Single-layer thinking — "the gate redirects, therefore the gate protects."

**How to avoid:**
- In `app/(app)/layout.tsx`, call `auth.api.getSession(...)` and `redirect('/login')` if null. This is the authoritative check.
- Treat `proxy.ts` as a UX optimization (fast redirect, no flash of protected content), not a security boundary.
- In every future Server Action, first line: `const session = await auth.api.getSession(...); if (!session) throw new Error("unauthorized");`

**Warning signs:**
- A protected page renders (even briefly) for an unauthenticated user during dev.
- Server Actions log stack traces from unauthenticated callers.

**Source:** `[CITED: nextjs.org/docs/app/api-reference/file-conventions/proxy — "A matcher change or a refactor that moves a Server Function to a different route can silently remove Proxy coverage. Always verify authentication and authorization inside each Server Function rather than relying on Proxy alone."]`

### Pitfall P-03: better-sqlite3 native-build failure on first `npm install`

**What goes wrong:** `better-sqlite3` is a native module and compiles during install. On macOS Apple Silicon, `xcode-select --install` must have been run; on Linux, `python3`, `make`, and a C++ toolchain must exist. Missing toolchains produce cryptic `node-gyp` errors.

**Why it happens:** Node 22 LTS + better-sqlite3 12.9 ships prebuilt binaries for most platforms, but gaps exist.

**How to avoid:**
- Document the prerequisite in README: "Requires Node 22 and a C++ toolchain (Xcode CLT on macOS, `build-essential` on Debian/Ubuntu)."
- Verify first `npm install` succeeds on the actual deployment target (VPS) before shipping.

**Warning signs:**
- `npm install` output contains `gyp ERR!`.
- `require('better-sqlite3')` throws `ERR_DLOPEN_FAILED` at runtime.

**Source:** `[VERIFIED: npm better-sqlite3 README — "You need node-gyp prerequisites"]`

### Pitfall P-04: SQLite file path resolution in dev vs. prod

**What goes wrong:** `new Database("./data/angela.db")` resolves relative to `process.cwd()`. Under `next dev` that's the project root (works). Under `npm run build && npm start` inside a container, `cwd` may differ. Under tests it may be `__tests__/`. Each produces a different on-disk file; you lose data between runs.

**Why it happens:** Relative paths in Node are `cwd`-dependent.

**How to avoid:**
- Resolve via `path.resolve(process.cwd(), "data/angela.db")` and document that `cwd` must be project root.
- Or use an env var: `DATABASE_URL=./data/angela.db` (the default in `.env.local`), read once at module load.
- Add `data/` to `.gitignore` **and** create `data/.gitkeep` so the directory exists on clone (D-21).

**Warning signs:**
- Seed script creates a user; login claims "invalid credentials" because the app is reading a different .db.
- Multiple `angela.db` files exist in the repo.

**Source:** `[CITED: orm.drizzle.team/docs/get-started/sqlite-new — "url: process.env.DB_FILE_NAME!"]`

### Pitfall P-05: Forgetting `"use client"` on the login form

**What goes wrong:** The login form uses React state (input values, loading) and event handlers — this makes it a client component. If `"use client"` is missing, Next throws `Event handlers cannot be passed to Client Component props.` at build/render time.

**Why it happens:** All files in App Router default to server components.

**How to avoid:** First line of `app/(auth)/login/page.tsx` must be `"use client";`. Alternatively split into a server-component page that renders a `<LoginForm/>` client component — this is the cleaner pattern because it lets the page itself remain a Server Component (cheaper).

**Recommended structure:**
```
app/(auth)/login/
├── page.tsx          # Server Component — renders <LoginForm/>
└── login-form.tsx    # "use client" — handles state/submit
```

### Pitfall P-06: Drizzle schema drift from better-auth expectations

**What goes wrong:** Developer hand-writes `user`/`session`/`account`/`verification` tables based on a blog post, misses a column (e.g., `user.emailVerified` or `session.ipAddress`), and the adapter throws at runtime with `no such column`.

**Why it happens:** better-auth's expected schema evolves across minor versions and across plugins.

**How to avoid:** Always generate via `npx @better-auth/cli@latest generate --output db/schema.ts` after any change to `lib/auth.ts`. Never hand-edit the generated schema.

**Source:** `[CITED: better-auth.com/docs/adapters/drizzle — "The Better Auth CLI allows you to generate or migrate your database schema based on your Better Auth configuration and plugins."]`

### Pitfall P-07: shadcn/ui `init` overwriting `app/globals.css` and `tailwind.config.*`

**What goes wrong:** `npx shadcn@latest init` rewrites `globals.css` with its own @theme tokens and may create a `tailwind.config.ts` even though CONTEXT D-04 says no config file. Theme tokens from UI-SPEC (neutral palette, OKLCH values) then get lost.

**Why it happens:** shadcn assumes full control of theme tokens.

**How to avoid:**
- Run `shadcn init` **before** you write custom `@theme` tokens.
- After init, overlay the UI-SPEC palette (dominant `#FFFFFF`, secondary `#F5F5F5`, accent `#0F172A`, destructive `#DC2626`, muted text `#525252`, border `#E5E5E5`) as additional `@theme` values in `globals.css`.
- Choose `neutral` as the base-color at the init prompt — closest to the UI-SPEC palette.
- Tailwind v4 + shadcn v4 does not need `tailwind.config.ts`; if init creates one, delete it.

**Source:** `[CITED: ui.shadcn.com/docs/tailwind-v4]`

### Pitfall P-08: `proxy.ts` runtime defaults to Edge — but we need Node

**What goes wrong:** Calling `auth.api.getSession(...)` inside `proxy.ts` requires Node APIs (better-sqlite3 is a native module, cannot run on Edge). Without `export const config = { runtime: 'nodejs' }`, the proxy runs on Edge and fails.

**Why it happens:** Edge is the historical default for middleware/proxy.

**How to avoid:** Every `proxy.ts` that touches the database must declare `runtime: "nodejs"`. Next 15.5+ supports stable Node runtime for middleware/proxy.

**Alternative (recommended for Phase 1):** Don't hit the DB from proxy at all. Just check for *presence* of the session cookie (cheap, no DB call). The authoritative session check happens in `app/(app)/layout.tsx`. This keeps proxy fast and avoids the Edge/Node runtime question entirely.

```typescript
// proxy.ts — cookie presence only, no DB call
import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "better-auth.session_token"; // better-auth default cookie name

export function proxy(req: NextRequest) {
  const hasSession = req.cookies.has(SESSION_COOKIE);
  const isLoginPage = req.nextUrl.pathname.startsWith("/login");

  if (!hasSession && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (hasSession && isLoginPage) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

**Recommendation:** Use the cookie-presence pattern (no `runtime: 'nodejs'` needed). Combine with the authoritative layout-level session check.

**⚠ ASSUMED:** The exact cookie name `better-auth.session_token` is the documented default but may differ if `advanced.cookiePrefix` is set. Planner should verify by inspecting the Set-Cookie header of a real sign-in response during implementation. `[ASSUMED — cookie name not directly confirmed in fetched docs]`

### Pitfall P-09: Tailwind v4 `@theme` tokens not picked up

**What goes wrong:** Tailwind v4 requires the `@theme` block to live inside a `.css` file imported by the app (`app/globals.css` imported from `app/layout.tsx`). Putting it in a separate file that's not imported means utility classes render with default colors.

**How to avoid:** Keep `@theme { --color-primary: ...; }` inside `globals.css`. Do not create `tailwind.config.ts`.

**Source:** `[CITED: CLAUDE.md — "CSS-first configuration via @theme directives (no tailwind.config.js needed)"]`

### Pitfall P-10 (from existing research): German umlaut handling

Not strictly in Phase 1 scope (no PDF rendering yet), but the login UI, toasts, and "Willkommen" heading use `ö`, `ü`, `ß`. Ensure `app/layout.tsx` sets `<html lang="de">` and the default `<meta charset="utf-8">` stays. All source files saved as UTF-8. Test the rendered page shows `Anmelden`, `Passwort`, `Ungültig` correctly before moving on.

**Source:** `[CITED: .planning/research/PITFALLS.md §Pitfall 4 — PDF encoding errors apply later, but UI correctness applies now]`

---

## Code Examples

All examples are composed from official docs; minor adaptations marked. Planner should not treat as final — treat as scaffolding.

### CE-01: `db/client.ts`

```typescript
// db/client.ts
// Source: orm.drizzle.team/docs/get-started/sqlite-new (adapted — path resolution)
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "node:path";
import * as schema from "./schema";

const dbPath = path.resolve(
  process.cwd(),
  process.env.DATABASE_URL ?? "data/angela.db"
);

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");        // safer concurrent reads
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
```

### CE-02: `drizzle.config.ts`

```typescript
// drizzle.config.ts
// Source: orm.drizzle.team/docs/get-started/sqlite-new
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./db/schema.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "data/angela.db",
  },
});
```

### CE-03: `app/api/auth/[...all]/route.ts`

```typescript
// app/api/auth/[...all]/route.ts
// Source: better-auth.com/docs/integrations/next (verbatim)
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

### CE-04: `proxy.ts` (Next.js 16 replaces middleware.ts)

See Pitfall P-08 code block above. That is the production shape.

### CE-05: `app/(app)/layout.tsx` — authoritative gate

```typescript
// app/(app)/layout.tsx
// Source: better-auth.com/docs/integrations/next (adapted — redirect)
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen">
      <header className="h-16 border-b bg-neutral-100 flex items-center justify-between px-6">
        <span className="font-semibold text-sm">Angela</span>
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold">{session.user.email}</span>
          <LogoutButton />
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
```

### CE-06: login form with `authClient.signIn.email`

```typescript
// lib/auth-client.ts
// Source: better-auth.com/docs/basic-usage
import { createAuthClient } from "better-auth/react";
export const authClient = createAuthClient();
```

```typescript
// app/(auth)/login/login-form.tsx
"use client";
// Source: better-auth.com/docs/authentication/email-password (adapted — German copy per UI-SPEC)
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true); setError(null);
    const { error } = await authClient.signIn.email({ email, password });
    setPending(false);
    if (error) {
      if (error.status === 429) {
        setError("Zu viele Anmeldeversuche. Bitte warten Sie eine Minute.");
      } else if (error.status === 401 || error.status === 400) {
        setError("E-Mail oder Passwort ungültig.");
      } else {
        toast.error("Anmeldung fehlgeschlagen. Bitte erneut versuchen.");
      }
      return;
    }
    router.push("/");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* inputs, labels, button — shadcn Form + Button */}
    </form>
  );
}
```

### CE-07: logout button

```typescript
// components/logout-button.tsx
"use client";
// Source: better-auth.com/docs/basic-usage
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function LogoutButton() {
  const router = useRouter();
  async function onClick() {
    await authClient.signOut();
    toast.success("Sie wurden abgemeldet.");
    router.push("/login");
  }
  return <button onClick={onClick}>Abmelden</button>; // wrap in shadcn Button ghost variant
}
```

### CE-08: `.env.example`

```bash
# .env.example — commit this, never commit .env.local
DATABASE_URL=data/angela.db
BETTER_AUTH_SECRET=replace-with-output-of-openssl-rand-base64-32
BETTER_AUTH_URL=http://localhost:3000
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` in Next.js ≤15 | `proxy.ts` in Next.js 16 | Next 16.0.0 (late 2025) | File rename only — same location, exports, semantics. [CITED: nextjs.org/docs version history] |
| NextAuth / Auth.js v5 Credentials provider | better-auth `emailAndPassword` | Auth.js team joined better-auth Sep 2025 | better-auth is the recommended choice; Auth.js v5 remains beta. [CITED: CLAUDE.md sources] |
| Edge runtime for middleware | Stable Node.js runtime | Next 15.5.0 | Proxy can now use Node APIs (better-sqlite3, crypto). Opt-in via `runtime: "nodejs"`. We won't need it for Phase 1 (cookie-presence pattern). [CITED: nextjs.org/docs/app/api-reference/file-conventions/proxy version history] |
| `tailwind.config.ts` + `@tailwind` directives | `@theme` in `globals.css` | Tailwind v4 (2024) | CSS-first config. No JS config file. [CITED: CLAUDE.md] |
| Prisma + SQLite | Drizzle + better-sqlite3 | Industry shift 2023–2025 | Drizzle is the Next.js-ecosystem standard for SQLite. [CITED: CLAUDE.md] |

**Deprecated / do not use:**
- `middleware.ts` filename (use `proxy.ts`)
- `@tailwind base/components/utilities` directives (use `@import "tailwindcss"` in v4)
- `drizzle-kit push` for this project — use `generate` + `migrate` so migrations are committed
- Auth.js / NextAuth Credentials provider
- NextAuth v5 beta for new projects

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Next.js, all tooling | ✓ | 22.20.0 (meets D-22 minimum Node 22) | — |
| npm | package management | ✓ | 10.9.3 | pnpm/yarn would work but unnecessary |
| C++ toolchain | better-sqlite3 native build | Assumed ✓ on macOS dev (Xcode CLT typically installed) | — | Prebuilt binary on npm usually works; if not, `xcode-select --install` |
| sqlite3 CLI | Debugging DB, not required | ✓ | 3.51.0 (2025-06-12) | Drizzle Studio replaces it for GUI inspection |
| git | Source control | Assumed ✓ (repo already exists per session init) | — | — |
| Docker | Deployment target (D-06) | Not checked (not needed for Phase 1 dev loop) | — | Deferred per CONTEXT "Docker / CI setup — separate infrastructure phase later" |
| OpenSSL | Generate BETTER_AUTH_SECRET | Bundled with macOS/Linux | — | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |

**Missing dependencies with no fallback:** None for Phase 1 development loop.

**Missing dependencies with fallback:** None blocking.

**Environment looks clean.** Node 22.20.0 is fresh enough for Next 16 and all listed packages.

---

## Project Constraints (from CLAUDE.md)

Directives that must be honored by the plan:

1. **GSD Workflow Enforcement** — all file changes must go through a GSD command (we are inside `/gsd-research-phase` or `/gsd-plan-phase`; planner will follow with `/gsd-execute-phase`). No direct edits outside GSD.
2. **Stack versions are locked** — planner must not substitute a different ORM, auth lib, or framework. Minor patch-level drift is allowed (e.g., better-auth 1.6.5 vs 1.6.4).
3. **Vercel is rejected** — the plan must not assume Vercel-only primitives (Blob storage, Edge-only APIs). Target VPS with persistent filesystem.
4. **No hand-rolled solutions for problems a library solves** — see §Don't Hand-Roll table.
5. **German UI** — all user-facing strings in Phase 1 are German per UI-SPEC. No i18n toggle in Phase 1 (UI-SPEC locks German only; i18n would be a new scope item).
6. **Single-user tool** — do not add multi-tenancy, roles, or user-mgmt UI.
7. **`data/` directory** — gitignored; holds both SQLite DB and (later) uploaded PDFs.

---

## i18n Scope Decision (Claude's Discretion — Phase 1)

**Question raised by the researcher:** Does Phase 1 need a German/English language toggle?

**Answer:** No. UI-SPEC §Copywriting Contract locks German strings verbatim. CONTEXT D-16 says "German-language UI". PROJECT.md says "App UI can be German or English" — the word *can* permits either, and the locked choice is German. Introducing an i18n library (next-intl, next-i18next) now would:
- Add ~30KB bundle + a locale-routing decision (subpath vs cookie vs domain)
- Pre-commit to a structure for strings that may never be used (v1 is German)
- Violate the "resist over-engineering" specific in CONTEXT

**Recommendation:** Hard-code German strings. If v2 requires English, a single sweep to next-intl costs < 1 day when the surface is 3 screens. Do it then.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | **Vitest 1.x** (recommended — no tests exist yet; choose now) |
| Rationale | Vitest integrates cleanly with Next.js 16 via `vite-plugin-next` or stand-alone. Faster cold start than Jest. Native ESM and TS. No create-next-app coupling. Alternative: Playwright for e2e. |
| Config file | `vitest.config.ts` (to create in Wave 0) |
| Quick run command | `npx vitest run __tests__/<file> --reporter=basic` |
| Full suite command | `npx vitest run` |

**⚠ ASSUMED:** Choice of Vitest is a recommendation, not a locked decision — CONTEXT marks test directory as Claude's discretion. If the user prefers Jest/Node test runner, the planner may substitute. Vitest is the 2026 default for new TS projects. `[ASSUMED]`

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Valid email+password signs in and redirects to `/` | integration | `npx vitest run __tests__/auth/sign-in.test.ts` | ❌ Wave 0 |
| AUTH-01 | Invalid credentials produce 401 with "E-Mail oder Passwort ungültig." | integration | `npx vitest run __tests__/auth/sign-in.test.ts::invalid-credentials` | ❌ Wave 0 |
| AUTH-01 | Password < 12 chars rejected (seed script guard) | unit | `npx vitest run __tests__/seed/seed-user.test.ts` | ❌ Wave 0 |
| AUTH-02 | Session cookie has Max-Age (persistent, not session cookie) | integration | `npx vitest run __tests__/auth/session-cookie.test.ts` | ❌ Wave 0 |
| AUTH-02 | `getSession` returns the same user across a simulated "browser restart" (new request with existing cookie) | integration | `npx vitest run __tests__/auth/session-persist.test.ts` | ❌ Wave 0 |
| AUTH-03 | POST `/api/auth/sign-out` clears cookie | integration | `npx vitest run __tests__/auth/sign-out.test.ts` | ❌ Wave 0 |
| AUTH-03 | After logout, `getSession` returns null and protected layout redirects | integration | `npx vitest run __tests__/auth/post-logout-redirect.test.ts` | ❌ Wave 0 |
| gate | Unauthenticated request to `/` is redirected to `/login` by proxy | integration | `npx vitest run __tests__/proxy/redirect.test.ts` | ❌ Wave 0 |
| gate | Authenticated request to `/login` is redirected to `/` | integration | `npx vitest run __tests__/proxy/authed-login-redirect.test.ts` | ❌ Wave 0 |
| ui | Login page renders all UI-SPEC copy exactly (snapshot) | unit | `npx vitest run __tests__/ui/login-copy.test.tsx` | ❌ Wave 0 |
| rate-limit | 6th sign-in attempt within 60s returns 429 | integration (slow — can be skipped in quick loop) | `npx vitest run __tests__/auth/rate-limit.test.ts` | ❌ Wave 0 |
| manual | Browser close & reopen preserves session (human loop) | manual-only | — | n/a |

Justification for manual-only entry: simulating a real browser close/reopen is not reliably automatable without a browser-driver setup (Playwright). Covered in human verification step before phase sign-off. The automated AUTH-02 tests above verify the mechanism (Max-Age) that produces the behavior.

### Sampling Rate

- **Per task commit:** `npx vitest run __tests__/<touched-area> --reporter=basic`
- **Per wave merge:** `npx vitest run` (full suite) — must be green
- **Phase gate:** full suite green + manual browser close/reopen check performed before `/gsd-verify-work`

### Wave 0 Gaps

All test infrastructure is missing. Wave 0 must create:

- [ ] Install Vitest: `npm install -D vitest @vitest/ui happy-dom @testing-library/react @testing-library/jest-dom`
- [ ] `vitest.config.ts` at project root with `happy-dom` environment and `@testing-library/jest-dom` setup
- [ ] `__tests__/` directory with subfolders: `auth/`, `proxy/`, `seed/`, `ui/`
- [ ] Shared fixture `__tests__/_fixtures/test-db.ts` — creates a fresh in-memory or tmpfile SQLite, runs migrations, seeds a known operator user, exposes cleanup
- [ ] Shared fixture `__tests__/_fixtures/auth-helpers.ts` — utilities for asserting cookie shape, building authenticated request headers
- [ ] `package.json` script: `"test": "vitest"`, `"test:run": "vitest run"`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | better-auth emailAndPassword (scrypt hash, constant-time compare); minPasswordLength 12 (D-14) |
| V3 Session Management | yes | better-auth session (httpOnly, Secure in prod, SameSite=Lax cookie; server-side session row; rotates on auth events) |
| V4 Access Control | yes | Proxy cookie-presence check + layout-level `auth.api.getSession` (defense in depth) |
| V5 Input Validation | yes | Zod schema on login form; `z.string().email()` and `z.string().min(12)` |
| V6 Cryptography | yes | Never hand-roll hashing; BETTER_AUTH_SECRET ≥ 32 bytes from `openssl rand -base64 32` |
| V7 Error Handling & Logging | yes | Inline UI errors do not leak whether email exists ("E-Mail oder Passwort ungültig." covers both cases — per D-18) |
| V8 Data Protection | partial | SQLite DB is unencrypted at rest in Phase 1. Documents not handled yet (Phase 2+). Consider SQLCipher in a later infrastructure phase. [Deferred — not in Phase 1 scope per CONTEXT] |
| V11 Business Logic | yes | disableSignUp prevents unauthorized account creation; rate limiting on /sign-in/email |
| V12 Files & Resources | not yet | No uploads in Phase 1 |
| V14 Configuration | yes | `.env.local` gitignored (D-20); `.env.example` template; secrets not logged |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Credential stuffing | Spoofing | better-auth rate limiting on `/sign-in/email` (5/min per D-15) |
| Session fixation | Spoofing | better-auth rotates session on login (server-side session row + signed cookie) |
| CSRF on login/logout POST | Tampering | SameSite=Lax cookie + origin check (better-auth default) |
| XSS stealing session cookie | Info Disclosure | httpOnly cookie; Tailwind escapes text content; React auto-escapes `{email}` in header |
| Timing attack on password compare | Info Disclosure | scrypt (constant-time compare) — never `===` on hashes |
| Env secret leak | Info Disclosure | `.env.local` gitignored; BETTER_AUTH_SECRET never shipped to client (server-only import) |
| Open redirect on post-login | Tampering | Login redirects to hard-coded `/`, not a user-supplied `?returnTo=` param in Phase 1 |
| Brute force on password | Spoofing | minPasswordLength 12 + rate limit + scrypt cost factor |
| SQL injection | Tampering | Drizzle is parameterized — no raw SQL in Phase 1 |
| Log injection / PII in logs | Info Disclosure | Do not log raw request bodies; log only `{ endpoint, status, userId? }` |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `auth.api.signUpEmail(...)` works server-side even when `emailAndPassword.disableSignUp: true` is set | Authentication Details (seed flow) | If it doesn't, the seed script must toggle `disableSignUp: false` at runtime or set via env — trivial workaround. Planner should verify during first seed-script test. |
| A2 | better-auth session cookie is named `better-auth.session_token` by default | P-08 (cookie-presence proxy) | If the actual name differs or is configurable, proxy logic must read it from config. Verify by inspecting `Set-Cookie` on a real sign-in response. |
| A3 | Vitest is the right test framework (CONTEXT marks test layout as discretion; framework unspecified) | Validation Architecture | If user prefers Jest or Node's built-in test runner, planner substitutes. No impact on phase correctness. |
| A4 | Proxy cookie-presence check is sufficient UX-level protection without `runtime: 'nodejs'` | P-08 | If the cookie name or presence semantics differ, worst case is a brief flash of /login before the layout redirect kicks in. Still functionally safe (layout is authoritative). |
| A5 | Tailwind v4 + shadcn CLI v4 work cleanly together on a fresh Next 16.2 scaffold with zero friction | P-07 | If CLI mis-configures base-color or emits a `tailwind.config.ts`, fix during init step (5-minute detour). |
| A6 | create-next-app 16.2.4 accepts the exact flag combination shown in §Installation | Installation | If flags have changed, `create-next-app --help` resolves immediately. |
| A7 | `proxy.ts` naming is enforced in Next 16.2.4 (not just documented) | P-01 | If both `middleware.ts` and `proxy.ts` still work as of 16.2.4, using `proxy.ts` is still correct per docs. No downside. |

**Any table row flagged above warrants a quick verification step during the first Wave of execution.** None of them block planning.

---

## Open Questions

1. **i18n scope for Phase 1+.** Decided: German only in Phase 1 (see §i18n Scope Decision). Revisit if a real English-speaking user appears.
2. **Seed script UX.** `scripts/seed-user.ts` reads `SEED_EMAIL` / `SEED_PASSWORD` from env. Alternative: prompt interactively via `readline`. Env is simpler for ops; prompt is safer (no shell history). Recommendation: env with a README note to clear shell history (`history -c`) or use `export SEED_PASSWORD='...'; node ...; unset SEED_PASSWORD`. Planner choice.
3. **Drizzle Studio in dev.** Add `"db:studio": "drizzle-kit studio"` to `package.json` scripts? Zero cost, useful for inspecting users/sessions during debugging. Recommendation: yes.
4. **PRAGMA tuning.** `journal_mode = WAL` and `foreign_keys = ON` are included in CE-01. Worth benchmarking `synchronous = NORMAL` for dev, `synchronous = FULL` for prod? Not needed for Phase 1 single-user workload. Defer.
5. **Favicon and metadata.** Next 16 generates a default favicon. Replace with Angela branding? Discretion — skip unless trivial.

---

## Sources

### Primary (HIGH confidence)
- [Next.js 16 Proxy docs](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) — verified version 16.2.4, last updated 2026-04-15. Confirms middleware→proxy rename, matcher syntax, Node runtime stability.
- [better-auth — Drizzle Adapter](https://www.better-auth.com/docs/adapters/drizzle) — CLI generate flow, provider config, schema mapping.
- [better-auth — Next.js Integration](https://www.better-auth.com/docs/integrations/next) — catch-all route, getSession pattern, middleware example.
- [better-auth — Session Management](https://www.better-auth.com/docs/concepts/session-management) — default 7-day expiry, rolling updateAge, cookie persistence across browser close.
- [better-auth — Rate Limit](https://www.better-auth.com/docs/concepts/rate-limit) — sign-in default 3/10s, production default 100/60s, customRules shape.
- [better-auth — Installation](https://www.better-auth.com/docs/installation) — env vars, minPasswordLength, signUp.disabled, signUpEmail API.
- [Drizzle SQLite quick-start](https://orm.drizzle.team/docs/get-started/sqlite-new) — drizzle.config.ts, connection setup, generate+migrate flow.
- `npm view` (live 2026-04-17) — verified versions for next, better-auth, drizzle-orm, drizzle-kit, better-sqlite3, zod.
- [.planning/research/STACK.md](../../../.planning/research/STACK.md) — project stack rationale.
- [.planning/research/ARCHITECTURE.md](../../../.planning/research/ARCHITECTURE.md) — App Router structure, Server Actions pattern, Drizzle integration.
- [.planning/research/PITFALLS.md](../../../.planning/research/PITFALLS.md) — domain pitfalls (relevant: encoding handling).
- [CLAUDE.md](../../../CLAUDE.md) — project constraints, stack lock, what-not-to-use list.
- [01-CONTEXT.md](./01-CONTEXT.md) — locked decisions D-01 through D-22.
- [01-UI-SPEC.md](./01-UI-SPEC.md) — UI copywriting contract, spacing, color, interactions.

### Secondary (MEDIUM confidence)
- shadcn/ui CLI v4 install flow — inferred from CLAUDE.md cited changelog; not re-fetched during this research. Low risk of drift.
- Vitest as default test framework recommendation — general 2026 ecosystem knowledge, not cited against a specific current doc.

### Tertiary (LOW confidence)
- Exact better-auth cookie name `better-auth.session_token` — inferred; verify at implementation time (Assumption A2).
- `auth.api.signUpEmail` vs `disableSignUp` interaction — not explicitly documented (Assumption A1).

---

## Metadata

**Confidence breakdown:**
- Standard stack & versions: HIGH — all versions verified live against npm registry on 2026-04-17.
- Architecture patterns: HIGH — sourced from official better-auth and Next.js docs; UI structure from UI-SPEC.
- better-auth specifics: HIGH for config shape, MEDIUM for exact default cookie name and `disableSignUp` semantics (flagged as assumptions A1, A2).
- Next.js 16 proxy rename: HIGH — confirmed via official docs fetched today.
- Validation architecture: MEDIUM — framework choice is a recommendation, not mandated by CONTEXT.

**Research date:** 2026-04-17
**Valid until:** 2026-05-17 (30 days — stack is stable). If phase execution slips past May 2026, re-verify `next`, `better-auth`, and `drizzle-orm` versions.
