---
plan: "06"
phase: 6
title: "CoGS Workflow + New DDFT-Branded Laufzettel"
autonomous: true
---

# Phase 6 — CoGS Workflow + New Laufzettel

## Context

The product is "Dubai Docs Fast Track" (DDFT) — service for German Ärzte/Zahnärzte moving to Dubai. Reviewing the reference Laufzettel + the user's clarifications, the v1 build misses half the workflow. This phase adds:

1. Certificate of Good Standing (CoGS) routing per doctor
2. Proper 4-step CoGS section in the Laufzettel
3. Correct Endbeglaubigung authority (BVA Köln, not "Auswärtiges Amt")
4. DDFT branding (Cyan #07B7EF, Navy #08449B, Montserrat + Inter fonts, logo)
5. Auto-resolve flow (no per-doc manual review gate)
6. Admin UI to maintain the CoGS database over time

## Key decisions (locked)

- **CoGS routing rule**: Arbeitsort-BL primary, Wohnsitz-BL fallback (when doctor currently abroad). Ausbildungs-BL is informational only (extracted from Approbation urkunde).
- **NRW has two Kammer-regions**: user picks Nordrhein or Westfalen-Lippe.
- **Beruf** = Arzt | Zahnarzt (required per case, impacts CoGS routing).
- **Endbeglaubigung** per document: `Bundesverwaltungsamt Köln, Barbarastraße 1, 50735 Köln` (for most docs). Führungszeugnis special case = BfJ Bonn via Apostille (no UAE embassy step).
- **Führungszeugnis O**: beantragt der Arzt am Bürgeramt seines Wohnortes — NICHT beim BfJ direkt. Bürgeramt schickt das FZ dann an die Empfängerbehörde (die in `cogs_kammer.fuehrungszeugnis_o_empfaenger` steht).
- **NO costs, NO weeks estimates** on Laufzettel per user request.
- **Layout**: Cover page, "Auf einen Blick" overview, Section A (CoGS 4 steps), Section B (per-doc chains).
- **Data source merge**: `/Users/andreaswilmers/Downloads/good_standing_database.csv` (baseline) + `.planning/cogs-research-results.json` (gap fills + corrections). The research JSON takes precedence when a row exists in both.

## Implementation tasks

### T1 — Schema: `cogs_kammer` + case extensions

Add to `db/schema.ts`:

```ts
// CoGS per (bundesland, beruf) — routing table for Certificate of Good Standing workflow.
export const cogsKammer = sqliteTable(
  "cogs_kammer",
  {
    id: text("id").primaryKey(), // slug e.g. "by-arzt", "nw-nr-zahnarzt"
    bundeslandKey: text("bundesland_key").notNull(), // BW, BY, BE, BB, HB, HH, HE, MV, NI, NW_NR, NW_WL, RP, SL, SN, ST, SH, TH
    bundeslandName: text("bundesland_name").notNull(),
    beruf: text("beruf", { enum: ["arzt", "zahnarzt"] as const }).notNull(),
    kammerName: text("kammer_name"),
    kammerWebsite: text("kammer_website"),
    zustaendigeStelle: text("zustaendige_stelle").notNull(),
    zustaendigeStelleHinweis: text("zustaendige_stelle_hinweis"),
    directUrlGoodStanding: text("direct_url_good_standing"),
    antragsverfahren: text("antragsverfahren"),
    erforderlicheDokumente: text("erforderliche_dokumente"), // pipe-separated
    fuehrungszeugnisOErforderlich: text("fuehrungszeugnis_o_erforderlich"),
    fuehrungszeugnisOEmpfaenger: text("fuehrungszeugnis_o_empfaenger").notNull(), // e.g. "Ärztekammer Berlin, Friedrichstraße 16, 10969 Berlin"
    kontaktEmail: text("kontakt_email"),
    kontaktTelefon: text("kontakt_telefon"),
    kontaktAdresse: text("kontakt_adresse"),
    besonderheiten: text("besonderheiten"),
    quellen: text("quellen"),
    datenVollstaendig: integer("daten_vollstaendig", { mode: "boolean" }).notNull().default(false),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
    updatedBy: text("updated_by"), // user id — who last edited this row in admin UI
  },
  (t) => [uniqueIndex("cogs_kammer_bl_beruf_uniq").on(t.bundeslandKey, t.beruf)],
);

// Case extensions: add beruf, wohnsitz_bundesland, arbeitsort_bundesland, nrw_subregion
// ALTER existing `case_` table. New columns are nullable so existing cases survive.
```

Run `drizzle-kit generate` then `drizzle-kit push --force`.

### T2 — Seed script `seed-cogs.ts`

- Read `good_standing_database.csv` and `.planning/cogs-research-results.json`
- Merge: research JSON takes precedence; CSV is baseline
- Key formula: `id = "{bundesland_key_lower_with_underscores_to_dashes}-{beruf_key}"` e.g. `by-arzt`, `nw-nr-zahnarzt`
- Upsert into `cogs_kammer` (onConflictDoUpdate on id)
- Idempotent: re-running doesn't duplicate
- Store `updatedBy: "seed"` for seeded rows

### T3 — CoGS Resolver

`lib/cogs/resolve.ts`:

```ts
export type CogsRoutingInput = {
  beruf: "arzt" | "zahnarzt";
  arbeitsortBundesland: string | null; // BL-key or null if abroad
  wohnsitzBundesland: string; // BL-key (required, fallback)
  nrwSubregion: "nordrhein" | "westfalen-lippe" | null;
};
export type CogsRoutingResult = {
  ok: true;
  cogsKammer: CogsKammerRow;
  routing: { used: "arbeitsort" | "wohnsitz"; bundeslandKey: string };
} | { ok: false; reason: "not_found" | "nrw_subregion_missing"; details?: string };
```

Logic:
1. effectiveBl = arbeitsortBundesland ?? wohnsitzBundesland
2. If effectiveBl === "NW" → need nrwSubregion; key becomes "NW_NR" or "NW_WL"
3. Query `cogs_kammer` where (bundeslandKey=effectiveBl, beruf)
4. Return with routing metadata

Unit tests: happy path, NRW with subregion, NRW without (error), abroad→wohnsitz fallback, Thüringen Arzt.

### T4 — Admin UI for CoGS: `/admin/cogs`

- `app/(app)/admin/cogs/page.tsx` — Server Component, list all 34 (bl × beruf) combinations as a Table with status chip (vollständig / Lücken)
- `app/(app)/admin/cogs/[id]/edit/page.tsx` — edit form for all fields
- Server Actions in `lib/cogs/admin-actions.ts` — updateCogsKammer, create+validate with Zod
- "Nicht online verfügbar"-Option pro Feld: empty string + automatic placeholder in PDF ("Verfahren nicht online veröffentlicht — direkter Kontakt: {phone}")
- Nav entry: "CoGS" → /admin/cogs

### T5 — Case-Modell erweitern

ALTER `case_`:
- `beruf TEXT CHECK(beruf IN ('arzt','zahnarzt'))` — nullable for legacy rows
- `wohnsitz_bundesland TEXT` — nullable
- `arbeitsort_bundesland TEXT` — nullable (foreign residence)
- `nrw_subregion TEXT CHECK(nrw_subregion IN ('nordrhein','westfalen-lippe'))` — nullable

Update:
- Case-create form (`/cases/new`): add fields — Beruf (Select: Arzt|Zahnarzt, required), Wohnsitz-BL (Select 16 states, required), Arbeitsort-BL (Select 16 states + "im Ausland", required), NRW-Subregion (conditional Select, only shown if wohnsitz=NW or arbeitsort=NW).
- Case-detail (`/cases/[id]`): show these fields, allow edit via inline form.

### T6 — Auto-Resolve Flow (remove manual per-doc review gate)

Change:
- After `extractDocumentAction` completes, automatically call `resolveAuthority` and persist the result on the document.
- Add `document.vorbeglaubigung_status TEXT` — values: pending, matched, ambiguous, not_found
- Add `document.resolved_authority_id TEXT` — FK to behoerden_authority (nullable)
- On document detail page: show resolved authority inline. Only surface the "Zur Überprüfung"-Link if status IS ambiguous or not_found.

The Review page continues to exist but becomes an exception path — not the default flow.

### T7 — New Laufzettel PDF

Overhaul `lib/laufliste/pdf/Document.tsx` + sections. Target layout:

**Deckblatt (Page 1)**
- Top: DDFT logo (from `public/ddft-logo.png`) + wordmark "Dubai Docs Fast Track"
- Cyan accent line across page
- Title: "Laufzettel — VAE-Legalisation"
- Person block: Name, Beruf, maßgebliches BL (for CoGS), Fall-Nr, Datum
- Doc count summary
- "Dieser Laufzettel enthält zwei parallele Prozesse: A) Certificate of Good Standing, B) Dokumenten-Legalisation"

**Überblick (Page 2) — "Auf einen Blick"**
- Two columns: A and B
- A: 4 steps with ☐ checkboxes
- B: 1 row per doc with ☐

**Sektion A — Certificate of Good Standing (Page 3+)**
- Step 1: Führungszeugnis Belegart O
  - **CORRECTED**: "Beantragen Sie das Führungszeugnis bei der Meldebehörde (Bürgeramt / Einwohnermeldeamt) an Ihrem Wohnort — online unter www.fuehrungszeugnis.bund.de oder persönlich beim Bürgeramt. Bei der Beantragung angeben: Belegart O, Verwendungszweck 'Certificate of Good Standing', Empfängerbehörde:"
  - Print `cogs_kammer.fuehrungszeugnis_o_empfaenger` as the address.
- Step 2: CoGS-Antrag bei zuständiger Stelle
  - Name, Adresse, Telefon, E-Mail, Website
  - Antragsverfahren (text)
  - Erforderliche Dokumente (list)
  - Direkter URL wenn vorhanden
  - Besonderheiten
  - If `datenVollstaendig=false`: show warning "Verfahren nicht online veröffentlicht. Bitte kontaktieren Sie die Stelle direkt: {phone} · {email}"
- Step 3: Apostille / Legalisation
  - Bundesverwaltungsamt Köln (Barbarastraße 1, 50735 Köln, Tel: +49 22899 358-0, E-Mail: poststelle@bva.bund.de, Web: www.bva.bund.de)
  - Dann VAE-Botschaft Berlin (Hiroshimastraße 18–20, 10785 Berlin, Tel: 030 516 516, Web: www.uae-embassy.de)
- Step 4: Übersetzung durch vereidigten Übersetzer

**Sektion B — Dokumente (Page N+)**
- One page per document
- Document header block
- Step 1: Vorbeglaubigung (from `resolvedAuthority`, printed directly)
- Step 2: Endbeglaubigung — BVA Köln (static block)
- Step 3: Legalisation — UAE Embassy Berlin (static block)
- Special cases:
  - Reisepass → "Keine Legalisation erforderlich. Wird im Original vorgelegt."
  - Führungszeugnis → "Apostille durch Bundesamt für Justiz Bonn — keine Legalisation durch VAE-Botschaft notwendig."
  - Ambiguous resolver → print all candidates with a warning "Mehrere zuständige Stellen möglich. Kontaktieren Sie im Zweifel Dubai Docs Fast Track."
  - Not-found → "Keine zuständige Stelle für diese Dokumentenart gefunden in Ihrem Bundesland. Bitte kontaktieren Sie DDFT."

**Abschluss-Seite**
- "Was Dubai Docs Fast Track für Sie erledigt": Übersetzung + DHA-Einreichung
- Kontakt: "Bei Fragen erreichen Sie uns: hello@dubai-docs-fast-track.com · WhatsApp 24/7"
- Disclaimer: "Gebühren und Verfahren können sich ändern. Im Zweifel die jeweilige Behörde direkt kontaktieren."

**Styling**
- Headlines: Montserrat (700 Bold, 600 SemiBold)
- Body: Inter (400, 500, 600)
- Colors: Cyan #07B7EF for accent lines/step numbers, Navy #08449B for h1/h2, #111 for body, #6B7280 for muted
- Register fonts via `@react-pdf/renderer` `Font.register()` — download OFL versions to `lib/laufliste/pdf/fonts/`
- Footer on every page: "Dubai Docs Fast Track · dubai-docs-fast-track.com · Fall-Nr XXX · Seite Y / N"

### T8 — Build input composer update

`lib/laufliste/build-input.ts` must now:
1. Load Case with new fields (beruf, wohnsitz_bl, arbeitsort_bl, nrw_subregion)
2. Resolve CoGS via `resolveCogs()` — load cogsKammer row
3. For each document, use `document.resolvedAuthorityId` (from auto-resolve) OR re-resolve if missing
4. Pass both to Document.tsx

### T9 — Tests

- Unit: cogs resolver (NRW, Thüringen, fallback)
- Integration: case-create with new fields, cogs admin update, auto-resolve on extraction, Laufzettel render contains all expected sections
- Keep existing test suite green

## Success criteria

- [ ] `cogs_kammer` table exists with all 34 (bl × beruf) rows populated
- [ ] Admin UI at `/admin/cogs` works end-to-end
- [ ] Case create form asks Beruf + Wohnsitz-BL + Arbeitsort-BL (+ NRW-Subregion conditional)
- [ ] Auto-resolve fires after extraction; documents get `resolved_authority_id`
- [ ] Per-doc manual review only needed for ambiguous/not_found
- [ ] New PDF Laufzettel renders with DDFT branding (logo, fonts, colors)
- [ ] CoGS section has all 4 steps with routed data
- [ ] Document section uses BVA Köln (not "Auswärtiges Amt") as Endbeglaubigung
- [ ] Führungszeugnis step 1 correctly instructs Bürgeramt-route (not BfJ direct)
- [ ] Tests green
- [ ] `tsc --noEmit` clean
