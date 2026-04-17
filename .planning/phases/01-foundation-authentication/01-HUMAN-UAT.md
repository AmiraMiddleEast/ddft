---
status: partial
phase: 01-foundation-authentication
source: [01-VERIFICATION.md]
started: 2026-04-17T03:30:00Z
updated: 2026-04-17T03:30:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Unauthenticated redirect
expected: Open http://localhost:3000/ in an incognito window. Instant redirect to /login with no flash of protected content.
result: [pending]

### 2. Login page visual + German copy + umlaut rendering
expected: Centered card with heading "Anmelden", subtext "Bitte melden Sie sich mit Ihrem Konto an.", labels "E-Mail"/"Passwort", button "Anmelden". Umlaut ü renders correctly. No "Registrieren"/"Passwort vergessen"/"Remember me".
result: [pending]

### 3. AUTH-02 end-to-end — browser close/reopen
expected: Log in with seeded creds, close browser entirely (quit), reopen, navigate to http://localhost:3000/. Remains logged in (no redirect to /login, header shows user email).
result: [pending]

### 4. AUTH-03 end-to-end — logout UX
expected: Click "Abmelden". Toast "Sie wurden abgemeldet." appears top-right. Redirect to /login. Subsequent navigation to / redirects back to /login.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

None yet recorded. Items are pending human verification.
