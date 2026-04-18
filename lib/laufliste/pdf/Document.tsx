/**
 * Phase 4 + Phase 6 — Root React-PDF document for the Laufliste.
 *
 * Multi-page layout:
 *   1) Deckblatt mit DDFT-Branding
 *   2) Übersicht "Auf einen Blick"
 *   3) Sektion A — Certificate of Good Standing (4 Schritte) — optional
 *   4) Sektion B — Dokumenten-Ketten (pro Dokument)
 *   5) Abschluss-Seite mit DDFT-Kontakt
 *
 * Footer repeats on every page with brand + page number.
 */

import React from "react";
import { Document, Page, View, Text, Image } from "@react-pdf/renderer";
import path from "node:path";
import { DDFT_COLORS, styles } from "./styles";
import { DocumentSection } from "./sections";
import type { LauflisteInput, CogsSection, AuthorityBlock } from "../types";

function formatGeneratedAt(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getUTCFullYear());
  return `${dd}.${mm}.${yyyy}`;
}

const LOGO_PATH = path.resolve(process.cwd(), "public/ddft-logo.png");

function LogoOrWordmark() {
  // Try to embed the logo file; if the runtime cannot read it, fall back to a
  // wordmark. React-PDF resolves Image src at render time — if the file is
  // missing it will throw, so we guard by checking existence at module load.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    if (fs.existsSync(LOGO_PATH)) {
      // @react-pdf/renderer Image accepts absolute file paths on server.
      return <Image src={LOGO_PATH} style={styles.logo} />;
    }
  } catch {
    // ignore — fall through to wordmark
  }
  return (
    <Text style={{ ...styles.coverTitle, fontSize: 22, marginBottom: 18 }}>
      Dubai Docs Fast Track
    </Text>
  );
}

function Footer() {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerBrand}>Dubai Docs Fast Track</Text>
      <Text
        render={({ pageNumber, totalPages }) =>
          `Seite ${pageNumber} / ${totalPages}`
        }
      />
    </View>
  );
}

function BerufLabel(beruf: "arzt" | "zahnarzt"): string {
  return beruf === "arzt" ? "Ärztin / Arzt" : "Zahnärztin / Zahnarzt";
}

// ---------- Cover page ----------------------------------------------------

function CoverPage({ input }: { input: LauflisteInput }) {
  const createdAt = formatGeneratedAt(input.generatedAt);
  const berufText = input.cogs ? BerufLabel(input.cogs.beruf) : null;
  const mbl = input.cogs?.maßgeblichesBundesland.name ?? null;
  return (
    <Page size="A4" style={styles.coverPage}>
      <LogoOrWordmark />

      <Text style={styles.coverTitle}>Laufzettel</Text>
      <Text style={styles.coverSubtitle}>
        Legalisation für die Vereinigten Arabischen Emirate
      </Text>

      <View style={styles.cyanBar} />

      <View style={styles.coverBlock}>
        <Text style={styles.coverLabel}>Person</Text>
        <Text style={styles.coverValue}>
          {input.person.name || "— nicht hinterlegt"}
        </Text>

        {berufText ? (
          <>
            <Text style={styles.coverLabel}>Beruf</Text>
            <Text style={styles.coverValue}>{berufText}</Text>
          </>
        ) : null}

        {mbl ? (
          <>
            <Text style={styles.coverLabel}>
              Maßgebliches Bundesland für das Certificate of Good Standing
            </Text>
            <Text style={styles.coverValue}>
              {mbl}
              {input.cogs?.nrwSubregion
                ? ` · ${input.cogs.nrwSubregion === "nordrhein" ? "Nordrhein" : "Westfalen-Lippe"}`
                : ""}
            </Text>
          </>
        ) : null}

        <Text style={styles.coverLabel}>Erstellt am</Text>
        <Text style={styles.coverValue}>{createdAt}</Text>

        <Text style={styles.coverLabel}>Dokumente insgesamt</Text>
        <Text style={styles.coverValue}>{String(input.documents.length)}</Text>
      </View>

      <Text style={{ ...styles.body, marginTop: 16 }}>
        Dieser Laufzettel enthält zwei parallele Prozesse:
      </Text>
      <Text style={{ ...styles.body, marginLeft: 12, marginTop: 6 }}>
        <Text style={styles.emphasis}>A) Certificate of Good Standing</Text>
        {"  "}— Ihre berufliche Unbedenklichkeitsbescheinigung.
      </Text>
      <Text style={{ ...styles.body, marginLeft: 12, marginTop: 2 }}>
        <Text style={styles.emphasis}>B) Dokumenten-Legalisation</Text>
        {"  "}— die Beglaubigungskette jeder einzelnen Urkunde.
      </Text>
      <Footer />
    </Page>
  );
}

