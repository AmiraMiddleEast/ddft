// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { sha256Hex } from "./hash";
import { validatePdf } from "./pdf-validate";

describe("sha256Hex", () => {
  it("returns the known SHA-256 for an empty buffer", async () => {
    const h = await sha256Hex(new Uint8Array(0));
    expect(h).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("is deterministic across calls and returns a 64-char lowercase hex string", async () => {
    const a = await sha256Hex(new TextEncoder().encode("hello"));
    const b = await sha256Hex(new TextEncoder().encode("hello"));
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces different digests for different inputs", async () => {
    const a = await sha256Hex(new TextEncoder().encode("foo"));
    const b = await sha256Hex(new TextEncoder().encode("bar"));
    expect(a).not.toBe(b);
  });
});

describe("validatePdf", () => {
  it("accepts a real PDF (transcript.pdf fixture)", async () => {
    const bytes = await readFile(path.resolve(process.cwd(), "transcript.pdf"));
    const res = await validatePdf(new Uint8Array(bytes));
    expect(res).toEqual({ ok: true });
  });

  it("rejects garbage bytes as invalid_pdf", async () => {
    const res = await validatePdf(new TextEncoder().encode("XXXXnot-a-pdf"));
    expect(res).toEqual({ ok: false, reason: "invalid_pdf" });
  });

  it("rejects a buffer shorter than 5 bytes as invalid_pdf", async () => {
    const res = await validatePdf(new Uint8Array([0x25, 0x50]));
    expect(res).toEqual({ ok: false, reason: "invalid_pdf" });
  });

  it("rejects a password-protected PDF as encrypted_pdf", async () => {
    const fixturePath = path.resolve(
      process.cwd(),
      "__fixtures__/encrypted.pdf",
    );
    const bytes = await readFile(fixturePath);
    const res = await validatePdf(new Uint8Array(bytes));
    expect(res).toEqual({ ok: false, reason: "encrypted_pdf" });
  });
});
