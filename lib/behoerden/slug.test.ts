// @vitest-environment node
import { describe, it, expect } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("converts u-umlaut to ue in state names", () => {
    // "Baden-Württemberg" — umlaut written as escape for source portability
    expect(slugify("Baden-W\u00fcrttemberg")).toBe("baden-wuerttemberg");
  });

  it("lower-cases and converts all umlauts (ae/oe/ue)", () => {
    // "ÄÖÜ" → "aeoeue"
    expect(slugify("\u00c4\u00d6\u00dc")).toBe("aeoeue");
  });

  it("strips soft hyphen U+00AD inside words", () => {
    // "Heirats\u00adurkunde" (discretionary hyphen) → "heiratsurkunde"
    expect(slugify("Heirats\u00adurkunde")).toBe("heiratsurkunde");
  });

  it("trims leading/trailing whitespace", () => {
    expect(slugify("   Bayern   ")).toBe("bayern");
  });

  it("converts eszett (\u00df) to ss", () => {
    // "Gro\u00df" → "gross"
    expect(slugify("Gro\u00df")).toBe("gross");
  });

  it("collapses multiple internal separators into a single dash", () => {
    expect(slugify("abc---def")).toBe("abc-def");
  });

  it("strips leading dashes", () => {
    expect(slugify("---abc")).toBe("abc");
  });

  it("strips trailing dashes", () => {
    expect(slugify("abc---")).toBe("abc");
  });

  it("is idempotent (slugify(slugify(x)) === slugify(x))", () => {
    const once = slugify("Bayern");
    expect(slugify(once)).toBe(once);
  });

  it("handles upper-case with umlauts (e.g. F\u00dcHRUNGSZEUGNIS)", () => {
    expect(slugify("F\u00dcHRUNGSZEUGNIS")).toBe("fuehrungszeugnis");
  });

  it("converts non-alphanumeric runs to a single dash", () => {
    expect(slugify("Baden W\u00fcrttemberg / Stadt")).toBe(
      "baden-wuerttemberg-stadt",
    );
  });
});
