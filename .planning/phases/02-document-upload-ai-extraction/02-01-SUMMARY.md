---
phase: 02-document-upload-ai-extraction
plan: 01
subsystem: infra
tags: [next-config, dependencies, env-setup, claude-sdk, react-dropzone, pdf-lib, p-limit]

requires:
  - phase: 01-foundation-authentication
    provides: "Next 16 + Drizzle + better-auth scaffold, .env.local convention, data/ directory layout"
provides:
  - "Server Action body limit raised to 15 MB (serverActions.bodySizeLimit + proxyClientMaxBodySize)"
  - "@anthropic-ai/sdk@0.88.0, react-dropzone@15.0.0, pdf-lib@1.17.1, p-limit@7.3.0 installed at exact-pinned versions"
  - "ANTHROPIC_API_KEY env convention (placeholder in .env.local.example, dev value in .env.local)"
  - "data/uploads/ gitignored with .gitkeep scaffold so fresh clones have the directory"
affects: [02-02, 02-03, 02-04, 02-05, 02-06, 02-07]

tech-stack:
  added:
    - "@anthropic-ai/sdk 0.88.0"
    - "react-dropzone 15.0.0"
    - "pdf-lib 1.17.1"
    - "p-limit 7.3.0"
  patterns:
    - "Exact-version pinning (no caret) for Phase 2 deps — matches Phase 1 reproducibility pattern"
    - "Next 16 body limits raised via experimental.serverActions.bodySizeLimit AND experimental.proxyClientMaxBodySize (both required per RESEARCH Pitfall 2)"
    - "One-file-per-Server-Action upload pattern (Option A from RESEARCH) — 15 MB covers a 10 MB PDF plus FormData overhead"

key-files:
  created:
    - ".env.local.example"
    - "data/uploads/.gitkeep"
    - ".planning/phases/02-document-upload-ai-extraction/02-01-SUMMARY.md"
  modified:
    - "next.config.ts"
    - "package.json"
    - "package-lock.json"
    - ".gitignore"
    - ".env.local"

key-decisions:
  - "Locked Option A (one file per Server Action call): bodySizeLimit=15mb covers 10 MB raw + FormData overhead without parsing 100 MB batches"
  - "Set BOTH serverActions.bodySizeLimit AND proxyClientMaxBodySize to 15mb — VPS/standalone target would silently truncate in production otherwise (RESEARCH Pitfall 2)"
  - "Honored CLAUDE.md pin of @anthropic-ai/sdk 0.88.0 (latest is 0.90) — project constraint takes precedence over newest"
  - "Re-included data/uploads/ directory in .gitignore with !data/uploads/ + data/uploads/* + !.gitkeep so .gitkeep survives the parent data/* blanket exclusion"
  - "Placed ANTHROPIC_API_KEY placeholder 'sk-ant-PLACEHOLDER' in .env.local per operator env_notes so downstream plans can import process.env.ANTHROPIC_API_KEY without undefined crashes; operator swaps to real key before first extraction"

patterns-established:
  - "Env placeholder file (.env.local.example) contains every var .env.local should set, with empty values for secrets and safe defaults for non-secrets (USD_TO_EUR=0.92)"
  - "Gitignore pattern for data subdirectories: include parent re-inclusion + subdirectory wildcard + .gitkeep negation to satisfy git's directory-exclusion semantics"

requirements-completed: [UPLD-01, UPLD-02, EXTR-01, EXTR-02]

duration: 4min
completed: 2026-04-17
---

# Phase 2 Plan 1: Phase 2 Prerequisites Summary

**Phase 2 dependency + config scaffold: Next 16 body limits raised to 15 MB, @anthropic-ai/sdk 0.88.0 + react-dropzone 15.0.0 + pdf-lib 1.17.1 + p-limit 7.3.0 exact-pinned, ANTHROPIC_API_KEY placeholder wired, data/uploads/ gitignore scaffolded.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-17T04:33Z
- **Completed:** 2026-04-17T04:37Z
- **Tasks:** 3
- **Files modified:** 5 (next.config.ts, package.json, package-lock.json, .gitignore, .env.local)
- **Files created:** 2 (.env.local.example, data/uploads/.gitkeep)

