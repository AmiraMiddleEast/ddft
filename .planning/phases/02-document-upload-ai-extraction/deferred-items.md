# Phase 02 — Deferred Items

Out-of-scope issues discovered during Plan 02-07 integration-test work. These were NOT caused by Plan 07 changes and are left for a future gap-closure cycle.

## Pre-existing test failures (full `npx vitest run`)

1. **`__tests__/ui/home-copy.test.tsx` fails to load**
   - Cause: `app/(app)/page.tsx` imports `@/lib/auth` which throws at module load when `BETTER_AUTH_SECRET` is not set in the happy-dom test environment.
   - Scope: pre-existing; introduced earlier in Phase 2 when the home page started importing the auth module for session-aware rendering.
   - Suggested fix: stub `@/lib/auth` in that test file or set the env var in `__tests__/setup.ts`.

2. **`__tests__/seed/seed-user.test.ts > exits non-zero when SEED_EMAIL and SEED_PASSWORD are missing` times out at 5s**
   - Cause: the guard spawn in that test appears to exceed the default 5000ms timeout on this machine.
   - Scope: pre-existing; Phase 1 seed-user integration test.
   - Suggested fix: raise `testTimeout` for that file or refactor the guard test to unit-test the guard function directly.

Both failures reproduce on `main` without `__tests__/phase2-integration.test.ts` present. Do not block Plan 07 exit on them.
