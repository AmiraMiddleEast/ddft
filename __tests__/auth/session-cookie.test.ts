// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createTestDb } from "../_fixtures/test-db";
import { TEST_OPERATOR, parseCookie } from "../_fixtures/auth-helpers";

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

describe("AUTH-02 — session cookie persistence mechanism", () => {
  it("sign-in response sets a cookie with Max-Age (persistent cookie, survives browser close)", async () => {
    // returnHeaders pattern — see sign-in.test.ts for rationale.
    const result = await auth.api.signInEmail({
      body: {
        email: TEST_OPERATOR.email,
        password: TEST_OPERATOR.password,
      },
      returnHeaders: true,
    });
    const setCookie = result.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    const parsed = parseCookie(setCookie!);
    // A2 verification: cookie name is "better-auth.session_token" (default).
    expect(parsed.name).toMatch(/session/i);
    expect(parsed.name).toBe("better-auth.session_token");
    // Max-Age present means it's a persistent cookie (survives browser close) — AUTH-02 mechanism.
    const maxAge = parsed.attrs["max-age"];
    expect(maxAge).toBeTruthy();
    expect(typeof maxAge).toBe("string");
    // D-11: 30 days = 2592000 seconds
    expect(Number(maxAge)).toBeGreaterThan(60 * 60 * 24 * 7); // at least 7 days
    // And should be at or near 30 days
    expect(Number(maxAge)).toBeLessThanOrEqual(60 * 60 * 24 * 31);
  });

  it("cookie is httpOnly and SameSite (security hardening)", async () => {
    const result = await auth.api.signInEmail({
      body: {
        email: TEST_OPERATOR.email,
        password: TEST_OPERATOR.password,
      },
      returnHeaders: true,
    });
    const setCookie = result.headers.get("set-cookie")!;
    const parsed = parseCookie(setCookie);
    expect(parsed.attrs["httponly"]).toBe(true);
    expect(String(parsed.attrs["samesite"] ?? "").toLowerCase()).toMatch(
      /lax|strict/
    );
  });
});
