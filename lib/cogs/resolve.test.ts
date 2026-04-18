// @vitest-environment node
import { describe, expect, it } from "vitest";
import { computeLookupKey, determineEffectiveBl } from "./resolve";

describe("determineEffectiveBl", () => {
  it("uses arbeitsort when set", () => {
    expect(
      determineEffectiveBl({
        beruf: "arzt",
        arbeitsortBundesland: "BY",
        wohnsitzBundesland: "BE",
        nrwSubregion: null,
      }),
    ).toEqual({ key: "BY", used: "arbeitsort" });
  });

  it("falls back to wohnsitz when arbeitsort null (abroad)", () => {
    expect(
      determineEffectiveBl({
        beruf: "arzt",
        arbeitsortBundesland: null,
        wohnsitzBundesland: "HH",
        nrwSubregion: null,
      }),
    ).toEqual({ key: "HH", used: "wohnsitz" });
  });
});

describe("computeLookupKey", () => {
  it("returns raw key for non-NRW bundesländer", () => {
    expect(computeLookupKey("BY", null)).toEqual({ ok: true, key: "BY" });
    expect(computeLookupKey("TH", null)).toEqual({ ok: true, key: "TH" });
  });

  it("expands NRW + nordrhein → NW_NR", () => {
    expect(computeLookupKey("NW", "nordrhein")).toEqual({
      ok: true,
      key: "NW_NR",
    });
  });

  it("expands NRW + westfalen-lippe → NW_WL", () => {
    expect(computeLookupKey("NW", "westfalen-lippe")).toEqual({
      ok: true,
      key: "NW_WL",
    });
  });

  it("errors when NRW without subregion", () => {
    expect(computeLookupKey("NW", null)).toEqual({
      ok: false,
      reason: "nrw_subregion_missing",
    });
  });

  it("ignores subregion for non-NRW states", () => {
    expect(computeLookupKey("BY", "nordrhein")).toEqual({
      ok: true,
      key: "BY",
    });
  });
});