// ---------- Overview ------------------------------------------------------

function OverviewPage({ input }: { input: LauflisteInput }) {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.h1}>Auf einen Blick</Text>
      <Text style={styles.sectionIntro}>
        Nutzen Sie diese Übersicht, um Ihren Fortschritt zu verfolgen.
      </Text>

      {input.cogs ? (
        <View style={styles.overviewTable}>
          <Text style={{ ...styles.h3, marginBottom: 6 }}>
            A — Certificate of Good Standing
          </Text>
          {[
            "Führungszeugnis Belegart O beim Bürgeramt beantragen",
            "Antrag Certificate of Good Standing bei zuständiger Stelle",
            "Apostille/Legalisation (BVA Köln + VAE-Botschaft Berlin)",
            "Übersetzung durch vereidigten Übersetzer",
          ].map((label, i) => (
            <View key={i} style={styles.overviewRow}>
              <View style={styles.checkbox} />
              <Text style={styles.body}>
                <Text style={{ ...styles.emphasis, color: DDFT_COLORS.cyan }}>
                  {String(i + 1)}.{"  "}
                </Text>
                {label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.overviewTable}>
        <Text style={{ ...styles.h3, marginBottom: 6 }}>
          B — Dokumente ({input.documents.length})
        </Text>
        {input.documents.map((d, i) => (
          <View key={i} style={styles.overviewRow}>
            <View style={styles.checkbox} />
            <Text style={styles.body}>
              <Text style={{ ...styles.emphasis, color: DDFT_COLORS.cyan }}>
                {String(i + 1)}.{"  "}
              </Text>
              {d.dokumentart}
              {d.vorbeglaubigung.kind === "exception-reisepass" ? (
                <Text style={styles.muted}> · keine Legalisation</Text>
              ) : d.vorbeglaubigung.kind === "exception-apostille" ? (
                <Text style={styles.muted}> · Apostille (BfJ)</Text>
              ) : null}
            </Text>
          </View>
        ))}
      </View>
      <Footer />
    </Page>
  );
}

// ---------- CoGS Section --------------------------------------------------

function renderAuthorityBlock(a: AuthorityBlock | null) {
  if (!a) return null;
  return (
    <View style={{ marginTop: 4 }}>
      <Text style={{ ...styles.body, ...styles.emphasis }}>{a.name}</Text>
      {a.address.map((line, i) => (
        <Text key={i} style={styles.body}>
          {line}
        </Text>
      ))}
      {a.phone ? (
        <Text style={styles.body}>
          <Text style={styles.emphasis}>Telefon: </Text>
          {a.phone}
        </Text>
      ) : null}
      {a.email ? (
        <Text style={styles.body}>
          <Text style={styles.emphasis}>E-Mail: </Text>
          {a.email}
        </Text>
      ) : null}
      {a.website ? (
        <Text style={styles.body}>
          <Text style={styles.emphasis}>Webseite: </Text>
          {a.website}
        </Text>
      ) : null}
      {a.officeHours ? (
        <Text style={styles.body}>
          <Text style={styles.emphasis}>Öffnungszeiten: </Text>
          {a.officeHours}
        </Text>
      ) : null}
      {a.notes ? <Text style={styles.caption}>{a.notes}</Text> : null}
    </View>
  );
}

function CogsStep({
  num,
  title,
  children,
}: {
  num: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.step} wrap={false}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepNumber}>{num}.</Text>
        <Text style={styles.stepTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function CogsSectionPage({ cogs }: { cogs: CogsSection }) {
  const bvaAddress: AuthorityBlock = {
    name: "Bundesverwaltungsamt (BVA) — Referat für Legalisation",
    address: ["Barbarastraße 1", "50735 Köln"],
    phone: "+49 22899 358-0",
    email: "poststelle@bva.bund.de",
    website: "www.bva.bund.de",
    officeHours: null,
    notes: null,
  };
  const uaeEmbassy: AuthorityBlock = {
    name: "Botschaft der Vereinigten Arabischen Emirate",
    address: ["Hiroshimastraße 18–20", "10785 Berlin"],
    phone: "030 516 516",
    email: "berlinemb.amo@mofaic.gov.ae",
    website: "www.uae-embassy.de",
    officeHours: "Montag–Freitag: 10:00–15:00 Uhr",
    notes: null,
  };

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.sectionTitle}>
        Sektion A — Certificate of Good Standing
      </Text>
      <View style={styles.sectionUnderline} />
      <Text style={styles.sectionIntro}>
        Ihre berufliche Unbedenklichkeitsbescheinigung für die Tätigkeit in den
        Vereinigten Arabischen Emiraten. Der Ablauf umfasst vier aufeinander
        folgende Schritte.
      </Text>

      {!cogs.datenVollstaendig ? (
        <View style={styles.warnBanner}>
          <Text style={{ ...styles.body, ...styles.emphasis }}>
            Hinweis: Das genaue Antragsverfahren ist für dieses Bundesland
            nicht online veröffentlicht.
          </Text>
          <Text style={styles.body}>
            Bitte kontaktieren Sie die zuständige Stelle direkt{" "}
            {cogs.kontaktTelefon ? `unter ${cogs.kontaktTelefon}` : ""}{" "}
            {cogs.kontaktEmail ? `oder per E-Mail an ${cogs.kontaktEmail}` : ""}
            .
          </Text>
        </View>
      ) : null}

      {/* Step 1 — FZ-O */}
      <CogsStep num={1} title="Führungszeugnis Belegart O beantragen">
        <Text style={styles.body}>
          Beantragen Sie das Führungszeugnis bei der Meldebehörde
          (Bürgeramt / Einwohnermeldeamt) an Ihrem Wohnort.
        </Text>
        <Text style={{ ...styles.body, marginTop: 4 }}>
          <Text style={styles.emphasis}>Online: </Text>
          www.fuehrungszeugnis.bund.de (elektronischer Personalausweis +
          AusweisApp)
        </Text>
        <Text style={styles.body}>
          <Text style={styles.emphasis}>Persönlich: </Text>
          Bürgeramt Ihres Wohnorts (Personalausweis oder Reisepass)
        </Text>
        <Text style={{ ...styles.body, marginTop: 6 }}>
          Geben Sie bei der Beantragung unbedingt an:
        </Text>
        <Text style={{ ...styles.body, marginLeft: 10 }}>
          • Belegart:{" "}
          <Text style={styles.emphasis}>O</Text> (zur Vorlage bei einer
          deutschen Behörde)
        </Text>
        <Text style={{ ...styles.body, marginLeft: 10 }}>
          • Verwendungszweck: Certificate of Good Standing /
          Unbedenklichkeitsbescheinigung
        </Text>
        <Text style={{ ...styles.body, marginLeft: 10 }}>
          • Empfängerbehörde (das Zeugnis wird direkt dorthin geschickt —{" "}
          <Text style={styles.emphasis}>nicht an Sie</Text>):
        </Text>
        <View style={{ ...styles.infoBanner, marginLeft: 10, marginTop: 4 }}>
          <Text style={{ ...styles.body, ...styles.emphasis }}>
            {cogs.fuehrungszeugnisOEmpfaenger}
          </Text>
        </View>
      </CogsStep>

      {/* Step 2 — CoGS application */}
      <CogsStep
        num={2}
        title={`Antrag Certificate of Good Standing bei ${cogs.zustaendigeStelle}`}
      >
        {cogs.zustaendigeStelleHinweis ? (
          <Text style={{ ...styles.caption, marginBottom: 4 }}>
            {cogs.zustaendigeStelleHinweis}
          </Text>
        ) : null}
        {cogs.antragsverfahren ? (
          <Text style={styles.body}>{cogs.antragsverfahren}</Text>
        ) : null}
        {cogs.erforderlicheDokumente.length > 0 ? (
          <>
            <Text style={{ ...styles.body, marginTop: 6 }}>
              <Text style={styles.emphasis}>Erforderliche Dokumente:</Text>
            </Text>
            {cogs.erforderlicheDokumente.map((doc, i) => (
              <Text key={i} style={{ ...styles.body, marginLeft: 10 }}>
                • {doc}
              </Text>
            ))}
          </>
        ) : null}
        {cogs.directUrlGoodStanding ? (
          <Text style={{ ...styles.body, marginTop: 6 }}>
            <Text style={styles.emphasis}>Antragsformular / Info: </Text>
            {cogs.directUrlGoodStanding}
          </Text>
        ) : null}
        <View style={{ marginTop: 8 }}>
          <Text style={{ ...styles.body, ...styles.emphasis }}>Kontakt:</Text>
          {cogs.kontaktAdresse
            ? cogs.kontaktAdresse.split(/\n|,/).map((line, i) => (
                <Text key={i} style={styles.body}>
                  {line.trim()}
                </Text>
              ))
            : null}
          {cogs.kontaktTelefon ? (
            <Text style={styles.body}>
              <Text style={styles.emphasis}>Telefon: </Text>
              {cogs.kontaktTelefon}
            </Text>
          ) : null}
          {cogs.kontaktEmail ? (
            <Text style={styles.body}>
              <Text style={styles.emphasis}>E-Mail: </Text>
              {cogs.kontaktEmail}
            </Text>
          ) : null}
        </View>
        {cogs.besonderheiten ? (
          <View style={styles.warnBanner}>
            <Text style={{ ...styles.body, ...styles.emphasis }}>
              Besonderheit:
            </Text>
            <Text style={styles.body}>{cogs.besonderheiten}</Text>
          </View>
        ) : null}
      </CogsStep>

      {/* Step 3 — Legalisation */}
      <CogsStep num={3} title="Apostille / Legalisation">
        <Text style={styles.body}>
          Das Certificate of Good Standing muss legalisiert werden bevor es in
          Dubai anerkannt wird. Dazu sind zwei Stellen in Folge zu durchlaufen:
        </Text>
        <Text style={{ ...styles.body, ...styles.emphasis, marginTop: 6 }}>
          a) Endbeglaubigung
        </Text>
        {renderAuthorityBlock(bvaAddress)}
        <Text style={{ ...styles.body, ...styles.emphasis, marginTop: 8 }}>
          b) Legalisation durch VAE-Botschaft
        </Text>
        {renderAuthorityBlock(uaeEmbassy)}
      </CogsStep>

      {/* Step 4 — Translation */}
      <CogsStep num={4} title="Übersetzung durch vereidigten Übersetzer">
        <Text style={styles.body}>
          Das legalisierte Dokument wird anschließend von einem in Deutschland
          vereidigten Übersetzer ins Englische übersetzt.{" "}
          <Text style={styles.emphasis}>
            Diesen Schritt koordiniert Dubai Docs Fast Track für Sie.
          </Text>
        </Text>
      </CogsStep>
      <Footer />
    </Page>
  );
}

