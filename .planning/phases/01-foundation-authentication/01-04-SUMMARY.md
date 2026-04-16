---
phase: 01-foundation-authentication
plan: 04
subsystem: auth-ui
tags: [nextjs, react-hook-form-alternative, zod, better-auth-client, shadcn, route-groups]
dependency_graph:
  requires:
    - next_16_app_router
    - shadcn_ui_components
    - better_auth_server_instance
    - better_auth_client_sdk
    - proxy_ts_gate
  provides:
    - login_surface
    - authenticated_shell
    - logout_button
    - auth_route_groups
    - login_zod_schema
  affects:
    - 01-05-PLAN (seed user + e2e verification uses /login)
    - all_future_phases (every new route lives inside (app) route group)
tech_stack:
  added: []
  patterns:
    - route_group_auth_vs_app_split
    - server_component_page_plus_client_form
    - authoritative_layout_session_gate
    - zod_client_side_validation
    - toast_feedback_on_logout
key_files:
  created:
    - lib/validations/auth.ts
    - app/(auth)/login/page.tsx
    - app/(auth)/login/login-form.tsx
    - app/(app)/layout.tsx
    - app/(app)/page.tsx
    - components/logout-button.tsx
    - __tests__/auth/login-validation.test.ts
    - __tests__/ui/login-copy.test.tsx
    - __tests__/ui/home-copy.test.tsx
  modified: []
  deleted:
    - app/page.tsx
decisions:
  - "Use authClient.signIn.email (better-auth client SDK) in login form rather than a Server Action — research Pattern 3 recommends it for Phase 1: official docs use this pattern, better-auth handles cookie round-trip, and the form is trivially small."
  - "Client-side Zod validation runs before the network call; on failure same inline error 'E-Mail oder Passwort ungültig.' is shown to avoid leaking whether the fault was email format vs password length (T-04-01 user-enumeration mitigation)."
  - "Protected layout redirects with redirect('/login') on null session (defense-in-depth with proxy.ts cookie-presence gate) — no flash of protected content because the redirect resolves before children render (T-04-03)."
  - "Delete app/page.tsx rather than keep a shim — the (app) route group handles / directly; avoids two files competing for the same URL."
  - "LogoutButton sets pending=true before signOut but only resets it on error — success path redirects so the unmount naturally cleans up state; prevents double-click race."
metrics:
  duration_minutes: 4
  tasks_completed: 2
  files_created: 9
  files_modified: 0
  files_deleted: 1
  commits: 2
  completed_at: "2026-04-16T22:52:12Z"
---

# Phase 01 Plan 04: Login UI & Authenticated Shell Summary

One-liner: Shipped the Phase 1 user-facing auth surface — centered German login card (`/login`), authoritative session gate in `app/(app)/layout.tsx` calling `auth.api.getSession`, `Willkommen` home placeholder, and a ghost Abmelden button that calls `authClient.signOut` with sonner toast feedback; all copy verbatim from UI-SPEC and covered by 6 new Vitest specs.

## What Was Built

### Task 1: Login page + Zod schema + client form

Commit: `5d43046` — `feat(01-04): add login page with Zod validation and client form`

TDD RED → GREEN flow:
1. Wrote `lib/validations/auth.ts` with `loginSchema` — `z.string().email()` + `z.string().min(12)` with German error messages.
2. Wrote `__tests__/auth/login-validation.test.ts` (3 cases) — immediately green against the schema.
3. Wrote `__tests__/ui/login-copy.test.tsx` — RED (import of LoginForm failed, module not found).
4. Wrote `app/(auth)/login/page.tsx` — **Server Component** (no `"use client"`) that renders a centered `<Card bg-muted w-full max-w-[360px]>` with `<CardTitle>Anmelden</CardTitle>` and `<CardDescription>Bitte melden Sie sich mit Ihrem Konto an.</CardDescription>`, embedding `<LoginForm/>` in the `<CardContent>`.
5. Wrote `app/(auth)/login/login-form.tsx` — **Client Component** (`"use client"`) with:
   - Local state (`email`, `password`, `error`, `pending`).
   - Ref on email input for focus-return on error.
   - On submit: Zod validation → `authClient.signIn.email({...})` → distinct German error copy per status code (`429` → rate-limit copy, `401`/`400` → "E-Mail oder Passwort ungültig.", other → sonner toast).
   - Loading state: button disabled, spinner SVG + text toggles `Anmelden` ↔ `Anmelden…`.
   - No register / forgot / remember-me affordances (D-10).
6. Re-ran tests → 5/5 passed (3 validation + 2 copy).

### Task 2: Protected layout + home + logout

Commit: `51dbc21` — `feat(01-04): add authenticated shell with session gate and logout`

