# Scripts

## seed-user.ts — Bootstrap the operator account

Phase 1 has no self-service signup (D-10). The single operator account is created via this one-time script.

### Prerequisites

- Dependencies installed (`npm install`)
- `data/angela.db` exists (created by `npx drizzle-kit push --force` in Plan 03)
- `.env.local` contains `BETTER_AUTH_SECRET` and `DATABASE_URL`

### Usage

```bash
SEED_EMAIL=ops@example.com \
SEED_PASSWORD='correct horse battery staple' \
npx tsx scripts/seed-user.ts
```

Or via npm script:

```bash
SEED_EMAIL=ops@example.com SEED_PASSWORD='correct horse battery staple' npm run seed
```

### Security notes

- Clear shell history after running: `history -c` or use `export SEED_PASSWORD=...; npx tsx ...; unset SEED_PASSWORD`
- Password must be ≥12 characters (D-14)
- Do NOT commit real credentials

### Errors

- `signup disabled` — temporarily set `disableSignUp: false` in `lib/auth.ts`, re-run, restore `true` (A1 fallback). Exit code 2.
- `Password must be at least 12 characters` — pick a longer password. Exit code 1.
- `SEED_EMAIL and SEED_PASSWORD ... required` — set both env vars. Exit code 1.
