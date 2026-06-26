# Deferred Items — 260626-lc7

Out-of-scope discoveries found during execution. NOT fixed by this task (scope boundary: only auto-fix issues directly caused by this task's changes).

## Pre-existing test failure: case-detail unreviewed-docs banner

- **Test:** `__tests__/ui/case-detail.test.tsx:168` → "renders unreviewed-docs banner when at least one doc is not approved"
- **Symptom:** `getByText("Mindestens ein Dokument ist noch nicht geprüft.")` throws — the component no longer renders that banner.
- **Root cause:** Phase 06 commits `8bd4aea` (fix(06): remove review gate from Laufzettel generation) and `9942d58` (fix(06): remove manual review gate from assignable docs filter) intentionally removed the review-gate banner from the case-detail UI, but the corresponding test assertion was not updated/removed.
- **Relation to this task:** NONE. This task only touched the Claude model id, pricing map, extraction error logging, and the three extraction/cost test files. The failing test has no reference to extraction, cost, or the model string.
- **Recommended fix:** Remove or rewrite the obsolete "unreviewed-docs banner" assertion in `case-detail.test.tsx` to match the post-Phase-06 behavior (review gate removed). Owner: Phase 06 follow-up.
