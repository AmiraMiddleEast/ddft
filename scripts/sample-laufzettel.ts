/**
 * Generate a sample Laufzettel PDF to verify the Phase 6 DDFT layout works.
 * Usage: npx tsx scripts/sample-laufzettel.ts
 * Output: .planning/phases/06-cogs-and-new-laufzettel/sample-laufzettel.pdf
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { renderLaufliste } from "@/lib/laufliste/pdf/render";
import {
  BUNDESVERWALTUNGSAMT_KOELN,
} from "@/lib/laufliste/endbeglaubigung";
import { UAE_EMBASSY_BERLIN } from "@/lib/laufliste/embassy";
import type { LauflisteInput } from "@/lib/laufliste/types";

const input: LauflisteInput = {
  person: {
    name: "Dr. med. dent. Sandra Maria Hertel",
    birthdate: "03.05.1989",
  },
  generatedAt: new Date(),
  cogs: {
    beruf: "zahnarzt",
    berufLabel: "Zahnärztin / Zahnarzt",
    maßgeblichesBundesland: { key: "BE", name: "Berlin" },
    routingSource: "arbeitsort",
    nrwSubregion: null,
    kammerName: "Zahnärztekammer Berlin",
    zustaendigeStelle: "Landesamt für Gesundheit und Soziales Berlin (LAGeSo)",
    zustaendigeStelleHinweis:
      "Die Zahnärztekammer stellt eine Mitgliedschaftsbescheinigung aus; das eigentliche Certificate of Good Standing wird durch das LAGeSo ausgestellt.",
    fuehrungszeugnisOEmpfaenger:
      "Zahnärztekammer Berlin, Stallstraße 1, 10585 Berlin",
    antragsverfahren:
      "Schriftlicher Antrag per Post an das LAGeSo. Das Antragsformular ist online verfügbar.",
    erforderlicheDokumente: [
      "Ausgefülltes Antragsformular",
      "Approbationsurkunde (beglaubigte Kopie)",
      "Nachweis der Tätigkeit in Berlin",
      "Namensänderungsurkunde (falls zutreffend)",
    ],
    directUrlGoodStanding:
      "https://www.berlin.de/lageso/gesundheit/berufe-im-gesundheitswesen/",
    kontaktEmail: "bqfg@lageso.berlin.de",
    kontaktTelefon: "(030) 90229-2114",
    kontaktAdresse:
      "LAGeSo, Turmstraße 21, 10559 Berlin",
    besonderheiten:
      "Die Bescheinigung ist nur 3 Monate gültig. Die Gebührenhöhe richtet sich nach der aktuellen Gebührenordnung.",
    datenVollstaendig: true,
  },
  documents: [
    {
      position: 1,
      dokumentart: "Approbationsurkunde",
      ausstellendeBehoerde: "Landesamt für Gesundheit und Soziales Berlin",
      ausstellungsort: "Berlin",
      ausstellungsdatum: "26.02.2015",
      vollerName: "Sandra Maria Hertel",
      vorbeglaubigung: {
        kind: "authority",
        authority: {
          name: "Senatsverwaltung für Wissenschaft, Gesundheit und Pflege Berlin",
          address: ["Oranienstraße 106", "10969 Berlin"],
          phone: "030 9028-0",
          email: "post@senwgpg.berlin.de",
          website: "www.berlin.de/sen/wgp",
          officeHours: "Montag–Freitag: 08:30–15:30 Uhr",
          notes: null,
        },
        needsReview: false,
        specialRules: null,
      },
      endbeglaubigung: BUNDESVERWALTUNGSAMT_KOELN,
      legalisation: UAE_EMBASSY_BERLIN,
    },
    {
      position: 2,
      dokumentart: "Geburtsurkunde",
      ausstellendeBehoerde: "Standesamt Charlottenburg von Berlin",
      ausstellungsort: "Berlin",
      ausstellungsdatum: "11.02.2016",
      vollerName: "Sandra Maria Hertel",
      vorbeglaubigung: {
        kind: "authority",
        authority: {
          name: "Landesamt für Bürger- und Ordnungsangelegenheiten (LABO)",
          address: ["Friedrichstraße 219", "10969 Berlin"],
          phone: "030 90269-0",
          email: "post@labo.berlin.de",
          website: "www.berlin.de/labo",
          officeHours: "Montag–Freitag: 08:00–14:00 Uhr",
          notes: null,
        },
        needsReview: false,
        specialRules: null,
      },
      endbeglaubigung: BUNDESVERWALTUNGSAMT_KOELN,
      legalisation: UAE_EMBASSY_BERLIN,
    },
    {
      position: 3,
      dokumentart: "Fachzahnarztanerkennung Kieferorthopädie",
      ausstellendeBehoerde: "Landeszahnärztekammer Brandenburg",
      ausstellungsort: "Cottbus",
      ausstellungsdatum: "07.05.2021",
      vollerName: "Sandra Maria Hertel",
      vorbeglaubigung: {
        kind: "authority",
        authority: {
          name: "Ministerium für Soziales, Gesundheit, Integration und Verbraucherschutz Brandenburg",
          address: ["Henning-von-Tresckow-Straße 2–13", "14467 Potsdam"],
          phone: "0331 866-0",
          email: "poststelle@masgf.brandenburg.de",
          website: "www.masgf.brandenburg.de",
          officeHours: null,
          notes: null,
        },
        needsReview: false,
        specialRules: null,
      },
      endbeglaubigung: BUNDESVERWALTUNGSAMT_KOELN,
      legalisation: UAE_EMBASSY_BERLIN,
    },
    {
      position: 4,
      dokumentart: "Reisepass",
      ausstellendeBehoerde: "Passbehörde Berlin",
      ausstellungsort: "Berlin",
      ausstellungsdatum: "20.04.2018",
      vollerName: "Sandra Maria Hertel",
      vorbeglaubigung: { kind: "exception-reisepass" },
      endbeglaubigung: null,
      legalisation: null,
    },
  ],
};

async function main(): Promise<void> {
  console.log("[sample] rendering laufzettel…");
  const { buffer } = await renderLaufliste(input);
  const outDir = ".planning/phases/06-cogs-and-new-laufzettel";
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "sample-laufzettel.pdf");
  await writeFile(outPath, Buffer.from(buffer));
  console.log(`[sample] wrote ${outPath} (${buffer.byteLength} bytes)`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
