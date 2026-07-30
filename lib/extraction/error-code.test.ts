// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  classifyAnthropicError,
  extractionErrorMessage,
} from "./error-code";

function err(message: string, status?: number) {
  return Object.assign(new Error(message), { status });
}

describe("classifyAnthropicError", () => {
  it("maps 401 → auth", () => {
    expect(classifyAnthropicError(err("Unauthorized", 401))).toBe("auth");
  });

  it("maps 400 + credit balance message → credit", () => {
    const e = err(
      "Your credit balance is too low to access the Anthropic API.",
      400,
    );
    expect(classifyAnthropicError(e)).toBe("credit");
  });

  it("maps 400 + credit balance message (mixed case) → credit", () => {
    const e = err("Your CREDIT BALANCE is too low.", 400);
    expect(classifyAnthropicError(e)).toBe("credit");
  });

  it("maps 400 without credit phrase → unknown (no mislabel)", () => {
    expect(classifyAnthropicError(err("bad request", 400))).toBe("unknown");
  });

  it("maps 429 → rate_limited", () => {
    expect(classifyAnthropicError(err("rate limited", 429))).toBe(
      "rate_limited",
    );
  });

  it("maps 404 → model_unavailable", () => {
    expect(classifyAnthropicError(err("not found", 404))).toBe(
      "model_unavailable",
    );
  });

  it("maps 413 → too_large", () => {
    expect(classifyAnthropicError(err("payload too large", 413))).toBe(
      "too_large",
    );
  });

  it("maps a plain Error (no status) → unknown", () => {
    expect(classifyAnthropicError(new Error("boom"))).toBe("unknown");
  });

  it("maps null → unknown", () => {
    expect(classifyAnthropicError(null)).toBe("unknown");
  });

  it("maps undefined → unknown", () => {
    expect(classifyAnthropicError(undefined)).toBe("unknown");
  });
});

describe("extractionErrorMessage", () => {
  it("returns the auth message", () => {
    expect(extractionErrorMessage("auth")).toBe("Invalid API key");
  });

  it("returns the credit message", () => {
    expect(extractionErrorMessage("credit")).toBe(
      "No Anthropic credit — top up at console.anthropic.com",
    );
  });

  it("returns the rate_limited message", () => {
    expect(extractionErrorMessage("rate_limited")).toBe(
      "Rate limit reached — try again later",
    );
  });

  it("returns the model_unavailable message", () => {
    expect(extractionErrorMessage("model_unavailable")).toBe(
      "Model unavailable",
    );
  });

  it("returns the too_large message", () => {
    expect(extractionErrorMessage("too_large")).toBe(
      "Document too large to analyze",
    );
  });

  it("returns the generic message for unknown", () => {
    expect(extractionErrorMessage("unknown")).toBe(
      "Analysis failed. Please try again.",
    );
  });

  it("returns the generic message for null/undefined/legacy", () => {
    expect(extractionErrorMessage(null)).toBe(
      "Analysis failed. Please try again.",
    );
    expect(extractionErrorMessage(undefined)).toBe(
      "Analysis failed. Please try again.",
    );
    expect(extractionErrorMessage("some-legacy-code")).toBe(
      "Analysis failed. Please try again.",
    );
  });
});
