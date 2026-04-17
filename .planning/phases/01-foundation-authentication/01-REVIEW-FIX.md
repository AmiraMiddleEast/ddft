---
phase: 01-foundation-authentication
fixed_at: 2026-04-17T00:00:00Z
review_path: .planning/phases/01-foundation-authentication/01-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 4
skipped: 1
status: partial
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-04-17T00:00:00Z
**Source review:** .planning/phases/01-foundation-authentication/01-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (CR-01, CR-02, WR-01, WR-02, WR-03)
- Fixed: 4
- Skipped: 1 (CR-01 — not a bug, reviewer used incorrect Next.js version assumptions)

## Fixed Issues

### CR-02: ALLOW_SIGNUP=1 has no production guard

**Files modified:** `lib/auth.ts`
**Commit:** bb16640
**Applied fix:** Added a runtime guard immediately after the `BETTER_AUTH_SECRET` check that throws a clear `Error` when `ALLOW_SIGNUP === "1"` and `NODE_ENV === "production"`. The policy that was previously comment-only is now machine-enforced.

---

### WR-01: Seed script error message instructs operator to edit source code

**Files modified:** `scripts/seed-user.ts`
**Commit:** 8541d02
**Applied fix:** Replaced the stale three-line error block (which told the operator to manually edit `lib/auth.ts` and toggle `disableSignUp`) with two lines that reference the correct `ALLOW_SIGNUP=1` env-var mechanism and show a copy-pasteable example command.

---

### WR-02: Test beforeAll blocks set ALLOW_SIGNUP without restoring it

**Files modified:** `__tests__/auth/sign-in.test.ts`, `__tests__/auth/sign-out.test.ts`, `__tests__/auth/session-cookie.test.ts`
**Commit:** 40ab05a
**Applied fix:** Added `delete process.env.ALLOW_SIGNUP;` as the first statement in the existing `afterAll` hook in each of the three files. All three files already had an `afterAll` that called `cleanup?.()` — the delete was prepended to that block rather than creating a duplicate hook.

---

### WR-03: vitest.config.ts uses happy-dom for all tests including DB integration tests

**Files modified:** `__tests__/auth/sign-in.test.ts`, `__tests__/auth/sign-out.test.ts`, `__tests__/auth/session-cookie.test.ts`, `__tests__/seed/seed-user.test.ts`, `__tests__/proxy/redirect.test.ts`
**Commit:** 7d0b0d4
**Applied fix:** Added the `// @vitest-environment node` per-file docblock directive as the first line of each of the five node-only integration test files. This overrides the global `happy-dom` environment from `vitest.config.ts` for these files without requiring a config split. The global config and UI test files (`__tests__/ui/**`) remain on `happy-dom`.

---

## Skipped Issues

### CR-01: proxy.ts is never executed — the auth gate does not protect any route

**File:** `proxy.ts:1`
**Reason:** Not a bug. The reviewer's finding is based on Next.js 14/15 conventions where `middleware.ts` was the required filename. In Next.js 16.2.4 (the installed version), the file convention was **renamed**: `proxy.ts` is now the current standard and `middleware.ts` is the deprecated one.

**Evidence from `node_modules/next/dist/esm/lib/constants.js`:**
```
export const PROXY_FILENAME = 'proxy';
```

**Evidence from `node_modules/next/dist/build/index.js` (line 651):**
```
_log.warnOnce(`The "middleware" file convention is deprecated. Please use "proxy" instead.`)
```

The build also **throws** if both `middleware.ts` and `proxy.ts` exist simultaneously, confirming `proxy.ts` is the authoritative file.

**Export validity:** `proxy.ts` exports `export function proxy(...)` as a named export. Next.js 16's static analysis in `get-page-static-info.js` explicitly checks for a named `proxy` export (`hasProxyExport`) and accepts it as valid alongside a default export. The current file is correctly structured.

**Conclusion:** `proxy.ts` is loaded, the auth gate is active, and no rename is needed. The original issue description ("Next.js never loads it") is factually incorrect for Next.js 16.2.x.

---

_Fixed: 2026-04-17T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
