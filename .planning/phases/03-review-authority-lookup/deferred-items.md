# Phase 03 — Deferred Items

Out-of-scope issues observed during Plan 03-03 execution. Not caused by
changes in this plan; left for a future gap-closure cycle.

## Parallel-test flakiness with `createTestDb()`

- When running `npx vitest run` (default parallel file execution), four pre-
  existing test files time out at their `beforeAll` hook:
  - `__tests__/phase2-integration.test.ts`
  - `__tests__/auth/sign-out.test.ts`
  - `lib/extraction/actions.test.ts`
  - `lib/uploads/actions.test.ts`
- Root cause: each test file calls `__tests__/_fixtures/test-db.ts::createTestDb()`,
  which spawns `npx drizzle-kit push` as a child process. When many files run
  in parallel, the combined subprocess load exceeds vitest's 10s hook timeout
  on this machine.
- Scope: pre-existing. Running `npx vitest run --no-file-parallelism`
  produces **18/18 files green, 79/79 tests pass** including Plan 03-03's
  new `lib/behoerden/slug.test.ts` and `lib/behoerden/resolve.test.ts`.
- Suggested fix (future): replace the subprocess-based `createTestDb` with
  an in-process SQLite schema loader (or cache the generated schema SQL and
  apply it via `sqlite.exec()` the same way `resolve.test.ts` already does).
