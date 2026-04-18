// @vitest-environment node
import { describe, it, expect } from "vitest";
import { renderLaufliste } from "./render";
import type { LauflisteInput } from "../types";
import {
  BUNDESVERWALTUNGSAMT_KOELN,
  BUNDESAMT_FUER_JUSTIZ_BONN,
} from "../endbeglaubigung";
import { UAE_EMBASSY_BERLIN } from "../embassy";

function makeInput(): LauflisteInput {
  return {
    person: {
      name: "Dr. Müller Özgür Weiß",
      birthdate: "01.03.1985",
    },
    generatedAt: new Date("2026-04-17T10:00:00Z"),
    cogs: null,
    documents: [
      {
        position: 1,
        dokumentart: "Geburtsurkunde",
        ausstellendeBehoerde: "Standesamt München",
        ausstellungsort: "München",
        ausstellungsdatum: "15.04.1985",
        vollerName: "Dr. Müller Özgür Weiß",
        vorbeglaubigung: {
          kind: "authority",
          authority: {
            name: "Landgericht München I",
            address: ["Prielmayerstraße 7", "80335 München"],
            phone: "+49 89 5597-0",
            email: null,
            website: null,
            officeHours: "Mo–Fr 08:00–15:00",
            notes: null,
          },
          needsReview: true,
          specialRules:
            "Beglaubigung durch Präsidenten des Landgerichts erforderlich.",
        },
        endbeglaubigung: BUNDESVERWALTUNGSAMT_KOELN,
        legalisation: UAE_EMBASSY_BERLIN,
      },
      {
        position: 2,
        dokumentart: "Führungszeugnis",
        ausstellendeBehoerde: "Bundesamt für Justiz",
        ausstellungsort: "Bonn",
        ausstellungsdatum: "10.03.2026",
        vollerName: "Dr. Müller Özgür Weiß",
        vorbeglaubigung: { kind: "exception-apostille" },
        endbeglaubigung: BUNDESAMT_FUER_JUSTIZ_BONN,
        legalisation: null,
      },
      {
        position: 3,
        dokumentart: "Reisepass",
        ausstellendeBehoerde: "Bürgerbüro München",
        ausstellungsort: "München",
        ausstellungsdatum: "22.07.2022",
        vollerName: "Dr. Müller Özgür Weiß",
        vorbeglaubigung: { kind: "exception-reisepass" },
        endbeglaubigung: null,
        legalisation: null,
      },
    ],
  };
}

describe("renderLaufliste", () => {
  it("returns a Buffer starting with the %PDF- magic bytes", async () => {
    const buf = await renderLaufliste(makeInput());
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.slice(0, 5).toString("latin1")).toBe("%PDF-");
    // Spot-check raw bytes match the PDF signature per ISO 32000.
    expect([
      buf[0],
      buf[1],
      buf[2],
      buf[3],
      buf[4],
    ]).toEqual([0x25, 0x50, 0x44, 0x46, 0x2d]);
  }, 30_000);

  it("produces a non-trivial PDF (> 1 KB) for a 3-document input", async () => {
    const buf = await renderLaufliste(makeInput());
    expect(buf.byteLength).toBeGreaterThan(1024);
  }, 30_000);

  it("handles exception routing (Führungszeugnis + Reisepass) without throwing", async () => {
    await expect(renderLaufliste(makeInput())).resolves.toBeInstanceOf(Buffer);
  }, 30_000);
});
