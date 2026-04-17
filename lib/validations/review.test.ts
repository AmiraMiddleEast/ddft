// @vitest-environment node
import { describe, it, expect } from "vitest";

import {
  ApproveSchema,
  CorrectedFieldsSchema,
  ChooseAuthoritySchema,
  type CorrectedFields,
} from "./review";

const validCorrected: CorrectedFields = {
  dokumenten_typ: "Geburtsurkunde",
  ausstellende_behoerde: "Standesamt Muenchen",
  ausstellungsort: "Muenchen",
  bundesland: "Bayern",
  ausstellungsdatum: "2020-01-15",
  voller_name: "Max Mustermann",
};

describe("ApproveSchema", () => {
  it("accepts a valid payload", () => {
    const r = ApproveSchema.safeParse({
      documentId: "doc-1",
      corrected: validCorrected,
    });
    expect(r.success).toBe(true);
  });

  it("rejects payload with missing documentId", () => {
    const r = ApproveSchema.safeParse({
      documentId: "",
      corrected: validCorrected,
    });
    expect(r.success).toBe(false);
  });

  it("rejects dokumenten_typ longer than 200 chars", () => {
    const r = ApproveSchema.safeParse({
      documentId: "doc-1",
      corrected: { ...validCorrected, dokumenten_typ: "a".repeat(201) },
    });
    expect(r.success).toBe(false);
  });

  it("rejects ausstellende_behoerde longer than 300 chars", () => {
    const r = ApproveSchema.safeParse({
      documentId: "doc-1",
      corrected: { ...validCorrected, ausstellende_behoerde: "a".repeat(301) },
    });
    expect(r.success).toBe(false);
  });

  it("rejects ausstellungsort longer than 200 chars", () => {
    const r = ApproveSchema.safeParse({
      documentId: "doc-1",
      corrected: { ...validCorrected, ausstellungsort: "a".repeat(201) },
    });
    expect(r.success).toBe(false);
  });

  it("rejects bundesland longer than 100 chars", () => {
    const r = ApproveSchema.safeParse({
      documentId: "doc-1",
      corrected: { ...validCorrected, bundesland: "a".repeat(101) },
    });
    expect(r.success).toBe(false);
  });

  it("rejects voller_name longer than 300 chars", () => {
    const r = ApproveSchema.safeParse({
      documentId: "doc-1",
      corrected: { ...validCorrected, voller_name: "a".repeat(301) },
    });
    expect(r.success).toBe(false);
  });

  it("accepts ausstellungsdatum as yyyy-MM-dd", () => {
    const r = ApproveSchema.safeParse({
      documentId: "doc-1",
      corrected: { ...validCorrected, ausstellungsdatum: "2024-12-31" },
    });
    expect(r.success).toBe(true);
  });

  it("accepts ausstellungsdatum as empty string", () => {
    const r = ApproveSchema.safeParse({
      documentId: "doc-1",
      corrected: { ...validCorrected, ausstellungsdatum: "" },
    });
    expect(r.success).toBe(true);
  });

  it("rejects ausstellungsdatum of 'not-a-date'", () => {
    const r = ApproveSchema.safeParse({
      documentId: "doc-1",
      corrected: { ...validCorrected, ausstellungsdatum: "not-a-date" },
    });
    expect(r.success).toBe(false);
  });

  it("rejects ausstellungsdatum of '2026/01/01' (wrong separator)", () => {
    const r = ApproveSchema.safeParse({
      documentId: "doc-1",
      corrected: { ...validCorrected, ausstellungsdatum: "2026/01/01" },
    });
    expect(r.success).toBe(false);
  });
});

describe("CorrectedFieldsSchema", () => {
  it("type has exactly the 6 FIELD_NAMES keys", () => {
    const keys = Object.keys(CorrectedFieldsSchema.shape).sort();
    expect(keys).toEqual(
      [
        "ausstellende_behoerde",
        "ausstellungsdatum",
        "ausstellungsort",
        "bundesland",
        "dokumenten_typ",
        "voller_name",
      ].sort(),
    );
  });
});

describe("ChooseAuthoritySchema", () => {
  it("accepts valid documentId + authorityId", () => {
    const r = ChooseAuthoritySchema.safeParse({
      documentId: "doc-1",
      authorityId: "auth-1",
    });
    expect(r.success).toBe(true);
  });

  it("rejects empty documentId", () => {
    const r = ChooseAuthoritySchema.safeParse({
      documentId: "",
      authorityId: "auth-1",
    });
    expect(r.success).toBe(false);
  });

  it("rejects empty authorityId", () => {
    const r = ChooseAuthoritySchema.safeParse({
      documentId: "doc-1",
      authorityId: "",
    });
    expect(r.success).toBe(false);
  });
});