TDD RED → GREEN flow:
1. Wrote `__tests__/ui/home-copy.test.tsx` — RED (HomePage module not found).
2. Deleted `app/page.tsx` (placeholder from Plan 01).
3. Wrote `app/(app)/layout.tsx` — async Server Component calling `auth.api.getSession({ headers: await headers() })`; `redirect("/login")` on null session; renders 64px header with app name `Angela`, `{session.user.email}`, and `<LogoutButton/>`.
4. Wrote `app/(app)/page.tsx` — centered flex column with `<h1>Willkommen</h1>` and muted subtext `Die Dokumentenverarbeitung steht in der nächsten Version zur Verfügung.`.
5. Wrote `components/logout-button.tsx` — `"use client"`, `<Button variant="ghost" size="sm">Abmelden</Button>`, calls `authClient.signOut()`, shows `toast.success("Sie wurden abgemeldet.")`, then `router.push("/login")` + `router.refresh()`.
6. Cleared stale `.next/dev/types/validator.ts` (referenced the deleted `app/page.tsx`) via `rm -rf .next`.
7. `npx tsc --noEmit` → exits 0 with no output.
8. `npx vitest run` → 7/7 passed.

## UI-SPEC Copy Match — Verbatim Grep Confirmation

| String | File | Line match |
|--------|------|-----------|
| `Anmelden` (title) | `app/(auth)/login/page.tsx` | `<CardTitle …>Anmelden</CardTitle>` |
| `Bitte melden Sie sich mit Ihrem Konto an.` | `app/(auth)/login/page.tsx` | `<CardDescription …>Bitte melden…</CardDescription>` |
| `E-Mail` (label) | `app/(auth)/login/login-form.tsx` | `<Label …>E-Mail</Label>` |
| `name@beispiel.de` (placeholder) | `app/(auth)/login/login-form.tsx` | `placeholder="name@beispiel.de"` |
| `Passwort` (label) | `app/(auth)/login/login-form.tsx` | `<Label …>Passwort</Label>` |
| `Anmelden` (CTA) | `app/(auth)/login/login-form.tsx` | button text |
| `Anmelden…` (loading) | `app/(auth)/login/login-form.tsx` | loading branch |
| `E-Mail oder Passwort ungültig.` | `app/(auth)/login/login-form.tsx` | inline error |
| `Zu viele Anmeldeversuche. Bitte warten Sie eine Minute.` | `app/(auth)/login/login-form.tsx` | 429 branch |
| `Anmeldung fehlgeschlagen. Bitte erneut versuchen.` | `app/(auth)/login/login-form.tsx` | toast.error fallback |
| `Abmelden` (button) | `components/logout-button.tsx` | ghost button |
| `Sie wurden abgemeldet.` | `components/logout-button.tsx` | toast.success |
| `Abmeldung fehlgeschlagen. Bitte erneut versuchen.` | `components/logout-button.tsx` | toast.error on catch |
| `Willkommen` (h1) | `app/(app)/page.tsx` | `<h1 …>Willkommen</h1>` |
| `Die Dokumentenverarbeitung steht in der nächsten Version zur Verfügung.` | `app/(app)/page.tsx` | subtext `<p>` |

Absent (confirmed via grep):
- `Registrieren` — 0 matches across login surface
- `Sign up` — 0 matches
- `Passwort vergessen` — 0 matches
- `Remember me` — 0 matches

## Removed / Replaced Artifacts

- `app/page.tsx` — deleted. Root `/` is now served by `app/(app)/page.tsx` (route groups don't affect URL; `(app)` is a layout-scoping device). No 404 risk: Next 16 resolves route group pages at the same URL as if the group wrapper weren't there.

## Test Suite Output

```
 RUN  v4.1.4 /…/Angela app

 ✓ __tests__/ui/home-copy.test.tsx (1 test) 19ms
 ✓ __tests__/auth/login-validation.test.ts (3 tests) 4ms
 ✓ __tests__/ui/smoke.test.tsx (1 test) 24ms
 ✓ __tests__/ui/login-copy.test.tsx (2 tests) 36ms

 Test Files  4 passed (4)
      Tests  7 passed (7)
   Duration  761ms
```

All 7 tests green. The one preexisting test (`smoke.test.tsx` from Plan 01) continues to pass unchanged.

## Type-check

```
$ npx tsc --noEmit
(exit 0, no output)
```

Required `rm -rf .next` once after deleting `app/page.tsx` — Next's cached `.next/dev/types/validator.ts` still referenced the old module. This is expected Next 16 behavior and not a code defect; the generated types regenerate on next `next dev` boot.

## Deviations from Plan

None — plan executed exactly as written. All file contents match the plan's `<action>` blocks verbatim (small, mechanical adaptations only: the plan's example JSX for page.tsx was copied as-is; same for login-form.tsx, logout-button.tsx, layout.tsx, page.tsx).

