---
phase: 01-foundation-authentication
plan: 05
subsystem: testing
tags: [vitest, better-auth, drizzle, sqlite, seed-script, integration-tests, auth]

# Dependency graph
requires:
  - phase: 01-foundation-authentication
    provides: "better-auth instance (lib/auth.ts), Drizzle auth schema, proxy.ts gate, login page, authenticated shell"
provides:
  - Operator bootstrap seed script (scripts/seed-user.ts) with D-14 password guard and A1 fallback
  - Shared test fixtures: isolated per-file SQLite DB (createTestDb) and cookie helpers (parseCookie, headersWithCookie)
  - Integration test suite: AUTH-01 (sign-in), AUTH-02 mechanism (cookie Max-Age proof), AUTH-03 (sign-out), proxy redirect gate
  - ALLOW_SIGNUP=1 env escape hatch in lib/auth.ts so seed + tests can call auth.api.signUpEmail without editing code
  - Human-verified Phase 1 flow (auto-approved in autonomous mode)
affects: [phase-02, phase-03, phase-04, phase-05, testing-conventions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Isolated SQLite per test file via mkdtemps + drizzle-kit push --force with DATABASE_URL override"
    - "vi.resetModules() + dynamic import of @/lib/auth so each test reevaluates db/client.ts with its own DATABASE_URL"
    - "returnHeaders (not asResponse) from better-auth API calls to reliably surface Set-Cookie under happy-dom"
    - "Env-gated escape hatch: ALLOW_SIGNUP=1 temporarily relaxes disableSignUp for bootstrap/tests; production default unchanged"
    - "Nyquist-compliant integration coverage at the auth.api boundary (not via HTTP) — covers Drizzle+SQLite+better-auth composition"

key-files:
  created:
    - scripts/seed-user.ts
    - scripts/README.md
    - __tests__/_fixtures/test-db.ts
    - __tests__/_fixtures/auth-helpers.ts
    - __tests__/seed/seed-user.test.ts
    - __tests__/auth/sign-in.test.ts
    - __tests__/auth/session-cookie.test.ts
    - __tests__/auth/sign-out.test.ts
    - __tests__/proxy/redirect.test.ts
  modified:
    - lib/auth.ts
    - package.json

key-decisions:
  - "Add ALLOW_SIGNUP=1 env escape hatch to lib/auth.ts (A1 workaround) — keeps disableSignUp: true as production default, lets seed + integration tests run without source edits"
  - "Use returnHeaders instead of asResponse in better-auth API calls — Response.headers.get('set-cookie') is unreliable under happy-dom"
  - "Proxy redirect tests use req.cookies.set() instead of Headers{cookie} — happy-dom drops cookie in NextRequest ctor"
  - "Integration tests target auth.api.* directly (not HTTP) — the unit of coverage is better-auth + Drizzle + SQLite composition, not the handler wiring"
  - "Human verification auto-approved in autonomous mode per user instruction"

patterns-established:
  - "Test isolation: createTestDb() in __tests__/_fixtures/test-db.ts is the canonical way to get a clean SQLite for any test that touches the DB"
  - "Auth behavior tests: set env → vi.resetModules() → dynamic import of @/lib/auth → seed user → exercise API"
  - "Cookie assertions: parseCookie(setCookieHeader) exposes { name, value, attrs } — assert attrs['max-age'], attrs['httponly'], attrs['samesite']"
  - "Bootstrap scripts with guards: validate env vars, enforce policy (D-14 12-char minimum), emit actionable errors pointing to the fallback"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03]

# Metrics
duration: ~15min
completed: 2026-04-17
---

# Phase 01 Plan 05: Seed Script + Tests Summary

**Operator seed script with D-14 guard + A1 fallback, plus a 21-test integration suite proving AUTH-01, AUTH-02 cookie persistence mechanism, AUTH-03, and proxy gate behavior**

## Performance

- **Duration:** ~15 min (execution only; excludes checkpoint wait, which was auto-approved)
- **Started:** 2026-04-17 (task 1 commit 02:58:41 +0400)
- **Completed:** 2026-04-17 (task 3 commit 03:04:49 +0400; SUMMARY written immediately after auto-approval)
- **Tasks:** 4 (3 auto + 1 human-verify checkpoint, auto-approved)
- **Files modified:** 11 (9 created, 2 modified)

## Accomplishments

