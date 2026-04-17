// Run via:
//   SEED_EMAIL=ops@example.com \
//   SEED_PASSWORD='correct horse battery staple' \
//   npx tsx scripts/seed-user.ts
//
// One-time operator bootstrap for Phase 1 (no self-service signup per D-10).
// D-14 password policy: minimum 12 characters.
//
// NOTE: auth is dynamically imported AFTER guard checks so that guard errors
// (missing env vars, short password) do not require BETTER_AUTH_SECRET to be
// present — this keeps the guards testable in isolation.

async function main() {
  const email = process.env.SEED_EMAIL;
  const password = process.env.SEED_PASSWORD;

  if (!email || !password) {
    console.error(
      "ERROR: SEED_EMAIL and SEED_PASSWORD environment variables are required."
    );
    console.error("Example:");
    console.error("  SEED_EMAIL=ops@example.com \\");
    console.error("  SEED_PASSWORD='correct horse battery staple' \\");
    console.error("  npx tsx scripts/seed-user.ts");
    process.exit(1);
  }

  if (password.length < 12) {
    console.error("ERROR: Password must be at least 12 characters (per D-14).");
    process.exit(1);
  }

  // Dynamic import so guards above do not require BETTER_AUTH_SECRET.
  const { auth } = await import("../lib/auth");

  try {
    const result = await auth.api.signUpEmail({
      body: { email, password, name: email },
    });
    console.log(`Seeded operator: ${email} (user id: ${result.user.id})`);
  } catch (err: unknown) {
    // A1 fallback: if disableSignUp blocks the server-side call, the error
    // will mention "signup disabled" or similar. Provide a clear diagnostic.
    const msg = err instanceof Error ? err.message : String(err);
    const lower = msg.toLowerCase();
    if (lower.includes("disabled") || lower.includes("sign up")) {
      console.error(
        "ERROR: Signup is disabled. Set ALLOW_SIGNUP=1 in your environment before running this script."
      );
      console.error(
        "Example: ALLOW_SIGNUP=1 SEED_EMAIL=... SEED_PASSWORD=... npx tsx scripts/seed-user.ts"
      );
      console.error("Original error:", msg);
      process.exit(2);
    }

    console.error("ERROR: Seed failed:", msg);
    process.exit(1);
  }
}

main();
