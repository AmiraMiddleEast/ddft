// @vitest-environment node
import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";

describe("scripts/seed-user.ts guards", () => {
  it("exits non-zero when SEED_EMAIL and SEED_PASSWORD are missing", () => {
    let exitCode = 0;
    try {
      execSync("npx tsx scripts/seed-user.ts", {
        env: { ...process.env, SEED_EMAIL: "", SEED_PASSWORD: "" },
        stdio: "pipe",
      });
    } catch (e) {
      const err = e as { status?: number };
      exitCode = err.status ?? 1;
    }
    expect(exitCode).not.toBe(0);
  });

  it("exits non-zero when password is shorter than 12 chars", () => {
    let exitCode = 0;
    let stderr = "";
    try {
      execSync("npx tsx scripts/seed-user.ts", {
        env: {
          ...process.env,
          SEED_EMAIL: "guard-test@example.com",
          SEED_PASSWORD: "shortpass", // 9 chars
        },
        stdio: "pipe",
      });
    } catch (e) {
      const err = e as { status?: number; stderr?: Buffer };
      exitCode = err.status ?? 1;
      stderr = err.stderr?.toString() ?? "";
    }
    expect(exitCode).not.toBe(0);
    expect(stderr).toMatch(/at least 12 characters/i);
  });
});