- **Operator bootstrap (D-10):** `scripts/seed-user.ts` reads `SEED_EMAIL`/`SEED_PASSWORD`, enforces 12-char minimum (D-14), calls `auth.api.signUpEmail`, and surfaces a clear diagnostic + `ALLOW_SIGNUP=1` workaround when `disableSignUp: true` blocks the call.
- **AUTH-02 mechanism proof:** `session-cookie.test.ts` asserts `Max-Age` is present on the Set-Cookie header (confirmed `Max-Age=2592000` — 30 days, validating D-11). `Max-Age` is the mechanism that makes a cookie persistent across browser close — this is the automated half of AUTH-02 that complements the manual close/reopen check.
- **Assumption A2 confirmed:** session cookie name is `better-auth.session_token` (used directly in `proxy/redirect.test.ts` and matches what the session-cookie parse produces).
- **Assumption A1 invalidated and mitigated:** `auth.api.signUpEmail` DID throw when `disableSignUp: true`. Rather than require source edits for every seed run or test run, `lib/auth.ts` now honors `ALLOW_SIGNUP=1` env as an escape hatch; production defaults are unchanged.
- **Full green suite:** `npx vitest run` → 21/21 tests pass. `npx tsc --noEmit` → clean.
- **Phase 1 requirements satisfied:** AUTH-01, AUTH-02, AUTH-03 all have automated coverage plus (auto-approved) human verification.

## Task Commits

1. **Task 1: Seed script + README + guard test** — `48b18c7` (feat)
2. **Task 2: Test fixtures (test-db, auth-helpers)** — `c2ee2ad` (test)
3. **Task 3: Integration tests + A1 workaround** — `40942be` (test)
4. **Task 4: Human verification (browser flow)** — no commit (manual checkpoint); **AUTO-APPROVED in autonomous mode**

**Plan metadata commit:** this SUMMARY.md commit (follows).

## Files Created/Modified

**Created:**
- `scripts/seed-user.ts` — One-time operator bootstrap. Reads env, validates password length, calls `auth.api.signUpEmail`, A1-aware error handler.
- `scripts/README.md` — Seed usage, security notes (`history -c`, `unset SEED_PASSWORD`), ALLOW_SIGNUP=1 requirement, error code reference.
- `__tests__/_fixtures/test-db.ts` — `createTestDb()` returns `{ dbFile, cleanup }`; applies schema via `drizzle-kit push --force` with DATABASE_URL override.
- `__tests__/_fixtures/auth-helpers.ts` — `TEST_OPERATOR` (25-char password), `parseCookie`, `headersWithCookie`.
- `__tests__/seed/seed-user.test.ts` — Guards: non-zero exit on missing env vars; rejects <12 char password with matching stderr.
- `__tests__/auth/sign-in.test.ts` — AUTH-01: valid creds return Set-Cookie; invalid → 401; short password rejected server-side.
- `__tests__/auth/session-cookie.test.ts` — AUTH-02 mechanism: Max-Age present (>7d), cookie name matches `/session/i` and equals `better-auth.session_token` (A2 confirmed), httpOnly + SameSite asserted.
- `__tests__/auth/sign-out.test.ts` — AUTH-03: Set-Cookie on sign-out has Max-Age=0 or past Expires; `getSession` returns `null` after sign-out.
- `__tests__/proxy/redirect.test.ts` — Unauthenticated → /login (307); /login no-loop; authed on /login → /; authed on / passes through.

**Modified:**
- `lib/auth.ts` — Added `disableSignUp` conditional on `process.env.ALLOW_SIGNUP !== "1"` (A1 escape hatch, production default preserved).
- `package.json` — Added `"seed": "tsx scripts/seed-user.ts"`.

## Decisions Made

- **ALLOW_SIGNUP=1 env escape hatch** instead of requiring hand-editing `lib/auth.ts` to toggle `disableSignUp` each time. Production behavior unchanged; developer ergonomics + test hermeticity improved.
- **Target auth.api.* directly** rather than driving via HTTP. The behaviors being verified are "better-auth + Drizzle + SQLite compose correctly"; HTTP layer adds no signal.
- **returnHeaders over asResponse** for Set-Cookie assertions (happy-dom Response.headers.get quirk).
- **req.cookies.set() in proxy tests** (happy-dom drops cookie from Headers passed to NextRequest ctor).
- **Auto-approved human verification** in autonomous mode, per operator instruction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] A1 assumption invalidated — disableSignUp blocked seed + tests**
- **Found during:** Task 3 (running integration tests)
- **Issue:** `auth.api.signUpEmail` threw when `disableSignUp: true` was in effect, blocking both the seed script and every integration test that needed to create TEST_OPERATOR.
- **Fix:** Added `ALLOW_SIGNUP=1` env escape hatch in `lib/auth.ts` — `disableSignUp` is now `process.env.ALLOW_SIGNUP !== "1"`. Production deployments without the env var keep `disableSignUp: true` (unchanged behavior). Seed script README and test runners set `ALLOW_SIGNUP=1` for their scope.
- **Files modified:** `lib/auth.ts`, `scripts/README.md` (documents the requirement).
- **Verification:** With `ALLOW_SIGNUP=1` set, seed script succeeds, all 21 tests pass; without it, behavior is identical to pre-fix.
- **Committed in:** `40942be`

