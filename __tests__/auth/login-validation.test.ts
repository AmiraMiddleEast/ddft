import { describe, it, expect } from "vitest";
import { loginSchema } from "@/lib/validations/auth";

describe("loginSchema", () => {
  it("rejects invalid email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "x".repeat(12),
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path[0]).toBe("email");
  });

  it("rejects password shorter than 12 chars", () => {
    const result = loginSchema.safeParse({
      email: "ops@example.com",
      password: "short",
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0].path[0]).toBe("password");
  });

  it("accepts valid input (email + 12+ char password)", () => {
    const result = loginSchema.safeParse({
      email: "ops@example.com",
      password: "correcthorsebatterystaple",
    });
    expect(result.success).toBe(true);
  });
});
