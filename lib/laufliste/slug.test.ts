// @vitest-environment node
import { describe, it, expect } from "vitest";
import { slugifyPersonName } from "./slug";
import {
  endbeglaubigungFor,
  BUNDESVERWALTUNGSAMT_KOELN,
  BUNDESAMT_FUER_JUSTIZ_BONN,
} from "./endbeglaubigung";

describe("slugifyPersonName", () => {
  it("expands German umlauts + ß and lowercases", () => {
    expect(slugifyPersonName("Müller Özgür Weiß")).toBe("mueller-oezguer-weiss");
  });

  it("strips punctuation and collapses whitespace to single dashes", () => {
    expect(slugifyPersonName("Dr. Anna-Maria Schmidt")).toBe(
      "dr-anna-maria-schmidt",
    );
  });

  it("returns 'unbekannt' for empty input", () => {
    expect(slugifyPersonName("")).toBe("unbekannt");
  });

  it("returns 'unbekannt' for punctuation-only input", () => {
    expect(slugifyPersonName("---")).toBe("unbekannt");
    expect(slugifyPersonName("!!!")).toBe("unbekannt");
  });

  it("handles uppercase umlauts", () => {
    expect(slugifyPersonName("ÄÖÜ ßäöü")).toBe("aeoeue-ssaeoeue");
  });
});

describe("endbeglaubigungFor", () => {
  it("returns BfJ Bonn for Führungszeugnis (exact)", () => {
    expect(endbeglaubigungFor("Führungszeugnis")).toBe(
      BUNDESAMT_FUER_JUSTIZ_BONN,
    );
  });

  it("returns BfJ Bonn for Führungszeugnis (case-insensitive substring)", () => {
    expect(endbeglaubigungFor("führungszeugnis nach §30 BZRG")).toBe(
      BUNDESAMT_FUER_JUSTIZ_BONN,
    );
  });

  it("returns BVA Köln for Geburtsurkunde", () => {
    expect(endbeglaubigungFor("Geburtsurkunde")).toBe(
      BUNDESVERWALTUNGSAMT_KOELN,
    );
  });

  it("returns BVA Köln for Heiratsurkunde", () => {
    expect(endbeglaubigungFor("Heiratsurkunde")).toBe(
      BUNDESVERWALTUNGSAMT_KOELN,
    );
  });
});
