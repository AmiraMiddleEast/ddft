---
phase: quick-260626-wou
plan: 01
subsystem: settings, extraction
tags: [settings, anthropic, error-handling, runtime-config]
requires:
  - db/client.ts
  - lib/auth.ts
  - "@anthropic-ai/sdk"
provides:
  - classifyAnthropicError / extractionErrorMessageDe (shared classifier)
  - app_setting key-value table
  - lib/settings/store.ts (resolve/mask helpers, call-time key/model)
  - saveAndTestSettingsAction Server Action
  - /admin/settings page + nav link
affects:
  - lib/extraction/claude.ts (call-time key/model resolution)
  - lib/extraction/actions.ts (richer error classification)
  - app/(app)/documents/[id]/page.tsx (specific error message)
tech-stack:
  added: []
  patterns:
    - "Call-time Anthropic client (per-call, no module cache) so UI key changes apply with no restart"
    - "Pure shared error classifier reused by extraction catch + settings test"
    - "Key-value app_setting table for runtime config"
key-files:
  created:
    - lib/extraction/error-code.ts
    - lib/extraction/error-code.test.ts
    - lib/settings/store.ts
    - lib/settings/actions.ts
    - lib/validations/settings.ts
    - app/(app)/admin/settings/page.tsx
    - app/(app)/admin/settings/SettingsForm.tsx
  modified:
    - lib/uploads/errors.ts
    - app/(app)/upload/_components/ErrorCopy.ts
    - db/schema.ts
    - lib/extraction/claude.ts
    - lib/extraction/actions.ts
    - lib/extraction/actions.test.ts
    - app/(app)/layout.tsx
    - app/(app)/documents/[id]/page.tsx
decisions:
  - "Anthropic key stored plaintext in SQLite — accepted for single-user internal tool (T-wou-03); never rendered in full, never logged"
  - "app_setting applied via direct CREATE TABLE (matches drizzle-kit push output) because drizzle-kit push reproducibly stalls on the iCloud filesystem; production applies it via update.sh push"
  - "Per-call Anthropic client (no module-level cache) so a UI key/model change takes effect on the next extraction with no restart"
metrics:
  duration: ~17min
  completed: 2026-06-26
  tasks: 4
  files: 15
---

# Quick 260626-wou: Einstellungs-Seite (Anthropic API-Key + Modell) + spezifische Fehlermeldungen Summary

Runtime-configurable Anthropic key/model via a new /admin/settings page with a real "Speichern & testen" validation call, plus a shared error classifier that turns generic "Analyse fehlgeschlagen" into specific German reasons (credit/auth/rate-limit/model) reused by both the settings test and the extraction catch.

## What Was Built

**A) Settings page (SET-A)**
- `app_setting` key-value table (`anthropic_api_key`, `claude_model`).
- `lib/settings/store.ts`: `getSetting`/`setSetting`, `resolveAnthropicKey` (DB → env fallback), `resolveClaudeModel` (DB → `DEFAULT_CLAUDE_MODEL`), and `maskKey` (renders `Gesetzt: sk-ant-…<last4>` / "Kein Schlüssel gesetzt").
- `saveAndTestSettingsAction`: auth-gated, validates, saves model always + key only when non-blank, then runs a real `max_tokens:1` Anthropic ping and returns a structured German `TestStatus`.
- `/admin/settings` Server Component (passes only the masked hint to the client) + `SettingsForm` client component (password field, model field, "Speichern & testen", inline result + toast). "Einstellungen" nav link added after "CoGS".
- `claude.ts` now resolves key+model at call time with a per-call `new Anthropic(...)` (module-level cache removed) so a UI change applies on the next extraction with NO restart.

**B) Specific extraction errors (SET-B)**
- `lib/extraction/error-code.ts`: `classifyAnthropicError(e)` (401→auth, 400+"credit balance"→credit, 400 other→unknown, 429→rate_limited, 404→model_unavailable, 413→too_large, else→unknown) and `extractionErrorMessageDe(code)` German messages. Pure module, unit-tested.
- Extraction catch in `actions.ts` now uses `classifyAnthropicError` (was 429-or-unknown only).
- `UPLOAD_ERROR_CODES` + `ErrorCopy` extended with auth/credit/model_unavailable/too_large.
- Document detail page renders `extractionErrorMessageDe(doc.errorCode)` and links to `/admin/settings` for credit/auth errors.

## Schema Change

The `app_setting` table requires a schema push. `drizzle-kit push` (`npm run db:push`) reproducibly **stalls on the iCloud working directory** (same fsync issue documented for build/vitest), so the table was applied to the local dev DB via a direct `CREATE TABLE app_setting (...)` that mirrors exactly what push emits (verified: `key`/`value`/`updated_at` columns present). **No generated migration file is committed** — matching this project's push-based convention. The **production server applies it automatically via `update.sh`** (runs push, ignores conflicts). This is an additive, non-destructive change.

## Security

- The Anthropic API key is stored **plaintext in SQLite** — explicitly **accepted** for this single-user internal tool (threat T-wou-03); not encrypted. The DB file is server-local and access-controlled.
- The key is **never rendered in full** — the server passes only `maskKey()` to the client and the input is `type="password"` (T-wou-01).
- The key value is **never logged** in error-code.ts, settings/store.ts, or settings/actions.ts (T-wou-02). The existing `[extraction] failed` log logs only the error object.
- Blank key field on save = keep existing key (T-wou-05). Both the page (layout redirect) and the action (`getSession` recheck) gate access (T-wou-04).

## Deviations from Plan

None — plan executed as written. One mechanical adaptation: the schema push was applied via direct `CREATE TABLE` instead of `drizzle-kit push` because push hangs on the iCloud filesystem (the plan's constraint explicitly permits noting this); the resulting table is identical to the push output.

## Verification

The iCloud working directory reproducibly **stalls** `tsc`, `npm run build`, and `vitest` on fsync (confirmed: each hung for several minutes with no output / exit 144). Per the task constraints, verification was run on a fast-filesystem copy:
- rsync of the repo (excluding node_modules/.next/.git) to `/tmp/angela-verify`, then `npm ci`.
- `npx tsc --noEmit -p tsconfig.json` → **exit 0, no errors**.
- `npm run build` → **exit 0**, `/admin/settings` route present in the route tree.
- `npx vitest run` → **243/244 tests pass** (incl. the new error-code.test.ts and the new "credit" case in actions.test.ts).
- The temp copy was removed after verification.

The error-code unit test alone (`npx vitest run lib/extraction/error-code.test.ts`) was also run successfully **in-place** on the iCloud path (pure test, no on-disk DB) — 17 passed.

### Known Pre-existing Failure (NOT touched)

`__tests__/ui/case-detail.test.tsx` — the "Mindestens ein Dokument ist noch nicht geprüft." unreviewed-docs banner test fails independently of this work. Per the task constraints this was left as-is and not investigated.

## Manual Verification (operator, post-deploy)

- Open Einstellungen; save a model only (key blank) → key hint unchanged.
- Enter a bad key → "API-Schlüssel ungültig".
- With the real out-of-credit key → "Kein Anthropic-Guthaben — …".
- Trigger an extraction failure → document page shows the specific reason + settings link for credit/auth.

## Self-Check: PASSED

- All 7 created files exist on disk.
- All 4 task commits exist (9def76e, 4f0f8f7, f9db02e, 9018f96).
- `app_setting` table present in the local DB.