## Accomplishments
- Next.js Server Actions can now accept up to 15 MB FormData payloads in both dev and production (VPS standalone) — covers the 10 MB PDF limit with base64 overhead headroom.
- Four pinned Phase 2 dependencies installed and verified importable: @anthropic-ai/sdk 0.88.0 (Claude Vision), react-dropzone 15.0.0 (upload UI), pdf-lib 1.17.1 (PDF structural validation), p-limit 7.3.0 (Claude concurrency gate).
- `ANTHROPIC_API_KEY` is present in `.env.local` (placeholder — operator swaps before first live extraction) and documented in a committed `.env.local.example`. `USD_TO_EUR=0.92` default also documented for the cost audit log.
- `data/uploads/` directory scaffold committed (via `.gitkeep`) while actual uploaded PDFs remain gitignored, ensuring fresh clones have the write target without ever committing user PDFs.

## Task Commits

1. **Task 1: Raise Next 16 Server Action body limits in next.config.ts** — `567bb65` (chore)
2. **Task 2: Install Phase 2 npm dependencies at pinned versions** — `7dfec20` (chore)
3. **Task 3: Add ANTHROPIC_API_KEY placeholder and data/uploads gitignore** — `ef4b178` (chore)

## Files Created/Modified
- `next.config.ts` — Added `experimental.serverActions.bodySizeLimit: "15mb"` and `experimental.proxyClientMaxBodySize: "15mb"`.
- `package.json` — Added react-dropzone, pdf-lib, p-limit, @anthropic-ai/sdk as exact-pinned deps (no caret).
- `package-lock.json` — Lockfile regenerated to reflect new deps.
- `.env.local.example` (created) — Full env template including DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL from Phase 1 plus new ANTHROPIC_API_KEY (empty) and USD_TO_EUR=0.92.
- `.env.local` — Appended `ANTHROPIC_API_KEY=sk-ant-PLACEHOLDER` and `USD_TO_EUR=0.92` so downstream plans can import without ReferenceError (operator must replace placeholder before first live extraction). This file is gitignored and NOT committed.
- `.gitignore` — Added Phase 2 block: `!data/uploads/` (re-include dir) + `data/uploads/*` (ignore contents) + `!data/uploads/.gitkeep` (track marker).
- `data/uploads/.gitkeep` (created) — Empty file, ensures the upload directory exists on fresh clones.

## Decisions Made
- **Option A locked for body limit sizing:** 15 MB rather than 110 MB. One Server Action call per file keeps per-request memory pressure low and fits the per-file status UI model.
- **Both body limit knobs set:** Next 15.5+ introduced `proxyClientMaxBodySize` as a second gate; setting only `serverActions.bodySizeLimit` would silently truncate in production `next start`. Both knobs must stay in sync at the same value.
- **Gitignore pattern** for `data/uploads/`: because `data/*` already ignores the whole data directory, explicit re-inclusion of `!data/uploads/` + contents wildcard + `.gitkeep` negation was required. Verified with `git check-ignore`.

## Deviations from Plan

### Rule 2 - Missing Critical: Populate .env.local with placeholder so imports don't crash

- **Found during:** Task 3
- **Issue:** The PLAN.md explicitly said "Do NOT create `.env.local`" — but the executor's `<env_notes>` in the prompt overrode this, instructing to place a placeholder value (`sk-ant-PLACEHOLDER`) in `.env.local`. Downstream plans (02-02 onward) will `import process.env.ANTHROPIC_API_KEY` inside Server Actions; if undefined at import time, Claude SDK client instantiation will throw at module-load and break the dev server. Placing a placeholder value keeps the dev server bootable while the real key is pending.
- **Fix:** Appended `ANTHROPIC_API_KEY=sk-ant-PLACEHOLDER` and `USD_TO_EUR=0.92` to `.env.local` (gitignored, not committed).
- **Files modified:** `.env.local` (not committed — gitignored)
- **Verification:** `grep ANTHROPIC_API_KEY .env.local` returns the placeholder line; `.env.local` still listed in `.gitignore` so it will not be accidentally committed.
- **Operator action still required:** Replace `sk-ant-PLACEHOLDER` with a real key from <https://console.anthropic.com/settings/keys> before running any extraction Server Action in Plan 02-03+.

### Rule 3 - Blocking: Expanded .gitignore pattern to survive existing `data/*` rule

- **Found during:** Task 3
- **Issue:** Phase 1 already set `data/*` + `!data/.gitkeep` in .gitignore. A plain `!data/uploads/.gitkeep` negation would not work because git's directory-exclusion semantics prevent descending into an already-excluded directory. Without re-including `data/uploads/` itself, the `.gitkeep` could not be tracked.
- **Fix:** Wrote the Phase 2 gitignore block as three coordinated rules: `!data/uploads/` (re-include directory) → `data/uploads/*` (re-ignore contents) → `!data/uploads/.gitkeep` (track marker). Verified with `git check-ignore data/uploads/random.pdf` (exit 0 = ignored) and `git check-ignore data/uploads/.gitkeep` (exit 1 = NOT ignored = tracked).
- **Files modified:** `.gitignore`
- **Committed in:** `ef4b178`

