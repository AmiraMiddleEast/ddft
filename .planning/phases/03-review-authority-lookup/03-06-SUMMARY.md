---
phase: 03-review-authority-lookup
plan: 06
subsystem: testing
tags: [vitest, integration-tests, in-memory-sqlite, happy-dom, server-components, human-verify, checkpoint]

# Dependency graph
requires:
  - phase: 03-review-authority-lookup
    provides: Behörden schema + seed (Plan 01), Zod schemas (Plan 02), resolveAuthority + specialRules (Plan 03), approveAndResolve + chooseAmbiguousAuthority (Plan 04), review page + ReviewForm + AuthorityResultPanel (Plan 05)
  - phase: 02-document-upload-ai-extraction
    provides: phase2-integration pattern (in-memory SQLite, Drizzle schema DDL, vi.doMock after vi.resetModules), mini-fixture loader conventions
  - phase: 01-foundation-authentication
    provides: better-auth session shape, user table schema, happy-dom vitest env
provides:
  - End-to-end integration suite exercising the full approve → resolve → persist → fetch chain against a real in-memory SQLite + real Drizzle schema + real resolver + mini Behörden fixture (7 tests: matched, ambiguous, not_found, special_rules, full contact fields, upsert, chooseAmbiguous transition)
  - Server Component branching tests for /documents/[id]/review covering 4 branches (unauth → /sign-in, foreign doc → notFound, non-done → /documents/[id], done → render)
  - Phase 3 closed out pending the operator's live-browser UAT (11-item checklist deferred — auto-approved in autonomous mode)
affects: [phase-04-cases-laufliste, phase-05-admin-reupload]

tech-stack:
  added: []
  patterns:
    - "Phase-level integration harness: node-env test file with inline DDL applied to new Database(':memory:'), seed via Drizzle inserts, vi.resetModules + vi.doMock('@/db') per test module so the action binds to the in-memory handle"
    - "Server Component render shim: `const jsx = await ReviewPage({ params: Promise.resolve({ id }) }); render(jsx);` — avoids next-test-utils while still exercising the real page module"
    - "Redirect/notFound mocked to throw sentinel errors (REDIRECT:<path>, NOT_FOUND) so branch assertions become simple toThrow matches"

key-files:
  created:
    - __tests__/phase3-integration.test.ts
    - __tests__/review/page.test.tsx
  modified: []

key-decisions:
  - "Used the Phase 2 integration harness verbatim (in-memory SQLite + inline DDL + vi.doMock after vi.resetModules) instead of spinning up a test-container or drizzle-kit push at runtime — matches STATE.md 'Phase 2 pattern' decision and keeps test startup sub-second."
  - "Server Component tests invoke the page function directly (`await ReviewPage({ params })`) and render the returned JSX with @testing-library/react — lighter than next-test-utils, sufficient for branch coverage, acceptable because render-result visuals are already covered by ReviewForm / AuthorityResultPanel unit tests in Plan 05."
  - "Human-verify checkpoint auto-approved under autonomous mode; all 11 UAT items recorded as deferred post-phase verification rather than blocking Phase 3 closeout."

patterns-established:
  - "Pattern: Phase closure = integration test + page-branch test + human-verify checkpoint. Keeps automated coverage at the cross-plan seam while delegating true visual/interactive acceptance to a live walkthrough."
  - "Pattern: Mock next/navigation.redirect/notFound as throwers so Server Component branching can be asserted with `await expect(ReviewPage(...)).rejects.toThrow('REDIRECT:/sign-in')`."
  - "Pattern: Integration test seeds ONE user + ONE document + 6 extractions + mini Behörden fixture, then reuses the same DB handle across ordered tests that exercise state transitions (ambiguous → choose → matched on the same document_review row)."

requirements-completed: [REVW-01, REVW-02, REVW-03, REVW-04, LKUP-01, LKUP-02, LKUP-03, LKUP-04]

# Metrics
duration: 4min
completed: 2026-04-17
---

# Phase 3 Plan 6: Phase 3 Integration Tests + Human Verify Checkpoint Summary

**End-to-end integration suite (approveAndResolve + chooseAmbiguousAuthority against real in-memory DB + real resolver) plus Server Component branch tests, closing Phase 3 with live-browser UAT deferred under autonomous mode.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-17T10:11:30Z
- **Completed:** 2026-04-17T10:15:42Z
- **Tasks:** 3 (2 automated + 1 checkpoint auto-approved)
- **Files modified:** 2 (both new)

## Accomplishments
- End-to-end integration test exercising the full approve → resolve → persist chain against real Drizzle schema + real resolver (7 test cases)
- Server Component branch coverage for /documents/[id]/review (unauthenticated, foreign, non-done, done-render)
- Phase 3 gate cleared under autonomous execution (human-verify checkpoint auto-approved; UAT items tracked for manual sign-off)

## Task Commits

Each task was committed atomically:

1. **Task 1: __tests__/phase3-integration.test.ts — full stack approve + resolve + persist** - `20b4260` (test)
2. **Task 2: __tests__/review/page.test.tsx — Server Component redirect/render branches** - `145dc93` (test)
3. **Task 3: Human verification — live browser walkthrough** - auto-approved (no commit; autonomous mode)

