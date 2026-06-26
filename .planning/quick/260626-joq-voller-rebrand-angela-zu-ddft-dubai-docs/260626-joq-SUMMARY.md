---
phase: quick-260626-joq
plan: 01
subsystem: ui-branding
tags: [rebrand, branding, theme, ui]
requires: [public/ddft-logo.png]
provides: [ddft-header-logo, ddft-login-logo, ddft-page-titles, ddft-color-theme, package-name-ddft]
affects: [app/(app)/layout.tsx, app/(auth)/login/page.tsx, app/layout.tsx, app/globals.css, package.json, "16 page-title files"]
tech-stack:
  added: []
  patterns: [next/image with local public asset, OKLCH brand tokens in @theme + :root]
key-files:
  created: []
  modified:
    - app/(app)/layout.tsx
    - app/(auth)/login/page.tsx
    - app/layout.tsx
    - app/globals.css
    - package.json
    - app/(app)/page.tsx
    - app/(app)/upload/page.tsx
    - app/(app)/history/page.tsx
    - app/(app)/cases/page.tsx
    - app/(app)/cases/new/page.tsx
    - app/(app)/cases/[id]/page.tsx
    - app/(app)/documents/[id]/page.tsx
    - app/(app)/documents/[id]/review/page.tsx
    - app/(app)/admin/behoerden/page.tsx
    - app/(app)/admin/behoerden/authorities/page.tsx
    - app/(app)/admin/behoerden/authorities/[id]/edit/page.tsx
    - app/(app)/admin/behoerden/document-types/page.tsx
    - app/(app)/admin/cogs/[id]/edit/page.tsx
decisions:
  - "Used the documented OKLCH targets verbatim (navy oklch(0.45 0.17 258), cyan oklch(0.72 0.13 220)); white-on-navy keeps AA contrast"
  - "Ran build + tests on a fast-filesystem copy of the project because the iCloud-synced working dir reproducibly stalls Next.js build workers and vitest collection"
metrics:
  tasks: 3
  files_changed: 17
  completed: 2026-06-26
---

# Quick 260626-joq: Full Rebrand Angela → DDFT (Dubai Docs Fast Track) Summary

Replaced the placeholder "Angela" identity with the real DDFT brand across every user-facing surface — header logo + wordmark, login logo, all 16 page-title strings, the package name, and the color theme (navy primary, cyan focus ring) — aligning the web UI with the already-DDFT-branded Laufliste PDF.

## What Was Built

**Task 1 — Logo + wordmark (commit 7d54044):**
- Header (`app/(app)/layout.tsx`): replaced the text "Angela" inside the `<Link href="/">` with a `next/image` of `/ddft-logo.png` (h28, auto width, `priority`) plus a "Dubai Docs Fast Track" wordmark in a flex row. Surrounding nav untouched.
- Login (`app/(auth)/login/page.tsx`): added a centered `/ddft-logo.png` (~64px, `priority`) above the Card by switching `<main>` to `flex-col`; metadata title → "Anmelden — DDFT".

**Task 2 — Page titles + package name (commit 6dad821):**
- Root metadata (`app/layout.tsx`): `title` → "Dubai Docs Fast Track" (full wordmark, standalone).
- All 16 `— Angela` title suffixes → `— DDFT` across 12 single-occurrence files plus the 3 `generateMetadata` occurrences in `cases/[id]/page.tsx` (incl. the `${caseRow.personName} — DDFT` template literal).
- `package.json` name: `angela` → `ddft` (version/other fields unchanged).

**Task 3 — Color theme (commit 94e79ed):**
- `app/globals.css`: `--color-primary` and `:root --primary` → navy `oklch(0.45 0.17 258)` (#08449B); `--color-ring` and `:root --ring` → cyan `oklch(0.72 0.13 220)` (#07B7EF). `--primary-foreground` stays white (AA on navy). Backgrounds/neutrals/`.dark`/`@theme inline` mappings untouched, so shadcn tokens still resolve.

## Verification Results

Build and tests stalled indefinitely in the iCloud-synced working directory (both Turbopack and webpack build workers, and vitest collection, hang at 0% CPU on iCloud fsync). To get a true result, the project was copied to a fast local filesystem (`/tmp`, with a fresh `npm ci` from the same `package-lock.json`) and verified there. The fast copy was a throwaway harness; all committed changes live in the real repo.

- **`npm run build`: PASS (exit 0).** Compiled successfully in 3.4s, TypeScript passed, all 13 static pages generated, all 19 routes built. The only output beyond success is a pre-existing Turbopack NFT trace warning on `next.config.ts` (unrelated to this work, not an error).
- **`npm run test:run` (vitest): 224 passed / 1 failed (225 total).**
  - The single failure (`__tests__/ui/case-detail.test.tsx` → "renders unreviewed-docs banner when at least one doc is not approved") is **pre-existing and unrelated to this rebrand.** Confirmed by checking out the original pre-rebrand `cases/[id]/page.tsx` (commit `4b9d9ee`, none of my edits) into the harness and re-running the test in isolation: it fails identically (the `hasUnreviewed` banner is not found in the rendered DOM). My edits to that file were only the title strings on lines 71/73/74; the banner code at line 167 is untouched and renders the exact expected text. No copy assertion referenced the old "Angela" brand, so no test assertions needed updating.

Real-repo final checks: `grep -rln "Angela" app/` → none; `package.json` name → `ddft`; both layout/login reference `ddft-logo.png`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Verified build/tests on a fast-filesystem copy**
- **Found during:** Task 3 verification
- **Issue:** `npm run build` and `npm run test:run` reproducibly stall (0% CPU) in the iCloud-synced working directory — the Next.js build worker and vitest's collection/transform phase hang on iCloud fsync. The original (un-modified) codebase exhibits the same stall, so this is environmental, not caused by the rebrand.
- **Fix:** `rsync`'d the project to `/tmp/ddft-fastfs`, ran `npm ci` from the committed lockfile, and ran build + tests there. Both completed normally. Temp copy removed afterward.
- **Files modified:** none (verification-only workaround)
- **Commit:** n/a

## Deferred Issues

**Pre-existing test failure (out of scope):** `__tests__/ui/case-detail.test.tsx > renders unreviewed-docs banner when at least one doc is not approved` fails on `main` independent of this rebrand (verified against commit `4b9d9ee`). The component source still contains the expected banner copy; the failure appears to be a `hasUnreviewed`/render mismatch under happy-dom. Not touched here per the scope boundary (only auto-fix issues directly caused by the current task). Logged for a future fix.

## Known Stubs

None introduced by this plan.

## Self-Check: PASSED

- Created files: none (no files created by this plan).
- Modified files verified present and on disk (17 files).
- Commits verified in `git log`:
  - 7d54044 feat(rebrand): add DDFT logo + wordmark to header and login page — FOUND
  - 6dad821 feat(rebrand): replace page-title Angela with DDFT and rename package — FOUND
  - 94e79ed feat(rebrand): apply DDFT navy/cyan color theme — FOUND
