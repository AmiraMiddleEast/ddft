---
phase: 01-foundation-authentication
reviewed: 2026-04-17T00:00:00Z
depth: standard
files_reviewed: 29
files_reviewed_list:
  - app/(app)/layout.tsx
  - app/(app)/page.tsx
  - app/(auth)/login/login-form.tsx
  - app/(auth)/login/page.tsx
  - app/api/auth/[...all]/route.ts
  - app/globals.css
  - app/layout.tsx
  - components/logout-button.tsx
  - db/client.ts
  - db/schema.ts
  - drizzle.config.ts
  - lib/auth-client.ts
  - lib/auth.ts
  - lib/utils.ts
  - lib/validations/auth.ts
  - proxy.ts
  - scripts/seed-user.ts
  - __tests__/_fixtures/auth-helpers.ts
  - __tests__/_fixtures/test-db.ts
  - __tests__/auth/login-validation.test.ts
  - __tests__/auth/session-cookie.test.ts
  - __tests__/auth/sign-in.test.ts
  - __tests__/auth/sign-out.test.ts
  - __tests__/proxy/redirect.test.ts
  - __tests__/seed/seed-user.test.ts
  - __tests__/ui/login-copy.test.tsx
  - __tests__/ui/home-copy.test.tsx
  - __tests__/setup.ts
  - next.config.ts
  - tsconfig.json
  - vitest.config.ts
findings:
  critical: 2
  warning: 3
  info: 3
  total: 8
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-04-17T00:00:00Z
**Depth:** standard
**Files Reviewed:** 29
**Status:** issues_found

## Summary

This phase establishes the authentication foundation: better-auth with Drizzle/SQLite, a cookie-presence proxy gate, server-side session validation in the app layout, and the operator seed script. The overall structure is sound — the auth configuration is conservative, the server-side guard in `app/(app)/layout.tsx` is correct, password hashing is delegated to better-auth (bcrypt by default), and the seed script does not log credentials.

Two critical issues were found. The most serious is that the proxy guard (`proxy.ts`) is completely dead code: Next.js requires a file named `middleware.ts` at the project root; no such file exists, so every route in the application is publicly accessible regardless of session state. The second critical issue is that the `ALLOW_SIGNUP` env-var bypass is readable from the client bundle in certain import paths, and — more importantly — there is no validation that `ALLOW_SIGNUP` is absent in production, making the "production default is disabled" comment a policy-only control with no enforcement. Three warnings cover a stale fallback error message in the seed script, test module-cache pollution risk, and an unresolved vitest environment mismatch that could cause the DB-dependent tests to fail silently.

---

## Critical Issues

### CR-01: `proxy.ts` is never executed — the auth gate does not protect any route

**File:** `proxy.ts:1`

**Issue:** Next.js middleware must live in a file named `middleware.ts` (or `middleware.js`) at the project root (or `src/` root). The file in this repository is named `proxy.ts`. Next.js never loads it, so the redirect-to-login logic on lines 8–24 and the route matcher on lines 26–29 are completely inert. Every application route (`/`, and any future routes) is reachable by an unauthenticated user without being redirected to `/login`.

The server-side guard in `app/(app)/layout.tsx` does still call `auth.api.getSession` and redirects if the session is absent, so the app layout provides a secondary gate. However, API routes under `app/api/` (including `app/api/auth/[...all]/route.ts`) and any future routes added outside the `(app)` group are completely unprotected at the edge. Relying solely on the layout guard also means every unauthenticated page hit incurs a full server render + DB session lookup before the redirect fires.

**Fix:** Rename `proxy.ts` to `middleware.ts` and re-export the `proxy` function as the default export, which is what Next.js looks for. The `config` export stays in the same file and Next.js will pick it up automatically.

```ts
// middleware.ts  (rename proxy.ts → middleware.ts, then change this file)
export { proxy as default, config } from "@/proxy";
```

Or, more simply, rename the file in place and replace the named export with a default export:

