---
phase: 01-foundation-authentication
plan: 03
subsystem: authentication
tags: [better-auth, drizzle-adapter, sqlite, nextjs-proxy, session-cookie]
dependency_graph:
  requires:
    - next_16_app_router
    - drizzle_client
  provides:
    - better_auth_server_instance
    - better_auth_client_sdk
    - auth_api_catch_all_route
    - proxy_ts_gate
    - sqlite_tables_user_session_account_verification
  affects:
    - 01-04-PLAN (login form + protected layout + logout)
    - 01-05-PLAN (seed-user script — consumes auth.api.signUpEmail)
    - all_future_phases (every protected route inherits the proxy + layout gate)
tech_stack:
  added:
    - better-auth@1.6.5
    - zod@4.3.6 (pinned exact from ^4.3.6)
  patterns:
    - drizzle_adapter_sqlite
    - email_password_disable_signup
    - 30_day_rolling_session
    - signin_rate_limit_5_per_minute
    - nextjs_16_catch_all_auth_handler
    - proxy_ts_cookie_presence_gate
key_files:
  created:
    - lib/auth.ts
    - lib/auth-client.ts
    - app/api/auth/[...all]/route.ts
    - proxy.ts
    - drizzle/0000_blushing_santa_claus.sql
    - drizzle/meta/_journal.json
    - drizzle/meta/0000_snapshot.json
  modified:
    - package.json
    - package-lock.json
    - db/schema.ts
decisions:
  - "Use cookie-presence pattern in proxy.ts (no DB call) — avoids Edge-vs-Node runtime decision per P-08. Authoritative session check lives in app/(app)/layout.tsx (Plan 04)."
  - "Honor CONTEXT D-15 literally — explicit customRules override sets 5/min on /sign-in/email. better-auth's documented default is 3/10s, so this is stricter than default but exactly what D-15 mandates."
  - "Use drizzle-kit push --force to materialize data/angela.db (per phase instruction) — but commit the drizzle-kit generate output (drizzle/0000_*.sql + drizzle/meta/*) so migrations are source-controlled for VPS deployment (D-06)."
  - "Pin zod@4.3.6 exact (strip caret). Matches better-sqlite3/drizzle pinning convention for reproducible builds."
  - "BETTER_AUTH_SECRET is validated at module load time in lib/auth.ts (throw) rather than at request time — fail fast, never boot without it."
metrics:
  duration_minutes: 7
  tasks_completed: 3
  files_created: 7
  files_modified: 3
  commits: 3
  completed_at: "2026-04-16T22:44:20Z"
---

# Phase 01 Plan 03: Better-Auth Configuration Summary

One-liner: Configured better-auth 1.6.5 with Drizzle SQLite adapter (disableSignUp, minPasswordLength 12, 30-day rolling session, 5/min sign-in rate limit), generated the user/session/account/verification schema via `@better-auth/cli`, pushed tables into `data/angela.db`, mounted the catch-all API at `/api/auth/*`, and added a cookie-presence `proxy.ts` gate that redirects unauthenticated requests to `/login`.

## What Was Built

### Task 1: better-auth + zod install, lib/auth.ts + lib/auth-client.ts

Commit: `017307d` — `feat(01-03): install better-auth and add auth server + client modules`

- `npm install --save-exact better-auth@1.6.5 zod@4.3.6`
  - `better-auth` added: `1.6.5` (newly installed)
  - `zod` re-pinned from `^4.3.6` → exact `4.3.6`
  - 20 transitive packages added; 5 moderate dev-chain audit warnings (inherited from existing drizzle-kit tree — not a blocker per Plan 02 notes)
- Wrote `lib/auth.ts` per RESEARCH §Authentication Details (verbatim):

  ```typescript
  // lib/auth.ts — secret value redacted, pulled from process.env.BETTER_AUTH_SECRET
  import { betterAuth } from "better-auth";
  import { drizzleAdapter } from "better-auth/adapters/drizzle";
  import { db } from "@/db/client";

  if (!process.env.BETTER_AUTH_SECRET) {
    throw new Error(
      "BETTER_AUTH_SECRET is required. Generate with: " +
        "node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
    );
  }

  export const auth = betterAuth({
    database: drizzleAdapter(db, { provider: "sqlite" }),

    emailAndPassword: {
      enabled: true,              // D-08
      disableSignUp: true,        // D-10
      minPasswordLength: 12,      // D-14
      autoSignIn: false,
    },

    session: {
      expiresIn: 60 * 60 * 24 * 30,  // D-11: 30 days
      updateAge:  60 * 60 * 24,      // rolling: refresh if older than 1 day
    },

    rateLimit: {
      enabled: true,              // D-15 — force on (default is prod-only)
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 }, // D-15: 5/min override
      },
    },

    secret: process.env.BETTER_AUTH_SECRET!,   // ← real value in .env.local (redacted here)
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  });

  export type Session = typeof auth.$Infer.Session;
  ```