**Plan metadata:** _this commit_ (docs: complete plan)

## Files Created/Modified
- `__tests__/phase3-integration.test.ts` - End-to-end integration suite: seeds in-memory SQLite with user + document (extraction_status=done) + 6 extractions + mini Behörden fixture; exercises approveAndResolve across matched / ambiguous / not_found / special_rules (LKUP-03) / full-contact (LKUP-04) / re-approval upsert; transitions ambiguous → matched via chooseAmbiguousAuthority on the same document_review row
- `__tests__/review/page.test.tsx` - Happy-dom Server Component test: mocks next/navigation (redirect/notFound as throwers), auth, DB queries, Behörden loaders, and PdfPreview; covers unauthenticated → /sign-in redirect, foreign-document → notFound, non-done → /documents/[id] redirect, and done-state happy-path render (breadcrumb, heading, PDF preview testid, form section, field labels)

## Decisions Made
- **Reused Phase 2 integration harness pattern verbatim** — in-memory SQLite + inline DDL + `vi.resetModules` + `vi.doMock('@/db')` per test module. Keeps startup fast and matches the pattern documented in STATE.md; avoids the drift risk of introducing a second test harness.
- **Did not introduce next-test-utils** — invoked the Server Component function directly and rendered its returned JSX via @testing-library/react. Lower footprint, sufficient coverage given Plan 05 already tested ReviewForm/AuthorityResultPanel UI shells.
- **Human-verify auto-approved under autonomous mode** — per executor auto-mode contract. All 11 UAT items captured below so operator can still run through them post-phase.

## Deviations from Plan

None - plan executed exactly as written. Checkpoint handling followed auto-mode behavior spec (auto-approve + log + continue), which is documented protocol rather than a deviation.

## Issues Encountered

None. Both test files passed on first run.

## Deferred Items — Human-Verify UAT (Checkpoint Task 3)

The 11-item live-browser walkthrough was auto-approved under autonomous mode. The operator should still run these items manually before Phase 3 is considered verification-complete; any failure here should spawn a revision plan:

1. Navigation: `/documents/[id]` → "Zur Überprüfung" enabled for done-status docs; click lands on `/documents/[id]/review`; tab title "Überprüfung — Angela".
2. Two-column layout (≥1024px): PDF iframe left (min ~640px), form right, ~32px gap, aligned tops.
3. Stacked layout (<1024px, e.g. 900px): PDF above form, both full width.
4. Field editing + accent-border indicator: Dokumenttyp Select is alphabetical, contains real types; changing selection adds 2px left border in accent color + "Ursprünglich: …" caption; reverting removes both.
5. Bundesland Select: all 16 German states alphabetical, plus "Unbekannt / Sonstiges" sentinel.
6. Confidence badges beside each field label: Hoch / Mittel / Niedrig (from Phase 2 extractions).
7. Submit → matched: button disables with spinner + "Behörde wird ermittelt …"; success toast "Zuständige Behörde ermittelt."; AuthorityResultPanel renders with "Zuständige Behörde ermittelt" heading, › breadcrumb, authority name, definition list (Anschrift / Telefon / E-Mail / Website / Öffnungszeiten), special-rules callout + PRÜFEN banner when applicable.
8. Submit → ambiguous: "Mehrere Behörden möglich" + warning banner + candidate list with "Diese Behörde übernehmen" buttons; selecting one transitions to matched variant with success toast.
9. Submit → not_found: Bundesland "Unbekannt / Sonstiges" triggers "Keine Behörde gefunden" with destructive icon + "Eingaben anpassen" CTA; CTA scrolls to form and focuses Dokumenttyp.
10. Verwerfen + DiscardDialog: Dialog "Änderungen verwerfen?" + Verwerfen / Abbrechen; Abbrechen preserves edits; Verwerfen reverts all edits and dismisses any result panel.
11. beforeunload: editing a field then closing tab / navigating away triggers browser's "changes will be lost" prompt.

**Tracking:** These UAT items are logged here (and not in `.planning/phases/03-review-authority-lookup/deferred-items.md`) because they're tied to the completed plan's checkpoint rather than to out-of-scope discoveries.

## Next Phase Readiness
- Phase 3 automated coverage complete: unit (Plan 03), action integration (Plan 04), UI shell (Plan 05), end-to-end integration + page branches (this plan).
- Phase 4 (cases / Laufliste) can rely on: `document_review` rows with lookupStatus ∈ {matched, ambiguous, not_found} + resolvedAuthorityId + correctedFields; `document.reviewStatus='approved'` + `reviewedAt` timestamps; authority contact fields (name / address / phone / email / website / officeHours / specialRules) available per LKUP-04.
- No blockers carried forward. The 11 UAT items above are the only outstanding sign-off for Phase 3.

## Self-Check: PASSED

- FOUND: `__tests__/phase3-integration.test.ts`
- FOUND: `__tests__/review/page.test.tsx`
- FOUND: commit `20b4260` (test: phase3 integration suite)
- FOUND: commit `145dc93` (test: review page branching)
- FOUND: `.planning/phases/03-review-authority-lookup/03-06-SUMMARY.md`

---
*Phase: 03-review-authority-lookup*
*Completed: 2026-04-17*
