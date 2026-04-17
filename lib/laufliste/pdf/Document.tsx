/**
 * Phase 4 Plan 03 — Root React-PDF document for the Laufliste.
 *
 * Exactly ONE `<Page>` (RESEARCH Pattern 4 — React-PDF paginates automatically).
 * Page-1 header View is NOT `fixed` (renders once on page 1). The footer IS
 * `fixed` and repeats on every page via the `render` callback.
 */

import React from "react";
import { Document, Page, View, Text } from "@react-pdf/renderer";
import { styles } from "./styles";
import { DocumentSection } from "./sections";
import type { LauflisteInput } from "../types";

function formatGeneratedAt(d: Date): string {
  // UI-SPEC: dd.MM.yyyy — formatted client-free to avoid locale drift in tests.
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getUTCFullYear());
  return `${dd}.${mm}.${yyyy}`;
}

export function LauflisteDocument({ input }: { input: LauflisteInput }) {
  const totalDocs = input.documents.length;
  const createdAt = formatGeneratedAt(input.generatedAt);

  return (
    <Document title={`Laufliste ${input.person.name || "unbekannt"}`}>
      <Page size="A4" style={styles.page}>
        {/* ---------- Page-1 header (NOT fixed) ---------- */}
        <View>
          <Text style={styles.h1}>Laufliste</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.body}>
              <Text style={styles.emphasis}>Person: </Text>
              {input.person.name || "— nicht hinterlegt"}
            </Text>
          </View>

          {input.person.birthdate ? (
            <View style={styles.summaryRow}>
              <Text style={styles.body}>
                <Text style={styles.emphasis}>Geburtsdatum: </Text>
                {input.person.birthdate}
              </Text>
            </View>
          ) : null}

          <View style={styles.summaryRow}>
            <Text style={styles.body}>
              <Text style={styles.emphasis}>Erstellt am: </Text>
              {createdAt}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.body}>
              <Text style={styles.emphasis}>Dokumente insgesamt: </Text>
              {String(totalDocs)}
            </Text>
          </View>

          <View style={styles.hr} />
        </View>

        {/* ---------- Per-document sections ---------- */}
        {input.documents.map((doc, i) => (
          <DocumentSection key={doc.position} doc={doc} index={i} />
        ))}

        {/* ---------- Fixed footer (every page) ---------- */}
        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            `Seite ${pageNumber} von ${totalPages}`
          }
        />
      </Page>
    </Document>
  );
}
