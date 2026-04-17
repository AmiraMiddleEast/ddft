// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createTestDb } from "../_fixtures/test-db";
import {
  TEST_OPERATOR,
  parseCookie,
  headersWithCookie,
} from "../_fixtures/auth-helpers";

let cleanup: () => void;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let auth: any;

beforeAll(async () => {
  const db = createTestDb();
  cleanup = db.cleanup;
  process.env.DATABASE_URL = db.dbFile;
  process.env.BETTER_AUTH_SECRET = "x".repeat(32);
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
  process.env.ALLOW_SIGNUP = "1"; // A1 workaround — enable signup for seeding
  vi.resetModules();
  ({ auth } = await import("@/lib/auth"));
  await auth.api.signUpEmail({
    body: {
      email: TEST_OPERATOR.email,
      password: TEST_OPERATOR.password,
      name: TEST_OPERATOR.name,
    },
  });
});

afterAll(() => {
  delete process.env.ALLOW_SIGNUP;
  cleanup?.();
});

describe("AUTH-03 — sign out", () => {
  it("sign-out clears session cookie (Max-Age=0 or Expires in the past)", async () => {
    // returnHeaders pattern — better-auth's Response doesn't expose Set-Cookie
    // via Headers.get() in this runtime; returnHeaders gives a Headers instance
    // that does.
    const signIn = await auth.api.signInEmail({
      body: {
        email: TEST_OPERATOR.email,
        password: TEST_OPERATOR.password,
      },
      returnHeaders: true,
    });
    const signInCookie = signIn.headers.get("set-cookie")!;
    expect(signInCookie).toBeTruthy();
    const { name, value } = parseCookie(signInCookie);

    const signOut = await auth.api.signOut({
      headers: headersWithCookie(name, value),
      returnHeaders: true,
    });
    const clearCookie = signOut.headers.get("set-cookie");
    expect(clearCookie).toBeTruthy();
    const parsedClear = parseCookie(clearCookie!);
    // Cleared cookies have either Max-Age=0 or Expires in the past
    const maxAge = parsedClear.attrs["max-age"];
    const expires = parsedClear.attrs["expires"];
    const cleared =
      (typeof maxAge === "string" && Number(maxAge) === 0) ||
      (typeof expires === "string" && new Date(expires) < new Date());
    expect(cleared).toBe(true);
  });

  it("after sign-out, getSession returns null", async () => {
    // Re-sign in fresh
    const signIn = await auth.api.signInEmail({
      body: {
        email: TEST_OPERATOR.email,
        password: TEST_OPERATOR.password,
      },
      returnHeaders: true,
    });
    const { name, value } = parseCookie(signIn.headers.get("set-cookie")!);

    await auth.api.signOut({
      headers: headersWithCookie(name, value),
      returnHeaders: true,
    });

    // Session should no longer validate
    const sessionAfter = await auth.api.getSession({
      headers: headersWithCookie(name, value),
    });
    expect(sessionAfter).toBeNull();
  });
});
