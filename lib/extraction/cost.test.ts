// @vitest-environment node
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { computeCostEur } from "./cost";

describe("computeCostEur", () => {
  const prev = process.env.USD_TO_EUR;
  beforeEach(() => {
    process.env.USD_TO_EUR = "0.92";
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.USD_TO_EUR;
    else process.env.USD_TO_EUR = prev;
  });

  it("computes Sonnet 4 cost in EUR", () => {
    // 10k input × $3/MTok = $0.03; 500 output × $15/MTok = $0.0075; total $0.0375; × 0.92 = 0.0345
    const c = computeCostEur("claude-sonnet-4-20250514", 10_000, 500);
    expect(c).toBeCloseTo(0.0345, 6);
  });

  it("returns 0 for an unknown model (no fabricated price)", () => {
    expect(computeCostEur("not-a-real-model", 10_000, 500)).toBe(0);
  });
});
