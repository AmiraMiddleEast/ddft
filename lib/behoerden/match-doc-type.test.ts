// @vitest-environment node
//
// matchDocType — maps Claude's verbose free-text doc-type into a dropdown
// option. Pure function; no DB.

import { describe, it, expect } from "vitest";

import { matchDocType, type DocTypeOption } from "./match-doc-type";

const OPTIONS: DocTypeOption[] = [
  { id: "approbationsurkunde", displayName: "Approbationsurkunde / Berufserlaubnis Arzt" },
  { id: "facharztanerkennung", displayName: "Facharztanerkennung / Weiterbildungsurkunde" },
  {
    id: "fachzahnarztanerkennung",
    displayName: "Fachzahnarztanerkennung / Weiterbildungsurkunde",
  },
  { id: "promotionsurkunde", displayName: "Promotionsurkunde" },
  { id: "universitaetsdiplom", displayName: "Universitätsdiplom / Hochschulzeugnis" },
  { id: "geburtsurkunde", displayName: "Geburtsurkunde" },
  { id: "heiratsurkunde", displayName: "Heiratsurkunde" },
  { id: "fuehrungszeugnis", displayName: "Führungszeugnis" },
];

describe("matchDocType", () => {
  it("maps the real Fachzahnärztin extraction to fachzahnarztanerkennung", () => {
    const r = matchDocType(
      "Urkunde (Anerkennung der Weiterbildung zur Fachzahnärztin)",
      OPTIONS,
    );
    expect(r?.id).toBe("fachzahnarztanerkennung");
  });

  it("maps a Facharzt (non-dental) Weiterbildung to facharztanerkennung", () => {
    const r = matchDocType(
      "Anerkennung der Weiterbildung zur Fachärztin für Innere Medizin",
      OPTIONS,
    );
    expect(r?.id).toBe("facharztanerkennung");
  });

  it("Fachzahnarzt rule wins over Facharzt for a dental Weiterbildung", () => {
    const r = matchDocType("Weiterbildung zur Zahnärztin", OPTIONS);
    expect(r?.id).toBe("fachzahnarztanerkennung");
  });

  it("maps an Approbation phrase to approbationsurkunde", () => {
    const r = matchDocType("Approbationsurkunde als Ärztin", OPTIONS);
    expect(r?.id).toBe("approbationsurkunde");
  });

  it("matches an exact display name (already normalized)", () => {
    const r = matchDocType("Fachzahnarztanerkennung / Weiterbildungsurkunde", OPTIONS);
    expect(r?.id).toBe("fachzahnarztanerkennung");
  });

  it("maps a plain single-word type via exact/keyword match", () => {
    expect(matchDocType("Geburtsurkunde", OPTIONS)?.id).toBe("geburtsurkunde");
    expect(matchDocType("Heiratsurkunde (beglaubigte Abschrift)", OPTIONS)?.id).toBe(
      "heiratsurkunde",
    );
  });

  it("recovers from a typo via the fuzzy fallback", () => {
    expect(matchDocType("Geburturkunde", OPTIONS)?.id).toBe("geburtsurkunde");
  });

  it("returns null for unclassifiable free text (forces manual pick)", () => {
    expect(matchDocType("Sonstiges Schriftstück XYZ", OPTIONS)).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(matchDocType("", OPTIONS)).toBeNull();
    expect(matchDocType("   ", OPTIONS)).toBeNull();
  });

  it("returns null when the matched id is not among the options", () => {
    // Universität keyword maps to universitaetsdiplom; drop it from options.
    const without = OPTIONS.filter((o) => o.id !== "universitaetsdiplom");
    expect(matchDocType("Universitätsdiplom der Medizin", without)).toBeNull();
  });
});
