import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createTestDb } from "../_fixtures/test-db";
import { TEST_OPERATOR } from "../_fixtures/auth-helpers";

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
  // Seed operator for this test DB
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

describe("AUTH-01 — sign in with email and password", () => {
  it("valid credentials succeed and issue a session cookie", async () => {
    // Use returnHeaders instead of asResponse — better-auth's Response object
    // does not expose Set-Cookie via Headers.get() in this runtime. The
    // returnHeaders shape gives us a Headers instance plus the parsed body.
    const result = await auth.api.signInEmail({
      body: {
        email: TEST_OPERATOR.email,
        password: TEST_OPERATOR.password,
      },
      returnHeaders: true,
    });
    expect(result.response).toBeTruthy();
    expect(result.response.user?.email).toBe(TEST_OPERATOR.email);
    // Headers carries a Set-Cookie on success
    const setCookie = result.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie).toMatch(/better-auth\.session_token=/);
  });

  it("invalid password returns 401 (or 400)", async () => {
    let status = 0;
    try {
      const res = await auth.api.signInEmail({
        body: {
          email: TEST_OPERATOR.email,
          password: "wrong-password-twelve",
        },
        asResponse: true,
      });
      status = res.status;
    } catch (err: unknown) {
      const e = err as { status?: number; statusCode?: number };
      status = e.status ?? e.statusCode ?? 401;
    }
    expect([400, 401]).toContain(status);
  });

  it("password shorter than 12 chars is rejected (D-14 enforced server-side)", async () => {
    let threw = false;
    try {
      await auth.api.signUpEmail({
        body: {
          email: "short@example.com",
          password: "short",
          name: "short",
        },
      });
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });
});