// ---------- Closing -------------------------------------------------------

function ClosingPage() {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.h1}>Was Dubai Docs Fast Track für Sie übernimmt</Text>
      <View style={styles.infoBanner}>
        <Text style={styles.bodyLg}>
          • Übersetzung aller Dokumente durch vereidigte Übersetzer in Deutschland
        </Text>
        <Text style={styles.bodyLg}>
          • Einreichung bei der Dubai Health Authority (DHA)
        </Text>
      </View>

      <Text style={{ ...styles.h2, marginTop: 16 }}>Ihr Kontakt zu uns</Text>
      <Text style={styles.bodyLg}>
        <Text style={styles.emphasis}>Web: </Text>
        www.dubai-docs-fast-track.com
      </Text>
      <Text style={styles.bodyLg}>
        <Text style={styles.emphasis}>E-Mail: </Text>
        hello@dubai-docs-fast-track.com
      </Text>
      <Text style={styles.bodyLg}>
        <Text style={styles.emphasis}>WhatsApp-Support </Text>— rund um die Uhr
      </Text>

      <Text style={{ ...styles.caption, marginTop: 30 }}>
        Gebühren und Verfahren der deutschen Behörden können sich ändern. Im
        Zweifel bitte die jeweilige Behörde direkt kontaktieren.
      </Text>
      <Footer />
    </Page>
  );
}

// ---------- Root document -------------------------------------------------

export function LauflisteDocument({ input }: { input: LauflisteInput }) {
  return (
    <Document title={`Laufzettel ${input.person.name || "unbekannt"}`}>
      <CoverPage input={input} />
      <OverviewPage input={input} />
      {input.cogs ? <CogsSectionPage cogs={input.cogs} /> : null}
      {/* Sektion-B-Intro on its own page */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>
          Sektion B — Dokumenten-Legalisation
        </Text>
        <View style={styles.sectionUnderline} />
        <Text style={styles.sectionIntro}>
          Für jede Urkunde folgt eine dreistufige Legalisationskette:
          Vorbeglaubigung → Endbeglaubigung → Legalisation durch VAE-Botschaft.
          Jede Urkunde beginnt auf einer neuen Seite.
        </Text>
        <Footer />
      </Page>
      {/* Each document on its own page to avoid React-PDF pagination bugs
          with many <View break> children inside a single Page. */}
      {input.documents.map((doc, i) => (
        <Page key={doc.position} size="A4" style={styles.page}>
          <DocumentSection doc={doc} index={0} />
          <Footer />
        </Page>
      ))}
      <ClosingPage />
    </Document>
  );
}