- Wrote `lib/auth-client.ts` per RESEARCH CE-06:

  ```typescript
  import { createAuthClient } from "better-auth/react";
  export const authClient = createAuthClient();
  ```

### Task 2: Schema generation + migration + push to SQLite  [BLOCKING]

Commit: `96638a1` — `feat(01-03): generate better-auth schema and push SQLite tables`

Three CLI operations, all succeeded first try:

1. `npx @better-auth/cli@latest generate --output db/schema.ts --yes`
   - CLI resolved `@better-auth/cli@1.4.21` (companion CLI for better-auth 1.6.x)
   - Emitted 108 lines of Drizzle schema to `db/schema.ts`, overwriting the Plan 02 placeholder
   - Output: `🚀 Schema was overwritten successfully!`
2. `npx drizzle-kit generate`
   - Read db/schema.ts → wrote `drizzle/0000_blushing_santa_claus.sql`
   - Summary printed: `4 tables / account 13 columns 1 index 1 fk / session 8 columns 2 indexes 1 fk / user 7 columns 1 index 0 fks / verification 6 columns 1 index 0 fks`
3. `npx drizzle-kit push --force`
   - Applied the schema directly to `data/angela.db` (file created fresh — 57344 bytes)
   - Output: `[✓] Pulling schema from database... [✓] Changes applied`

**Tables created in `data/angela.db`** (verified via `sqlite_master` query):

| Name | Columns | FK | Indexes |
|------|---------|----|---------|
| `account` | 13 | → user.id (cascade) | `account_userId_idx` |
| `session` | 8 | → user.id (cascade) | `session_userId_idx` |
| `user` | 7 | — | unique(`email`) |
| `verification` | 6 | — | `verification_identifier_idx` |

**Migration files emitted to `drizzle/`:**

- `drizzle/0000_blushing_santa_claus.sql` (committed)
- `drizzle/meta/_journal.json` (committed)
- `drizzle/meta/0000_snapshot.json` (committed)

The `data/angela.db` file itself is correctly gitignored (per Plan 01 .gitignore rules), as are the WAL sidecar files (`angela.db-wal`, `angela.db-shm`).

### Task 3: /api/auth/[...all] route + proxy.ts gate

Commit: `114945d` — `feat(01-03): mount better-auth catch-all API and add proxy gate`

- `app/api/auth/[...all]/route.ts` (4 lines):

  ```typescript
  import { auth } from "@/lib/auth";
  import { toNextJsHandler } from "better-auth/next-js";

  export const { GET, POST } = toNextJsHandler(auth);
  ```

- `proxy.ts` at repo root (NOT middleware.ts — per P-01 rename in Next 16):

  ```typescript
  import { type NextRequest, NextResponse } from "next/server";

  const SESSION_COOKIE = "better-auth.session_token";

  export function proxy(req: NextRequest) {
    const hasSession = req.cookies.has(SESSION_COOKIE);
    const { pathname } = req.nextUrl;
    const isLoginPage = pathname.startsWith("/login");
    if (!hasSession && !isLoginPage) return NextResponse.redirect(new URL("/login", req.url));
    if (hasSession && isLoginPage)   return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }

  export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
  };
  ```

Key invariants verified:
- Function is named `proxy` (not `middleware`) — P-01
- File is `proxy.ts` — no `middleware.ts` exists at repo root (`test ! -f middleware.ts` passes)
- No `runtime: "nodejs"` declaration needed — cookie presence only, no DB call — P-08
- Matcher excludes `api`, `_next/static`, `_next/image`, `favicon.ico`
- Authoritative session check deferred to Plan 04's `app/(app)/layout.tsx` — defense in depth per P-02

## Deviations from Plan

None — plan executed exactly as written.

No Rule 1 (bugs), Rule 2 (missing critical functionality), or Rule 3 (blocking issues) triggered. No Rule 4 architectural decisions required. The plan's written-out EXACT contents for each file matched what was produced verbatim; only transparent substitutions happened (e.g., `@better-auth/cli@latest` resolved to `@1.4.21` at install time, which is the documented current CLI version for better-auth 1.6.x).

## Authentication Gates

None. Plan 03 required no external authentication — all operations were local (`npm install`, Drizzle CLI generation against a file-based SQLite, local dev-server probe).

## `npx tsc --noEmit` Clean: Confirmed

Final run after all three commits: `npx tsc --noEmit` exited 0 with no output. The entire project compiles — including the new `lib/auth.ts`, `lib/auth-client.ts`, generated `db/schema.ts`, `app/api/auth/[...all]/route.ts`, and `proxy.ts`. No type errors introduced.

## Runtime Smoke Test

Started `npm run dev` (Next 16.2.4 / Turbopack, ready in 272 ms), then probed the auth surface:

- `GET /api/auth/get-session` → `200 OK`, body `null` (no session cookie → handler works, returns null session)
- `POST /api/auth/sign-up/email` (with valid email+12-char-password payload) → `400 BAD_REQUEST`, body `{"message":"Email and password sign up is not enabled","code":"EMAIL_PASSWORD_SIGN_UP_DISABLED"}`

