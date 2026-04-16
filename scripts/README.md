# Scripts

## seed-user.ts — Bootstrap the operator account

Phase 1 has no self-service signup (D-10). The single operator account is created via this one-time script.

### Prerequisites

- Dependencies installed (`npm install`)
- `data/angela.db` exists (created by `npx drizzle-kit push --force` in Plan 03)
- `.env.local` contains `BETTER_AUTH_SECRET` and `DATABASE_URL`

### Usage

```bash
ALLOW_SIGNUP=1 \
SEED_EMAIL=ops@example.com \
SEED_PASSWORD='correct horse battery staple' \
npx tsx scripts/seed-user.ts
```

Or via npm script:

```bash
ALLOW_SIGNUP=1 SEED_EMAIL=ops@example.com SEED_PASSWORD='correct horse battery staple' npm run seed
```

> `ALLOW_SIGNUP=1` is the A1 workaround — it re-enables `signUpEmail` for this
> one process so the seed script can create the initial operator. In production
> this env var is never set, so `disableSignUp: true` remains the default and
> the public `/api/auth/sign-up/email` endpoint stays blocked.

### Security notes

- Clear shell history after running: `history -c` or use `export SEED_PASSWORD=...; npx tsx ...; unset SEED_PASSWORD`
- Password must be ≥12 characters (D-14)
- Do NOT commit real credentials
- Never set `ALLOW_SIGNUP=1` in a deployed environment — it is a dev/seed-only escape hatch

### Errors

- `signup disabled` — set `ALLOW_SIGNUP=1` on the same command line (A1 workaround). Exit code 2.
- `Password must be at least 12 characters` — pick a longer password. Exit code 1.
- `SEED_EMAIL and SEED_PASSWORD ... required` — set both env vars. Exit code 1.