### Rule 2 - Missing Critical: .env.local.example carries Phase 1 variables too

- **Found during:** Task 3
- **Issue:** PLAN.md Task 3 specified only the Phase 2 additions (ANTHROPIC_API_KEY, USD_TO_EUR). But `.env.local.example` didn't exist before this plan, so a fresh clone would have no reference for DATABASE_URL, BETTER_AUTH_SECRET, or BETTER_AUTH_URL either. Omitting them would leave a broken onboarding experience.
- **Fix:** The `.env.local.example` includes all Phase 1 + Phase 2 variables with safe defaults or empty values for secrets.
- **Files modified:** `.env.local.example`
- **Committed in:** `ef4b178`

---

**Total deviations:** 3 auto-fixed (2 missing critical, 1 blocking)
**Impact on plan:** All three deviations are small, scoped, and necessary for the plan's stated success criteria (dev server bootable, gitignore semantics correct, onboarding complete). No scope creep beyond the stated objective.

## Issues Encountered
- None that required problem-solving beyond the deviations above. `npx tsc --noEmit` passed cleanly after every task. `npx vitest run` continued to show 9 test files / 21 tests passing after dependency install (Phase 1 regression guard).

## User Setup Required

**Operator must replace the placeholder ANTHROPIC_API_KEY in `.env.local` before running Phase 2 Plan 3 (Claude extraction Server Action):**

1. Visit <https://console.anthropic.com/settings/keys>
2. Create a key (or reuse existing one)
3. Edit `.env.local`, replace `sk-ant-PLACEHOLDER` with the real key
4. Restart `npm run dev`

Verification command:
```bash
node -e "require('dotenv').config({path:'.env.local'}); console.log(process.env.ANTHROPIC_API_KEY?.startsWith('sk-ant-') ? 'ok' : 'fail')"
```

No dashboard configuration required beyond key creation.

## Next Phase Readiness

**Ready for Waves 2–6 of Phase 2:**
- Downstream plans can `import Anthropic from "@anthropic-ai/sdk"` — SDK installed and importable.
- Downstream plans can `import { useDropzone } from "react-dropzone"` — UI library installed.
- Downstream plans can `import { PDFDocument } from "pdf-lib"` — used for PDF structural validation (D-21).
- Downstream plans can `import pLimit from "p-limit"` — batch extraction concurrency gate.
- Server Actions accepting FormData with a 10 MB PDF will not be rejected — body limits raised.
- `data/uploads/{uuid}.pdf` is a safe write path that is gitignored.

**Blockers:** None. Operator must swap the placeholder API key before the first live Claude extraction run, but this does not block Plans 02-02 (schema), 02-04 (Zod validators), 02-05 (UI scaffolds) from proceeding in parallel.

## Self-Check

- [x] `next.config.ts` contains `bodySizeLimit: "15mb"` and `proxyClientMaxBodySize: "15mb"` — verified with grep
- [x] `package.json` dependencies block contains exact strings `"react-dropzone": "15.0.0"`, `"pdf-lib": "1.17.1"`, `"p-limit": "7.3.0"`, `"@anthropic-ai/sdk": "0.88.0"` — verified via node script
- [x] `node_modules/react-dropzone/package.json`, `node_modules/@anthropic-ai/sdk/package.json`, `node_modules/pdf-lib/package.json`, `node_modules/p-limit/package.json` all exist
- [x] `.env.local.example` contains `ANTHROPIC_API_KEY=` and `USD_TO_EUR=0.92`
- [x] `.gitignore` contains `data/uploads/` and `!data/uploads/.gitkeep`
- [x] `data/uploads/.gitkeep` exists on disk
- [x] `git check-ignore data/uploads/random.pdf` returns exit 0 (ignored)
- [x] `git check-ignore data/uploads/.gitkeep` returns exit 1 (tracked)
- [x] `npx tsc --noEmit` passes cleanly (no errors)
- [x] `npx vitest run` still shows 21/21 tests passing (Phase 1 regression guard)
- [x] Commits `567bb65`, `7dfec20`, `ef4b178` present in git log

## Self-Check: PASSED

---
*Phase: 02-document-upload-ai-extraction*
*Completed: 2026-04-17*