This confirms the catch-all route is live, the auth instance boots, and `disableSignUp: true` is enforced on the public endpoint (T-03-02 mitigation verified end-to-end).

The existing Vitest smoke test (`__tests__/ui/smoke.test.tsx`) still passes:
```
✓ __tests__/ui/smoke.test.tsx (1 test) 24ms
Test Files  1 passed (1)  Tests  1 passed (1)
```

## Environment Variable Wiring

Verified from `.env.example` (committed template) and `.env.local` (gitignored, populated in Plan 01):

```bash
# .env.example
DATABASE_URL=data/angela.db
BETTER_AUTH_SECRET=replace-with-output-of-openssl-rand-base64-32
BETTER_AUTH_URL=http://localhost:3000
```

`.env.local` has a real 32-byte base64 `BETTER_AUTH_SECRET` generated in Plan 01; `lib/auth.ts` throws at load time if it is missing.

## Assumption Verification Notes

- **A1 — `auth.api.signUpEmail()` server-side works when `disableSignUp: true`:**
  *Partially verified.* The public `POST /api/auth/sign-up/email` endpoint correctly returns `400 EMAIL_PASSWORD_SIGN_UP_DISABLED` (confirmed via curl against dev server). Whether the internal `auth.api.signUpEmail(...)` call (from a server-side seed script) is subject to the same guard is **not yet confirmed** — Plan 05 will test this. If blocked, the seed script can toggle `disableSignUp: false` via env or call the DB directly via Drizzle. Flagged for Plan 05.

- **A2 — better-auth session cookie is named `better-auth.session_token`:**
  *Not verified.* Could not trigger a successful sign-in (no user exists yet) to inspect `Set-Cookie`. Deferred to Plan 04 — when the login form successfully creates a session, manually inspect the response cookie and confirm the name. If it differs, update the constant in `proxy.ts`. Worst-case failure mode is a brief flash of `/login` before the authoritative layout redirect kicks in (still functionally safe, UX-only regression).

## Known Stubs

None introduced. `db/schema.ts` — the intentional placeholder flagged in Plan 02 — has now been fully replaced by the CLI-generated schema (4 real tables). No other placeholders added in this plan.

## Threat Flags

None. All security-relevant surfaces introduced in this plan map to mitigations in the plan's `<threat_model>`:

- Public `/api/auth/sign-up/email` — blocked by `disableSignUp: true` (T-03-02, verified via curl)
- `/api/auth/sign-in/email` — rate-limited to 5/60s via `customRules` (T-03-01)
- `/api/auth/sign-out` — will be gated by session cookie; verified in Plan 04
- `proxy.ts` — UX-level gate only, not authoritative (T-03-07 — authoritative layer check is Plan 04)
- `BETTER_AUTH_SECRET` — fail-fast throw at module load; never imported into client files (T-03-06)
- `drizzleAdapter` → parameterized Drizzle queries (T-03-09)

No new network endpoints, file-access patterns, or schema changes beyond what the threat model enumerated.

## Requirements Completed

- `AUTH-01` (login) — auth infrastructure is in place; endpoint `POST /api/auth/sign-in/email` is live and rate-limited. UI form lands in Plan 04.
- `AUTH-02` (persistent session via cookie Max-Age) — `session.expiresIn: 2592000` (30 days) configures better-auth to set `Max-Age` on the session cookie. Mechanism in place; browser-restart test covered in Plan 04 manual verification.
- `AUTH-03` (logout) — endpoint `POST /api/auth/sign-out` is mounted by the catch-all route. UI wiring lands in Plan 04.

## Self-Check: PASSED

Files verified present:
- FOUND: `lib/auth.ts`
- FOUND: `lib/auth-client.ts`
- FOUND: `db/schema.ts` (now CLI-generated, not placeholder — grep'd `export const user`, `session`, `account`, `verification`)
- FOUND: `app/api/auth/[...all]/route.ts`
- FOUND: `proxy.ts`
- FOUND: `drizzle/0000_blushing_santa_claus.sql`
- FOUND: `drizzle/meta/_journal.json`
- FOUND: `drizzle/meta/0000_snapshot.json`
- FOUND: `data/angela.db` (57344 bytes, gitignored — contains 4 required tables)
- NOT FOUND (correct): `middleware.ts`

Commits verified:
- FOUND: `017307d` (feat(01-03): install better-auth and add auth server + client modules)
- FOUND: `96638a1` (feat(01-03): generate better-auth schema and push SQLite tables)
- FOUND: `114945d` (feat(01-03): mount better-auth catch-all API and add proxy gate)

Runtime verification:
- FOUND: `npx tsc --noEmit` exits 0 with no output (clean compile)
- FOUND: `GET /api/auth/get-session` returns 200 + `null` body (handler mounted and working)
- FOUND: `POST /api/auth/sign-up/email` returns 400 `EMAIL_PASSWORD_SIGN_UP_DISABLED` (disableSignUp enforced)
- FOUND: Existing Vitest smoke test still green (1 passed)