No Rule 1 (bugs), Rule 2 (missing critical functionality), Rule 3 (blocking issues), or Rule 4 (architectural) triggered.

One minor infrastructure adjustment: cleared `.next/` cache before final `tsc` to purge stale type manifests after `app/page.tsx` deletion — transparent to the plan's verification command (plan expects `npx tsc --noEmit` exit 0; achieved).

## Authentication Gates

None. Plan 04 required no external authentication — all operations were local file writes, Vitest runs against mocked `authClient`, and TypeScript type-checking. End-to-end login flow against a real seeded user is deferred to Plan 05.

## Security Notes (Threat Register Mitigations Verified)

| Threat ID | Mitigation in place | Evidence |
|-----------|--------------------|----------|
| T-04-01 (user enumeration via error copy) | 401 and 400 both map to "E-Mail oder Passwort ungültig."; Zod-validation failures also route to the same string | `login-form.tsx` L40-46 |
| T-04-02 (client bypass → weak password) | Client Zod is UX-only; server enforces `minPasswordLength: 12` in better-auth config (Plan 03) | validated via Plan 03 curl test |
| T-04-03 (flash of protected content) | `app/(app)/layout.tsx` is async Server Component — redirect resolves server-side before children render | `layout.tsx` L11-14 |
| T-04-04 (XSS via email in header) | React auto-escapes `{session.user.email}` text content | `layout.tsx` L21 |
| T-04-05 (open redirect post-login) | Hard-coded `router.push("/")`; no `returnTo` param read | `login-form.tsx` L54 |
| T-04-06 (login DoS) | 429 from better-auth surfaces as "Zu viele Anmeldeversuche…" — rate limit lives in server config (Plan 03) | `login-form.tsx` L41-42 |
| T-04-07 (cookie visible to JS) | httpOnly cookie from better-auth; form code never reads `document.cookie` | inspection of `login-form.tsx` |

## Known Stubs

None introduced. `app/(app)/page.tsx` is the permanent home surface for Phase 1 per D-17 — documented as a Phase 2 integration point (upload will be added there) but fully functional in current form.

## Threat Flags

None. All surfaces introduced in this plan map cleanly to the plan's `<threat_model>` (T-04-01 through T-04-07 above). No new network endpoints, no new file-access, no new schema changes.

## Requirements Surface Delivered

- **AUTH-01** — user can log in: `/login` renders the form; submit hits `authClient.signIn.email`; distinct error copy for 400/401/429. **Ready for Plan 05 end-to-end test with seeded user.**
- **AUTH-02** — session persists: `app/(app)/layout.tsx` reads session server-side; better-auth cookie Max-Age (30 days from Plan 03's `session.expiresIn`) makes it persistent. **Browser-restart manual check in Plan 05.**
- **AUTH-03** — user can log out: Abmelden button in header → `authClient.signOut()` → toast → redirect to `/login`.

## Self-Check: PASSED

Files verified present:
- FOUND: `app/(auth)/login/page.tsx`
- FOUND: `app/(auth)/login/login-form.tsx`
- FOUND: `app/(app)/layout.tsx`
- FOUND: `app/(app)/page.tsx`
- FOUND: `components/logout-button.tsx`
- FOUND: `lib/validations/auth.ts`
- FOUND: `__tests__/auth/login-validation.test.ts`
- FOUND: `__tests__/ui/login-copy.test.tsx`
- FOUND: `__tests__/ui/home-copy.test.tsx`
- NOT FOUND (correct): `app/page.tsx` (deleted; `/` now served from `app/(app)/page.tsx`)

Commits verified:
- FOUND: `5d43046` (feat(01-04): add login page with Zod validation and client form)
- FOUND: `51dbc21` (feat(01-04): add authenticated shell with session gate and logout)

Runtime verification:
- FOUND: `npx tsc --noEmit` exits 0 with no output
- FOUND: `npx vitest run` — 7/7 tests pass (4 new this plan + 3 preexisting)
- FOUND: `grep "use client" app/(auth)/login/login-form.tsx` → line 1
- FOUND: `grep "use client" components/logout-button.tsx` → line 1
- FOUND: `grep "authClient.signIn.email" app/(auth)/login/login-form.tsx` → matched
- FOUND: `grep "authClient.signOut" components/logout-button.tsx` → matched
- FOUND: `grep "auth.api.getSession" app/(app)/layout.tsx` → matched
- FOUND: `grep "session.user.email" app/(app)/layout.tsx` → matched
- FOUND: `grep "Willkommen" app/(app)/page.tsx` → matched
