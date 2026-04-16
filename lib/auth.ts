import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db/client";

if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error(
    "BETTER_AUTH_SECRET is required. Generate with: " +
      "node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
  );
}

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "sqlite" }),

  emailAndPassword: {
    enabled: true,              // D-08
    // D-10: no self-service signup in production.
    // ALLOW_SIGNUP=1 can be set ONLY for the seed-user script and integration
    // tests to call auth.api.signUpEmail server-side (A1 workaround). Never
    // set this in a real environment — production default is disabled.
    disableSignUp: process.env.ALLOW_SIGNUP === "1" ? false : true,
    minPasswordLength: 12,      // D-14
    autoSignIn: false,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30,  // D-11: 30 days
    updateAge:  60 * 60 * 24,      // rolling: refresh if older than 1 day
  },

  rateLimit: {
    enabled: true,              // D-15 — force on (default is prod-only)
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 }, // D-15: 5/min override
    },
  },

  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
});

export type Session = typeof auth.$Infer.Session;