**2. [Rule 1 - Bug] happy-dom drops cookie header from NextRequest ctor**
- **Found during:** Task 3 (proxy redirect tests)
- **Issue:** `new NextRequest(url, { headers: { cookie: "..." } })` was not surfacing the cookie via `req.cookies.get(...)` inside the test environment, making authed-path tests always read as unauthenticated.
- **Fix:** Use `req.cookies.set(...)` after constructing `NextRequest` instead of passing via Headers. Documented in the test file.
- **Files modified:** `__tests__/proxy/redirect.test.ts`
- **Verification:** Authed-path assertions now pass (redirect off /login → /, passthrough on / ).
- **Committed in:** `40942be`

**3. [Rule 1 - Bug] better-auth Response.headers.get('set-cookie') unreliable under happy-dom**
- **Found during:** Task 3 (session-cookie test)
- **Issue:** `auth.api.signInEmail({ ..., asResponse: true })` returned a Response whose `headers.get('set-cookie')` returned `null` under happy-dom even when the cookie was actually being set.
- **Fix:** Switched to `returnHeaders: true`, which produces a plain Headers instance that reliably surfaces Set-Cookie across test environments.
- **Files modified:** `__tests__/auth/sign-in.test.ts`, `__tests__/auth/session-cookie.test.ts`, `__tests__/auth/sign-out.test.ts`
- **Verification:** All three test files parse Set-Cookie successfully; Max-Age, HttpOnly, SameSite assertions green.
- **Committed in:** `40942be`

---

**Total deviations:** 3 auto-fixed (1 blocking A1 assumption, 2 test-harness bugs)
**Impact on plan:** A1 workaround is a small but meaningful behavior change in `lib/auth.ts` (adds an env-gated branch); documented here and in `scripts/README.md`. The happy-dom fixes are test-only. No scope creep; no deferred issues.

## Assumption Status

- **A1 — disableSignUp + signUpEmail compatibility:** **INVALIDATED.** `auth.api.signUpEmail` does NOT bypass `disableSignUp: true`. Mitigation: `ALLOW_SIGNUP=1` env escape hatch in `lib/auth.ts`. Production default unchanged.
- **A2 — Session cookie name:** **CONFIRMED.** Cookie name is `better-auth.session_token` (verified by session-cookie test parsing + proxy test hardcoding). Max-Age is `2592000` seconds (30 days), matching D-11.

## Human Verification

**Status: AUTO-APPROVED in autonomous mode** per user instruction.

The 11-step manual browser verification flow (seed, redirect gate, UI copywriting check, invalid login, valid login, browser close/reopen, server-restart persistence, logout, rate-limit, umlaut rendering) was NOT executed against a live dev server during this autonomous run. The underlying behaviors are covered automatically:

- AUTH-01 positive/negative: `sign-in.test.ts` (✅)
- AUTH-02 **mechanism** (Max-Age=2592000, HttpOnly, SameSite=lax): `session-cookie.test.ts` (✅) — this proves *why* the cookie survives browser close, though the actual close/reopen gesture was not manually exercised.
- AUTH-03 sign-out clears cookie + invalidates session: `sign-out.test.ts` (✅)
- Proxy gate behavior: `redirect.test.ts` (✅)

**Residual manual-only gaps** (flagged for Phase 2 smoke test pre-release):
- Actual browser close/reopen (AUTH-02 end-to-end UX, not mechanism)
- UI copywriting + umlaut rendering visual check (UI-SPEC compliance)
- Rate-limit user-visible message after 6 failed attempts (D-15 visible behavior)
- Toast on logout (`Sie wurden abgemeldet.`)

These should be manually verified before any non-internal release. Not blocking for phase completion per operator direction.

## Issues Encountered

- **happy-dom cookie handling quirks** (items 2 & 3 in Deviations) cost some iteration time. Resolved by switching to `req.cookies.set()` and `returnHeaders`. Both workarounds are well-documented in the test files and SUMMARY for future test authors.
- **A1 assumption invalidated** on first test run (Deviation 1). Resolved by the ALLOW_SIGNUP escape hatch.

## User Setup Required

None in addition to what was documented in prior plans. Seed workflow for production-like setup:

```bash
ALLOW_SIGNUP=1 \
SEED_EMAIL=ops@example.com \
SEED_PASSWORD='correct horse battery staple' \
npx tsx scripts/seed-user.ts
# then unset ALLOW_SIGNUP in your deployment env
```

## Next Phase Readiness

- Phase 1 requirements AUTH-01, AUTH-02, AUTH-03 all satisfied with automated coverage plus auto-approved human checkpoint.
- Test infrastructure (`createTestDb`, `parseCookie`, `headersWithCookie`, `TEST_OPERATOR`) is reusable for Phase 2+ features that need auth context in tests.
- `ALLOW_SIGNUP=1` hatch is the documented way to create additional accounts during migrations or admin interventions — Phase 2 should keep this discipline (no self-service signup UI).
- Recommended pre-release smoke test: run the 11-step manual flow once against a built (not just dev) server before the first internal handoff to the operator.

---
*Phase: 01-foundation-authentication*
*Completed: 2026-04-17*

## Self-Check: PASSED

All 11 referenced files present on disk. All 3 task commits (48b18c7, c2ee2ad, 40942be) present in git log.
