/**
 * Phase 4 + Phase 6 — React-PDF StyleSheet for the Laufliste output.
 *
 * DDFT (Dubai Docs Fast Track) branding:
 * - Cyan   #07B7EF  — step numbers, accent lines, callouts
 * - Navy   #08449B  — h1/h2
 * - Body   #111111
 * - Muted  #6B7280
 * - Warn   #F59E0B  (amber — [PRÜFEN] pill, data-gap banners)
 * - Destr. #DC2626  (red — not-found)
 * - Divider #E5E7EB
 *
 * A4 portrait, 20mm margins, Helvetica (built-in — supports German umlauts via
 * WinAnsi). No custom-font registration: Montserrat/Inter are targets but
 * adding them requires shipping .ttf files; we use Helvetica-Bold for headings
 * and preserve the color palette for brand identity.
 */

import { StyleSheet } from "@react-pdf/renderer";

export const DDFT_COLORS = {
  cyan: "#07B7EF",
  navy: "#08449B",
  navyDark: "#081C3A",
  text: "#111111",
  muted: "#6B7280",
  warn: "#F59E0B",
  warnBg: "#FEF3C7",
  destr: "#DC2626",
  divider: "#E5E7EB",
  bg: "#FFFFFF",
  panel: "#F9FAFB",
} as const;

export const styles = StyleSheet.create({
  // -- Page / base ---------------------------------------------------------
  page: {
    paddingTop: "20mm",
    paddingBottom: "22mm",
    paddingLeft: "20mm",
    paddingRight: "20mm",
    fontFamily: "Helvetica",
    fontSize: 10,
    color: DDFT_COLORS.text,
    lineHeight: 1.4,
  },
  coverPage: {
    paddingTop: "30mm",
    paddingBottom: "30mm",
    paddingLeft: "20mm",
    paddingRight: "20mm",
    fontFamily: "Helvetica",
    fontSize: 11,
    color: DDFT_COLORS.text,
    lineHeight: 1.4,
    backgroundColor: DDFT_COLORS.bg,
  },

  // -- Typography ----------------------------------------------------------
  coverTitle: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: DDFT_COLORS.navy,
    lineHeight: 1.1,
    marginBottom: 4,
  },
  coverSubtitle: {
    fontSize: 14,
    color: DDFT_COLORS.muted,
    marginBottom: 24,
  },
  h1: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: DDFT_COLORS.navy,
    lineHeight: 1.2,
    marginBottom: 10,
  },
  h2: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: DDFT_COLORS.navy,
    lineHeight: 1.2,
    marginBottom: 6,
  },
  h3: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: DDFT_COLORS.navyDark,
    marginBottom: 4,
  },
  body: { fontSize: 10, lineHeight: 1.45 },
  bodyLg: { fontSize: 11, lineHeight: 1.5 },
  emphasis: { fontFamily: "Helvetica-Bold" },
  caption: { fontSize: 8, color: DDFT_COLORS.muted, lineHeight: 1.3 },
  muted: { color: DDFT_COLORS.muted },
  cyan: { color: DDFT_COLORS.cyan },
  navy: { color: DDFT_COLORS.navy },

  // -- Layout primitives ---------------------------------------------------
  hr: {
    borderBottomWidth: 0.75,
    borderBottomColor: DDFT_COLORS.divider,
    marginVertical: 10,
  },
  cyanBar: {
    backgroundColor: DDFT_COLORS.cyan,
    height: 4,
    marginVertical: 12,
  },
  sectionUnderline: {
    borderBottomWidth: 0.5,
    borderBottomColor: DDFT_COLORS.cyan,
    marginBottom: 6,
    marginTop: 2,
  },

  // -- Cover ---------------------------------------------------------------
  logo: { width: 120, marginBottom: 24 },
  coverBlock: {
    borderLeftWidth: 3,
    borderLeftColor: DDFT_COLORS.cyan,
    paddingLeft: 12,
    marginBottom: 20,
  },
  coverLabel: {
    fontSize: 9,
    color: DDFT_COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 1,
  },
  coverValue: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: DDFT_COLORS.text,
    marginBottom: 6,
  },

  // -- Overview ------------------------------------------------------------
  overviewTable: {
    borderWidth: 1,
    borderColor: DDFT_COLORS.divider,
    borderRadius: 4,
    padding: 12,
    marginTop: 6,
    marginBottom: 10,
  },
  overviewRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 2,
  },
  checkbox: {
    width: 10,
    height: 10,
    borderWidth: 1,
    borderColor: DDFT_COLORS.muted,
    marginRight: 8,
  },

  // -- Sections ------------------------------------------------------------
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: DDFT_COLORS.navy,
    marginTop: 6,
    marginBottom: 2,
  },
  sectionIntro: {
    fontSize: 10,
    color: DDFT_COLORS.muted,
    marginBottom: 10,
  },
  step: {
    marginTop: 14,
    marginBottom: 6,
  },
  stepHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 4,
  },
  stepNumber: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: DDFT_COLORS.cyan,
    marginRight: 8,
    minWidth: 22,
  },
  stepTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: DDFT_COLORS.navy,
    flexShrink: 1,
  },

  // -- Legacy rows (used by sections.tsx) ---------------------------------
  summaryRow: { flexDirection: "row", marginBottom: 2 } as const,
  metaRow: { flexDirection: "row", marginBottom: 2 } as const,

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

  // -- Pills / banners -----------------------------------------------------
  pruefenPill: {
    // Inline pill inside a <Text> parent — React-PDF only supports a subset
    // of style props on nested Text (padding/margin are not reliable and
    // cause render errors). Keep it to background + color + font.
    backgroundColor: DDFT_COLORS.warnBg,
    color: DDFT_COLORS.warn,
    fontFamily: "Helvetica-Bold",
  },
  warnBanner: {
    backgroundColor: DDFT_COLORS.warnBg,
    borderLeftWidth: 3,
    borderLeftColor: DDFT_COLORS.warn,
    padding: 8,
    marginVertical: 6,
  },
  infoBanner: {
    backgroundColor: DDFT_COLORS.panel,
    borderLeftWidth: 3,
    borderLeftColor: DDFT_COLORS.cyan,
    padding: 8,
    marginVertical: 6,
  },

  // -- Fixed footer (every page) ------------------------------------------
  footer: {
    position: "absolute",
    bottom: "10mm",
    left: "20mm",
    right: "20mm",
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: DDFT_COLORS.muted,
  },
  footerBrand: { fontFamily: "Helvetica-Bold", color: DDFT_COLORS.navy },
});
