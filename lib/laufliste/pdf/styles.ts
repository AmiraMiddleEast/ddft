/**
 * Phase 4 Plan 03 — React-PDF StyleSheet for the Laufliste output.
 *
 * Tokens are copy-pasted from UI-SPEC "PDF Layout Contract":
 * - A4 portrait, 20mm margins, Helvetica built-in (handles ä/ö/ü/ß via WinAnsi).
 * - Type scale 18/12/10/8 pt; exactly 2 weights (regular + bold).
 * - Monochrome palette: #111111 primary, #555555 muted, #4B5563 muted accent
 *   (underlines only), #BFBFBF divider, #FDE68A amber warning fill.
 *
 * Units are pt unless explicitly declared (`"20mm"` / `"10mm"` accepted by
 * @react-pdf/renderer as dimension strings).
 */

import { StyleSheet } from "@react-pdf/renderer";

export const styles = StyleSheet.create({
  // -- Page / base ---------------------------------------------------------
  page: {
    paddingTop: "20mm",
    paddingBottom: "20mm",
    paddingLeft: "20mm",
    paddingRight: "20mm",
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#111111",
    lineHeight: 1.4,
  },

  // -- Typography ----------------------------------------------------------
  h1: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    lineHeight: 1.2,
    marginBottom: 8,
  },
  h2: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    lineHeight: 1.3,
  },
  body: {
    fontSize: 10,
    lineHeight: 1.4,
  },
  emphasis: {
    fontFamily: "Helvetica-Bold",
  },
  caption: {
    fontSize: 8,
    color: "#555555",
    lineHeight: 1.3,
  },
  muted: {
    color: "#555555",
  },

  // -- Layout primitives ---------------------------------------------------
  hr: {
    borderBottomWidth: 0.75,
    borderBottomColor: "#BFBFBF",
    marginVertical: 8,
  },
  sectionUnderline: {
    borderBottomWidth: 0.5,
    borderBottomColor: "#4B5563",
    marginBottom: 6,
    marginTop: 2,
  },

  // -- Header / summary rows on page 1 -------------------------------------
  summaryRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: "row",
    marginBottom: 2,
  },

  // -- Document section spacing -------------------------------------------
  documentSection: {
    marginBottom: 12,
  },
  stepBlock: {
    marginTop: 8,
    marginBottom: 4,
  },
  addressLine: {
    marginBottom: 1,
  },

  // -- [PRÜFEN] inline pill ------------------------------------------------
  pruefenPill: {
    backgroundColor: "#FDE68A",
    paddingHorizontal: 4,
    paddingVertical: 1,
    fontFamily: "Helvetica-Bold",
    marginRight: 4,
  },

  // -- Fixed footer (every page) ------------------------------------------
  footer: {
    position: "absolute",
    bottom: "10mm",
    left: "20mm",
    right: "20mm",
    textAlign: "center",
    fontSize: 8,
    color: "#555555",
  },
});