```ts
// middleware.ts
import { type NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "better-auth.session_token";

export default function middleware(req: NextRequest) {
  // ... existing proxy body ...
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

---

### CR-02: `ALLOW_SIGNUP=1` has no production guard — the signup-disable control is advisory only

**File:** `lib/auth.ts:21`

**Issue:** The comment on line 19 states "Never set this in a real environment — production default is disabled." However, the code enforces nothing: any operator who sets `ALLOW_SIGNUP=1` in `.env.local` or a deployment environment config will silently re-enable self-service signup. For a single-user internal tool this creates a significant risk — if the variable is accidentally left set (e.g. copied from a `.env.test` file), any visitor can register a new account.

The issue is compounded by the fact that both `sign-in.test.ts`, `sign-out.test.ts`, and `session-cookie.test.ts` set `ALLOW_SIGNUP=1` in `process.env` inside `beforeAll` without cleaning it up afterward. Because Vitest shares the Node process, if a test file that sets this variable runs before a test that imports `lib/auth.ts` without calling `vi.resetModules()`, the cached module will have `disableSignUp: false` for the entire test run.

**Fix:** Add a runtime guard that throws when `ALLOW_SIGNUP` is set and `NODE_ENV` is `production`:

```ts
// lib/auth.ts — add after the BETTER_AUTH_SECRET guard
if (process.env.ALLOW_SIGNUP === "1" && process.env.NODE_ENV === "production") {
  throw new Error(
    "ALLOW_SIGNUP=1 must never be set in production. " +
    "Remove it from your environment configuration."
  );
}
```

This makes the policy machine-enforced rather than comment-enforced.

---

## Warnings

### WR-01: Seed script error message instructs operator to edit source code instead of using `ALLOW_SIGNUP`

**File:** `scripts/seed-user.ts:51-53`

**Issue:** Lines 51–53 of the catch block tell the operator to "temporarily set `disableSignUp: false` in `lib/auth.ts`" — editing production source code as a workaround. But `lib/auth.ts` already supports `ALLOW_SIGNUP=1` as the proper mechanism for exactly this purpose (see the comment on line 19 of `lib/auth.ts`). The error message is stale relative to the implemented design and will send an operator down the wrong path.

**Fix:** Update the error message to match the actual `ALLOW_SIGNUP` mechanism:

```ts
console.error(
  "A1 workaround: set ALLOW_SIGNUP=1 in your environment before running this script."
);
console.error(
  "Example: ALLOW_SIGNUP=1 SEED_EMAIL=... SEED_PASSWORD=... npx tsx scripts/seed-user.ts"
);
```

---

### WR-02: Test `beforeAll` blocks set `process.env.ALLOW_SIGNUP` without restoring it — module cache pollution risk

**File:** `__tests__/auth/sign-in.test.ts:15`, `__tests__/auth/sign-out.test.ts:19`, `__tests__/auth/session-cookie.test.ts:15`

**Issue:** All three integration test files set `process.env.ALLOW_SIGNUP = "1"` inside `beforeAll` but never restore it (no `afterAll` that deletes or resets the variable). Each file calls `vi.resetModules()` before importing `lib/auth`, which correctly causes a fresh module evaluation. However, if Vitest runs test files in the same worker thread and the module cache is not fully isolated between files, a subsequent test file that imports `lib/auth` without calling `vi.resetModules()` (e.g. via a transitive import) could receive a module instance where `disableSignUp` is `false`.

Currently this is benign because none of the other test files rely on signup being disabled. But as the test suite grows, this silent pollution could produce hard-to-diagnose failures.

**Fix:** Add an `afterAll` in each affected test file to clean up:

```ts
afterAll(() => {
  delete process.env.ALLOW_SIGNUP;
  cleanup?.();
});
```

---

### WR-03: `vitest.config.ts` uses `happy-dom` for all tests including DB integration tests

**File:** `vitest.config.ts:5`

**Issue:** `happy-dom` is the correct environment for DOM/component tests. However, the same environment applies to `__tests__/auth/*.test.ts`, `__tests__/seed/seed-user.test.ts`, and `__tests__/proxy/redirect.test.ts`, which are Node.js integration tests that spawn child processes (`execSync`), open SQLite files in the OS temp directory, and call `npx drizzle-kit push`. `happy-dom` emulates a browser environment and patches certain Node.js globals (e.g. `fetch`, `URL`). If `happy-dom` patches `URL` or `fetch` in a way that differs from Node's built-in, the better-auth API calls inside the integration tests may behave unexpectedly or fail silently.

The immediate practical risk: `createTestDb` calls `execSync("npx drizzle-kit push --force", ...)` which relies on real Node.js `child_process` — this works because happy-dom does not replace Node built-ins, only browser globals. But it is fragile and the environment mismatch is worth correcting before the test suite grows.

**Fix:** Use per-test-file environment overrides via Vitest's `@vitest-environment` docblock for the node-only tests, or split the config into two projects:

```ts
// vitest.config.ts
export default defineConfig({
  test: {
    projects: [
      {
        // Node integration tests
        include: ["__tests__/auth/**", "__tests__/seed/**", "__tests__/proxy/**"],
        environment: "node",
        globals: true,
      },
      {
        // DOM / component tests
        include: ["__tests__/ui/**"],
        environment: "happy-dom",
        globals: true,
        setupFiles: ["./__tests__/setup.ts"],
      },
    ],
  },
  resolve: { alias: { "@": path.resolve(__dirname, "./") } },
});
```

Alternatively, add a docblock at the top of each node-only test file:

```ts
// @vitest-environment node
```

---

## Info

### IN-01: `proxy.ts` matcher does not exclude `robots.txt` or other public static files

**File:** `proxy.ts:28`

**Issue:** The matcher pattern `/((?!api|_next/static|_next/image|favicon.ico).*)` excludes common Next.js internal paths but does not exclude other static public files such as `robots.txt`, `sitemap.xml`, or `apple-touch-icon.png`. Requests to those paths from crawlers or browser prefetch would be unnecessarily redirected to `/login`. This is a minor friction issue for an internal tool, but worth noting.

**Fix:** Add common public assets to the negative lookahead:

```ts
matcher: ["/((?!api|_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)"],
```

---

### IN-02: `db/client.ts` creates the database connection at module load time — no lazy initialization

**File:** `db/client.ts:14`

**Issue:** `new Database(dbPath)` is called at the top level when the module is first imported. This means every test file that imports (directly or transitively) anything from `@/db/client` will attempt to open the SQLite file at the path in `process.env.DATABASE_URL` at import time, not at test setup time. The integration tests work around this via `vi.resetModules()` and dynamic imports, which is correct — but the pattern is fragile. If any test imports a module with a static `import { db } from "@/db/client"` before setting `DATABASE_URL`, the wrong database will be opened silently.

This is not a bug in the current code (the tests use dynamic imports), but it is a latent trap.

**Fix (informational):** Consider wrapping the connection in a lazy accessor, or document the requirement clearly in `db/client.ts` as a code comment so future contributors know they must use dynamic imports in tests.

---

### IN-03: `loginSchema` only validates password length, not presence of content

**File:** `lib/validations/auth.ts:5-8`

**Issue:** The Zod schema validates `password` with `z.string().min(12)`. This is correct for login (which checks an existing password). However, if this schema is ever reused for a signup flow, it would accept a 12-character string of spaces (`"            "`). The schema comment does not indicate it is login-only. Not a bug in the current scope (signup is disabled), but worth noting.

**Fix (informational):** Either rename to `loginSchema` explicitly (already done) and add a comment that it is for login validation only, or add `.trim().min(12)` to reject whitespace-only passwords. Since signup is disabled this is low priority.

---

_Reviewed: 2026-04-17T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
