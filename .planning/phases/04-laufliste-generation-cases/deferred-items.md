Pre-existing flakes noted:
- __tests__/auth/sign-in.test.ts (flaky, passes in isolation)
- __tests__/seed/seed-behoerden.test.ts (flaky, passes in isolation)
- __tests__/seed/seed-user.test.ts (5s timeout on child process exec)
- lib/cases/actions.test.ts / lib/extraction/actions.test.ts (flaky due to parallel createTestDb contention)

All pass individually. Not caused by 04-06 changes. Out of scope.
