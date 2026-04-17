/**
 * Phase 4 Plan 03 — React-PDF subcomponents for the Laufliste document.
 *
 * Pure JSX consumed by @react-pdf/renderer's reconciler (NOT react-dom). Do
 * not add `"use client"` — these components only run server-side inside
 * `renderToBuffer()` (RESEARCH Anti-Pattern).
 *
 * All copy strings match UI-SPEC "Copywriting Contract" + "PDF Layout Contract"
 * verbatim. Missing field sentinels:
 *   - `— nicht erkannt` for missing document metadata (extractor gaps).
 *   - `— nicht hinterlegt` for missing authority fields (DB gaps).
 */

import React from "react";
import { View, Text } from "@react-pdf/renderer";
import { styles } from "./styles";
import type {
  AuthorityBlock,
  LauflisteDocumentEntry,
  VorbeglaubigungBlock,
} from "../types";

const EMPTY_METADATA = "— nicht erkannt";
const EMPTY_AUTHORITY = "— nicht hinterlegt";

// ---------------------------------------------------------------------------
// KeyValueRow — `<bold-label>: <value>` with muted sentinel when value is null.
// ---------------------------------------------------------------------------
function KeyValueRow({
  label,
  value,
  emptyText = EMPTY_AUTHORITY,
}: {
  label: string;
  value: string | null | undefined;
  emptyText?: string;
}) {
  const isEmpty = value == null || value === "";
  return (
    <View style={styles.metaRow}>
      <Text style={styles.body}>
        <Text style={styles.emphasis}>{label}: </Text>
        {isEmpty ? (
          <Text style={styles.muted}>{emptyText}</Text>
        ) : (
          <Text>{value}</Text>
        )}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// AuthorityBlockView — Anschrift / Telefon / E-Mail / Website / Öffnungszeiten
// ---------------------------------------------------------------------------
export function AuthorityBlockView({
  authority,
  showName = true,
  namePrefix,
}: {
  authority: AuthorityBlock;
  /** When false, callers handle the name themselves (e.g. to prepend PRÜFEN pill). */
  showName?: boolean;
  namePrefix?: React.ReactNode;
}) {
  const address = authority.address.filter((l) => l && l.trim().length > 0);

  return (
    <View>
      {showName ? (
        <Text style={[styles.body, styles.emphasis]}>
          {namePrefix}
          {authority.name}
        </Text>
      ) : null}

      {/* Anschrift (bold label + stacked lines) */}
      <View style={{ marginTop: 2 }}>
        <Text style={styles.body}>
          <Text style={styles.emphasis}>Anschrift: </Text>
          {address.length === 0 ? (
            <Text style={styles.muted}>{EMPTY_AUTHORITY}</Text>
          ) : (
            <Text>{address[0]}</Text>
          )}
        </Text>
        {address.slice(1).map((line, idx) => (
          <Text key={idx} style={[styles.body, styles.addressLine]}>
            {/* indent continuation lines to align under address value */}
            {"          "}
            {line}
          </Text>
        ))}
      </View>

      <KeyValueRow label="Telefon" value={authority.phone} />
      <KeyValueRow label="E-Mail" value={authority.email} />
      <KeyValueRow label="Website" value={authority.website} />
      <KeyValueRow label="Öffnungszeiten" value={authority.officeHours} />

      {authority.notes ? (
        <View style={{ marginTop: 2 }}>
          <Text style={styles.body}>
            <Text style={styles.emphasis}>Besondere Hinweise: </Text>
            {authority.notes}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// DocumentMetaBlock — 5 fields per UI-SPEC: Dokumentart / ausstellende Behörde
// / Ausstellungsort / Ausstellungsdatum / Voller Name.
// ---------------------------------------------------------------------------
export function DocumentMetaBlock({ doc }: { doc: LauflisteDocumentEntry }) {
  return (
    <View style={{ marginTop: 4 }}>
      <KeyValueRow
        label="Dokumentart"
        value={doc.dokumentart}
        emptyText={EMPTY_METADATA}
      />
      <KeyValueRow
        label="Ausstellende Behörde"
        value={doc.ausstellendeBehoerde}
        emptyText={EMPTY_METADATA}
      />
      <KeyValueRow
        label="Ausstellungsort"
        value={doc.ausstellungsort}
        emptyText={EMPTY_METADATA}
      />
      <KeyValueRow
        label="Ausstellungsdatum"
        value={doc.ausstellungsdatum}
        emptyText={EMPTY_METADATA}
      />
      <KeyValueRow
        label="Voller Name"
        value={doc.vollerName}
        emptyText={EMPTY_METADATA}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// VorbeglaubigungSection — Step 1 with optional [PRÜFEN] amber pill.
// ---------------------------------------------------------------------------
export function VorbeglaubigungSection({
  v,
}: {
  v: VorbeglaubigungBlock;
}) {
  return (
    <View style={styles.stepBlock}>
      <Text style={styles.h2}>Vorbeglaubigung</Text>
      <View style={styles.sectionUnderline} />

      {v.kind === "authority" ? (
        <View>
          <Text style={[styles.body, styles.emphasis]}>
            {v.needsReview ? (
              <Text style={styles.pruefenPill}>[PRÜFEN] </Text>
            ) : null}
            {v.authority.name}
          </Text>

          {/* Authority body without repeating the name */}
          <AuthorityBlockView authority={v.authority} showName={false} />

          {v.specialRules ? (
            <View style={{ marginTop: 2 }}>
              <Text style={styles.body}>
                <Text style={styles.emphasis}>Besondere Hinweise: </Text>
                {v.specialRules}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {v.kind === "exception-apostille" ? (
        <Text style={styles.body}>
          Sonderregelung: Apostille — siehe folgenden Schritt (Bundesamt für
          Justiz).
        </Text>
      ) : null}

      {v.kind === "exception-reisepass" ? (
        <Text style={styles.body}>Keine Legalisation erforderlich.</Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// EndbeglaubigungSection — Step 2.
// For Führungszeugnis (exception-apostille), this renders the BfJ block but
// the section title is rephrased to "Endbeglaubigung (Apostille)".
// ---------------------------------------------------------------------------
function EndbeglaubigungSection({
  authority,
  apostille,
}: {
  authority: AuthorityBlock;
  apostille: boolean;
}) {
  return (
    <View style={styles.stepBlock}>
      <Text style={styles.h2}>
        {apostille ? "Endbeglaubigung (Apostille)" : "Endbeglaubigung"}
      </Text>
      <View style={styles.sectionUnderline} />
      <AuthorityBlockView authority={authority} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// LegalisationSection — Step 3 (UAE Embassy).
// ---------------------------------------------------------------------------
function LegalisationSection({ authority }: { authority: AuthorityBlock }) {
  return (
    <View style={styles.stepBlock}>
      <Text style={styles.h2}>Legalisation durch VAE-Botschaft</Text>
      <View style={styles.sectionUnderline} />
      <AuthorityBlockView authority={authority} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// DocumentSection — outer wrapper per document; page-break before docs 2..N.
// ---------------------------------------------------------------------------
export function DocumentSection({
  doc,
  index,
}: {
  doc: LauflisteDocumentEntry;
  index: number;
}) {
  const isApostille = doc.vorbeglaubigung.kind === "exception-apostille";
  const isReisepass = doc.vorbeglaubigung.kind === "exception-reisepass";

  return (
    <View break={index > 0} style={styles.documentSection}>
      {/* Section title */}
      <Text style={styles.h2}>
        {doc.position}. Dokument — {doc.dokumentart || EMPTY_METADATA}
      </Text>
      <View style={styles.sectionUnderline} />

      {/* Document metadata */}
      <DocumentMetaBlock doc={doc} />

      {/* Step 1 — Vorbeglaubigung */}
      <VorbeglaubigungSection v={doc.vorbeglaubigung} />

      {/* Step 2 — Endbeglaubigung (or terminal line for Reisepass) */}
      {isReisepass ? (
        <View style={styles.stepBlock}>
          <Text style={styles.body}>Keine Legalisation erforderlich.</Text>
        </View>
      ) : doc.endbeglaubigung ? (
        <EndbeglaubigungSection
          authority={doc.endbeglaubigung}
          apostille={isApostille}
        />
      ) : null}

      {/* Step 3 — Legalisation (or short-circuit line for Apostille) */}
      {isReisepass ? null : isApostille ? (
        <View style={styles.stepBlock}>
          <Text style={styles.body}>
            Sonderregelung: Apostille — keine Legalisation durch VAE-Botschaft
            erforderlich.
          </Text>
        </View>
      ) : doc.legalisation ? (
        <LegalisationSection authority={doc.legalisation} />
      ) : null}

      {/* Trailing rule between sections */}
      <View style={styles.hr} />
    </View>
  );
}
