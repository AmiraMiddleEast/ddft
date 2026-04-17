// @vitest-environment node
import { describe, it, expect } from "vitest";
import { parseExtractionResponse } from "./schema";

const VALID = `<result>
{
  "dokumenten_typ":        { "value": "Geburtsurkunde", "confidence": "high", "reasoning": "title match" },
  "ausstellende_behoerde": { "value": "Standesamt München", "confidence": "high", "reasoning": "ok" },
  "ausstellungsort":       { "value": "München", "confidence": "high", "reasoning": "ok" },
  "bundesland":            { "value": "Bayern", "confidence": "medium", "reasoning": "inferred from München" },
  "ausstellungsdatum":     { "value": "2020-01-15", "confidence": "high", "reasoning": "stamped date" },
  "voller_name":           { "value": "Max Mustermann", "confidence": "high", "reasoning": "header line" }
}
</result>`;

describe("parseExtractionResponse", () => {
  it("parses a valid 6-field response", () => {
    const r = parseExtractionResponse(VALID);
    expect(r.dokumenten_typ.value).toBe("Geburtsurkunde");
    expect(r.bundesland.confidence).toBe("medium");
    expect(r.ausstellungsdatum.value).toBe("2020-01-15");
  });

  it("tolerates a ```json fence inside <result>", () => {
    const inner = VALID.match(/<result>([\s\S]*?)<\/result>/)![1];
    const wrapped = `<result>\n\`\`\`json\n${inner}\n\`\`\`\n</result>`;
    const r = parseExtractionResponse(wrapped);
    expect(r.voller_name.value).toBe("Max Mustermann");
  });

  it("accepts null values with low confidence (D-12)", () => {
    const raw = VALID.replace(
      '"value": "Max Mustermann", "confidence": "high"',
      '"value": null, "confidence": "low"',
    );
    const r = parseExtractionResponse(raw);
    expect(r.voller_name.value).toBeNull();
    expect(r.voller_name.confidence).toBe("low");
  });

  it("rejects invalid confidence", () => {
    const raw = VALID.replace('"confidence": "high"', '"confidence": "certain"');
    expect(() => parseExtractionResponse(raw)).toThrow();
  });

  it("rejects bad date format", () => {
    const raw = VALID.replace('"value": "2020-01-15"', '"value": "15.01.2020"');
    expect(() => parseExtractionResponse(raw)).toThrow();
  });
});
