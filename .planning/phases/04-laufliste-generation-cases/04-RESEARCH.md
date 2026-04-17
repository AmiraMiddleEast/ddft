# Phase 4: Laufliste Generation & Cases — Research

**Researched:** 2026-04-17
**Domain:** Server-side PDF generation (@react-pdf/renderer 4.5) + Drizzle ORM schema for cases/Lauflisten + Next.js 16 Server Actions + Route Handlers
**Confidence:** HIGH

## Summary

Phase 4 composes three mature, already-pinned pieces: (1) `@react-pdf/renderer` 4.5.1 for server-side PDF rendering, (2) Drizzle ORM additions on top of the existing SQLite schema, and (3) a file-system storage pattern identical to Phase 2's `lib/uploads/storage.ts`. The key risks are small and well-known: React server-component interop (use `renderToBuffer` directly in a Server Action — no "use client"), Helvetica's WinAnsi encoding handles all German umlauts without font registration, and page-break control uses `<View break>` + `<Page wrap>`. Storage to `data/lauflisten/{caseId}-{timestamp}.pdf` mirrors the Phase 2 convention 1:1.

**Primary recommendation:** Ship a dedicated renderer module at `lib/laufliste/pdf/` with a pure React tree (`<Document>` → `<Page>` → `<View>` sections), call `renderToBuffer(<LauflisteDocument …/>)` from a Server Action, persist the Buffer via a thin `writeLauflisteToDisk()` helper that mirrors `writeUploadToDisk()`, and stream the file back through a Route Handler at `/api/cases/[id]/laufliste/[lauflisteId]/download`. Endbeglaubigung + Embassy data are small TypeScript constants in `lib/laufliste/endbeglaubigung.ts` and `lib/laufliste/embassy.ts`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Data Model**
- **D-01** New tables: `case` (id TEXT PK, user_id FK, person_name TEXT, person_birthdate DATE NULL, notes TEXT NULL, status enum `open|ready_for_pdf|pdf_generated`, created_at, updated_at); `case_document` (id, case_id FK, document_id FK, position INTEGER, added_at) — unique(case_id, document_id); `laufliste` (id, case_id FK, user_id FK, pdf_storage_path, generated_at, document_count INTEGER, file_size INTEGER).
- **D-02** A document may belong to only ONE case at a time. Uniqueness enforced at `case_document.document_id` (violated → offer to move).

**Case UI Surfaces**
- **D-03** New routes: `/cases`, `/cases/new`, `/cases/[id]`.
- **D-04** Add-docs picker shows only `extraction_status=done AND review_status=approved` documents not already in another case. Multi-select.
- **D-05** Re-order via up/down arrows; `position` column is INTEGER.

**Endbeglaubigung + Embassy Static Data**
- **D-06** Endbeglaubigung = **Bundesverwaltungsamt (BVA)** Köln for most docs; **Bundesamt für Justiz (BfJ)** for Führungszeugnisse. Codified in `lib/laufliste/endbeglaubigung.ts` as a hardcoded map.
- **D-07** UAE Embassy data hardcoded in `lib/laufliste/embassy.ts` (single entry).
- **D-08** Special chains: Führungszeugnis → Apostille (no UAE Legalisation); Reisepass → no legalization.

**PDF Generation (Core)**
- **D-09** `@react-pdf/renderer` 4.5 inside a Server Action (`renderToStream` or `renderToBuffer`).
- **D-10** A4 portrait, 20mm margins, Helvetica built-in font.
- **D-11** Per-document section: document header → Step 1 Vorbeglaubigung → Step 2 Endbeglaubigung → Step 3 Legalisation; exceptions for Führungszeugnis and Reisepass.
- **D-12** Page 1 summary: total documents, person name, generation date, page count.
- **D-13** Use `Dokumenten Laufliste Dr. Sandra Hertel-2.pdf` only as visual reference — no pixel matching.

**PDF Storage + Download**
- **D-14** Save to `data/lauflisten/{caseId}-{timestamp}.pdf`. Immutable; regenerating creates a new file + new row.
- **D-15** Download route `/api/cases/[id]/laufliste/[lauflisteId]/download`; auth ownership check; stream; `Content-Disposition: attachment; filename*=UTF-8''Laufliste-{person-slug}-{date}.pdf`.
- **D-16** Case detail shows last Laufliste + Historie of earlier ones.

**Validation**
- **D-17** Case may generate Laufliste only if ≥1 document AND all documents `review_status=approved`.
- **D-18** Re-run authority resolver at generation time (not cached). Input = stored `document_review.corrected_fields`.

**German Copy (D-19)** — fixed strings: `Laufliste`, `Dokumentart`, `Vorbeglaubigung`, `Endbeglaubigung`, `Legalisation durch VAE-Botschaft`, `Besondere Hinweise`, `Person`, `Erstellt am`, `Sonderregelung: Apostille`, `Keine Legalisation erforderlich`.

**Security**
- **D-20** Ownership predicate (`user_id = session.user.id`) on every case route.
- **D-21** Download route verifies session + case ownership + laufliste belongs to case.

### Claude's Discretion

- Exact visual details: section dividers, table widths, font sizes (14pt body / 18pt headings / 10pt small print — planner may tune).
- Case list sort order (default: `updated_at DESC`).
- In-browser PDF preview before download (nice-to-have, deferred).
- Lock behavior when a case document is re-reviewed (soft-lock, warn).

### Deferred Ideas (OUT OF SCOPE)

- Bilingual Laufliste (DE/EN) — Phase 5 ENHC-01
- PDF customization (configurable header, optional sections) — Phase 5 ENHC-01
- Email Laufliste to customer — future
- Digital signatures on PDFs — future
- Status tracking of actual submission — not in scope per CLAUDE.md
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LAFL-01 | PDF generates full authentication chain per document (Vorbeglaubigung → Endbeglaubigung → Legalisation) | `<Document>` / `<Page>` / `<View>` structure; per-doc section template driven by `lib/laufliste/endbeglaubigung.ts` + `lib/laufliste/embassy.ts`; re-runs `resolveAuthority()` per doc at generation time. |
| LAFL-02 | PDF matches existing format and renders German umlauts correctly | Helvetica is built-in and uses WinAnsi encoding — ä/ö/ü/ß/€ are native, no font registration needed. Sample PDF used as layout reference only (no pixel match). |
| LAFL-03 | User can download the generated PDF | Route Handler at `/api/cases/[id]/laufliste/[lauflisteId]/download` streams file bytes with RFC 5987 `Content-Disposition`. Pattern identical to `app/api/documents/[id]/pdf/route.ts`. |
| CASE-01 | User can create a case for a person | New `case` Drizzle table + `/cases/new` Server Action with Zod validation + ownership FK. |
| CASE-02 | User can add multiple documents to a case | `case_document` join with `UNIQUE(document_id)` enforcing D-02; transactional insert at the picker Server Action. |
| CASE-03 | System generates one consolidated Laufliste per case | `LauflisteDocument` React component iterates documents ordered by `case_document.position`; one PDF file; one `laufliste` row per generation. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Stack pins** (must not be changed):
  - Next.js 16.2, React 19.2.5, TypeScript 6.0.2, Tailwind 4.2.0.
  - Drizzle ORM 0.45.2 + better-sqlite3 12.9.0; use `drizzle-kit generate` + `drizzle-kit migrate` for schema changes.
  - `@react-pdf/renderer` 4.5.1 (installed lazily in Phase 4 — not yet in `node_modules`).
  - Zod 4.3.6 for Server Action / form validation.
  - better-auth 1.6.5 for session checks — reuse `auth.api.getSession({ headers: await headers() })` pattern from existing routes.
- **Database:** SQLite file-on-disk; single-writer is ideal. Never switch to Postgres in Phase 4.
- **PDF:** Use `@react-pdf/renderer`, **never** Puppeteer or pdfmake. Use `Helvetica` built-in; no custom font registration (CLAUDE.md: umlauts handled via font descriptors / WinAnsi encoding).
- **Architecture:** Next.js Server Actions + Route Handlers only. No Express, no tRPC.
- **Filesystem:** Local FS storage is the recommended model for single-user internal tool. No Vercel Blob.
- **UI:** shadcn new-york preset already initialized. Install only new components in UI-SPEC (dialog, sheet, checkbox, textarea).
- **Language:** UI may be DE or EN; Laufliste PDF output is always German.

## Standard Stack

### Core (already installed)

| Library | Version | Purpose | Verification |
|---------|---------|---------|--------------|
| next | 16.2.4 | Server Actions + Route Handlers | [VERIFIED: package.json] |
| react | 19.2.5 | UI | [VERIFIED: package.json] |
| drizzle-orm | 0.45.2 | SQLite schema + migrations | [VERIFIED: package.json] |
| better-sqlite3 | 12.9.0 | DB driver | [VERIFIED: package.json] |
| better-auth | 1.6.5 | Session auth | [VERIFIED: package.json] |
| zod | 4.3.6 | Schema validation | [VERIFIED: package.json] |

### New in Phase 4 (install lazily)

| Library | Version | Purpose | Verification |
|---------|---------|---------|--------------|
| @react-pdf/renderer | 4.5.1 | Declarative React PDF rendering on server | [VERIFIED: `npm view @react-pdf/renderer version` → 4.5.1, published 2026-04-15] |

**Installation:**
```bash
npm install @react-pdf/renderer@4.5.1
```

No peer-dependency conflicts with React 19.2 (the package ships its own renderer; it does not use `react-dom`). [CITED: react-pdf.org/documentation — "React-pdf uses a custom reconciler, so it does not depend on react-dom"]

### shadcn components to add on first use

| Component | Reason |
|-----------|--------|
| `dialog` | Remove-doc confirm + regenerate-Laufliste confirm (UI-SPEC) |
| `sheet` | Add-documents picker (UI-SPEC) |
| `checkbox` | Multi-select rows in picker (UI-SPEC) |
| `textarea` | `notes` field on `/cases/new` (UI-SPEC) |

### Alternatives NOT chosen (constrained by CLAUDE.md)

| Instead of | Alternative | Why NOT |
|------------|-------------|---------|
| @react-pdf/renderer | Puppeteer | Downloads Chrome, slow, memory-heavy. CLAUDE.md forbids. |
| @react-pdf/renderer | pdfmake / pdf-lib / PDFKit | Imperative; not idiomatic in a React codebase. |
| Local FS | Vercel Blob / S3 | Single-user internal tool; CLAUDE.md standardizes on local FS. |

## Architecture Patterns

### Module layout

```
lib/
├── cases/
│   ├── schema.ts            # Drizzle table additions (case, case_document, laufliste)
│   ├── queries.ts           # getCaseForUser, listCasesForUser, listCaseDocuments
│   ├── actions.ts           # Server Actions: create, addDocs, removeDoc, reorder
│   └── actions.test.ts      # vitest with createTestDb
├── laufliste/
│   ├── endbeglaubigung.ts   # hardcoded BVA / BfJ map
│   ├── embassy.ts           # hardcoded UAE Embassy Berlin block
│   ├── build-input.ts       # DB rows → render input shape (pure)
│   ├── build-input.test.ts  # pure unit tests, no PDF
│   ├── pdf/
│   │   ├── Document.tsx     # <LauflisteDocument> top-level component
│   │   ├── sections.tsx     # per-document + step subcomponents
│   │   ├── styles.ts        # StyleSheet.create(...) tokens from UI-SPEC PDF type scale
│   │   └── render.ts        # renderToBuffer wrapper
│   ├── storage.ts           # writeLauflisteToDisk(caseId, bytes) → storagePath (mirrors lib/uploads/storage.ts)
│   └── actions.ts           # Server Action: generate()
app/
├── cases/
│   ├── page.tsx             # /cases list
│   ├── new/page.tsx         # /cases/new form
│   └── [id]/page.tsx        # /cases/[id] detail
└── api/cases/[id]/laufliste/[lauflisteId]/download/route.ts
```

### Pattern 1 — Pure render-input builder (testable without PDF)

Separate the "gather data" step (DB + resolver) from the "render React tree" step. The resolver output + document + endbeglaubigung + embassy constants are assembled into a plain JSON shape (`LauflisteInput`) that gets passed to `<LauflisteDocument input={…} />`. Unit tests exercise `buildLauflisteInput()` without ever invoking `@react-pdf/renderer`.

Shape sketch:
```typescript
export type LauflisteInput = {
  person: { name: string; birthdate: string | null };
  generatedAt: Date;
  documents: Array<{
    position: number;
    dokumentart: string;
    ausstellendeBehoerde: string | null;
    ausstellungsort: string | null;
    ausstellungsdatum: string | null;
    vollerName: string | null;
    vorbeglaubigung:
      | { kind: "authority"; authority: AuthorityBlock; needsReview: boolean; specialRules: string | null }
      | { kind: "exception-apostille" }
      | { kind: "exception-reisepass" };
    endbeglaubigung: AuthorityBlock | null;  // null when exception shortcircuits
    legalisation: AuthorityBlock | null;     // null when exception shortcircuits
  }>;
};
```

### Pattern 2 — Server Action invokes renderToBuffer directly

```typescript
// Source: pinned CLAUDE.md pattern; uses React 19.2 Server Actions
"use server";
import { renderToBuffer } from "@react-pdf/renderer";
import { LauflisteDocument } from "@/lib/laufliste/pdf/Document";

export async function generateLauflisteAction(caseId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("UNAUTHORIZED");
  // ... ownership + validation per D-17 ...
  const input = await buildLauflisteInput(caseId, session.user.id, db);
  const buffer = await renderToBuffer(<LauflisteDocument input={input} />);
  const storagePath = await writeLauflisteToDisk(caseId, buffer);
  // insert laufliste row in same transaction as case.status update
}
```

Key points:
- **No `"use client"` anywhere.** `@react-pdf/renderer`'s server API (`renderToStream`, `renderToBuffer`, `renderToFile`) runs entirely in Node. [CITED: react-pdf.org/node]
- `renderToBuffer(element)` returns `Promise<Buffer>`. [CITED: react-pdf.org/node — "Renders and returns a buffer directly"]
- Prefer `renderToBuffer` over `renderToStream` here: (a) we need the file size for the `laufliste` row, which is easier on a Buffer (`buffer.byteLength`); (b) the full PDF fits comfortably in memory for an internal tool; (c) we write once, don't stream to client from the Server Action.

### Pattern 3 — Route Handler streams existing file on download

Mirror existing `app/api/documents/[id]/pdf/route.ts`:
- `export const dynamic = "force-dynamic";`
- Read file with `readFile(abs)` from `node:fs/promises`, return `Response` with `Content-Type: application/pdf`, `Content-Length`, `Content-Disposition: attachment; filename*=UTF-8''…`.
- 401 for no session, 404 for not-owner or not-found, 410 for DB row present but file missing.

### Pattern 4 — PDF React tree structure

```typescript
// Source: @react-pdf/renderer docs — react-pdf.org/components
<Document>
  <Page size="A4" style={styles.page}>
    <View fixed style={styles.header}>{/* page 1 header; see "fixed" note */}</View>
    <View style={styles.summary}>{/* page-1 summary block */}</View>
    {input.documents.map((doc, i) => (
      <View key={doc.position} break={i > 0} wrap={true}>
        {/* Section: doc header + 3 steps */}
      </View>
    ))}
    <Text
      style={styles.footer}
      fixed
      render={({ pageNumber, totalPages }) =>
        `Seite ${pageNumber} von ${totalPages}`
      }
    />
  </Page>
</Document>
```

- `<View break={true}>` forces a page break before that view (React-PDF-specific, not CSS). Use `break={i > 0}` so document 1 starts on page 1; documents 2..N start on fresh pages. [CITED: react-pdf.org/advanced — Page wrapping & breaks]
- `<Page wrap={true}>` (default) lets content flow across pages. `wrap={false}` keeps a View on a single page — useful for small blocks but **dangerous for long sections**; use only on step-level blocks that fit in <½ page.
- `<Text fixed render={({ pageNumber, totalPages }) => … }/>` gives per-page footer page numbers. `fixed` repeats the node on every page. [CITED: react-pdf.org/advanced — Dynamic content]
- Only one `<Page>` component is needed for the whole document; React-PDF handles pagination itself. Do NOT create one `<Page>` per Laufliste-document section.

### Pattern 5 — StyleSheet with PDF type scale

Use `StyleSheet.create(...)` (React-PDF's own, not React-Native's) to centralize the 4-size / 2-weight scale from UI-SPEC. Units are pt. 20mm margin → `padding: "20mm"` works on `<Page>` (React-PDF accepts mm/cm/in/px/pt on style strings). [CITED: react-pdf.org/styling]

```typescript
import { StyleSheet } from "@react-pdf/renderer";

export const styles = StyleSheet.create({
  page: { padding: "20mm", fontFamily: "Helvetica", fontSize: 10, color: "#111111" },
  h1:   { fontSize: 18, fontWeight: "bold" },
  h2:   { fontSize: 12, fontWeight: "bold" },
  body: { fontSize: 10 },
  caption: { fontSize: 8, color: "#555555" },
  hr: { borderBottomWidth: 0.75, borderBottomColor: "#BFBFBF", marginVertical: 8 },
  footer: { position: "absolute", bottom: "10mm", left: 0, right: 0, textAlign: "center", fontSize: 8, color: "#555555" },
  pruefenPill: { backgroundColor: "#FDE68A", paddingHorizontal: 4, paddingVertical: 1, fontWeight: "bold" },
});
```

### Anti-Patterns to Avoid

- **Do NOT register custom fonts.** Helvetica is built-in and its descriptor handles WinAnsi (CP-1252) which includes ä/ö/ü/Ä/Ö/Ü/ß/€. CLAUDE.md explicitly confirms this. Custom TTF/OTF registration via `Font.register()` pulls in fontkit + byte-loading and is unnecessary here. [CITED: react-pdf.org/fonts — built-in standard fonts]
- **Do NOT render to a React-DOM tree.** `@react-pdf/renderer` uses its own reconciler. Do not place `<Document>` inside an app page or component tree. Render it from a Server Action / Route Handler only.
- **Do NOT call `renderToString`** — that method is for debug/internal only and is not a supported public stable API.
- **Do NOT forget `wrap` on long sections.** If a per-document section is taller than one A4 page and has `wrap={false}`, React-PDF throws at render time. Leave wrap at the default (`true`) for the outer section; use `wrap={false}` only on small contact blocks that must stay together.
- **Do NOT hand-roll umlaut escaping.** Pass UTF-8 strings as-is; React-PDF handles encoding.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF generation | Puppeteer/headless-Chrome pipeline | `@react-pdf/renderer` | Massive dependency; we already have React. |
| Pagination | Track y-offset and manually split | `<Page wrap>` + `<View break>` | React-PDF handles column height, widow/orphan via props. |
| Page numbering | Count rows to compute page totals | `<Text fixed render={({pageNumber,totalPages}) => …}/>` | Built-in dynamic rendering. |
| Umlaut encoding | Replace ä→ae before PDF render | Pass UTF-8 directly to Helvetica | Built-in WinAnsi encoding is correct. |
| RFC 5987 Content-Disposition | Handwritten encoder | Follow existing `app/api/documents/[id]/pdf/route.ts` template | Already correct in repo. |
| SQLite transactions for reorder | Two separate UPDATEs | `db.transaction(...)` in Drizzle | Atomic swap of two positions. |
| File-on-disk utility | New writer | Mirror `lib/uploads/storage.ts` exactly | Same shape, same `path.relative` return contract. |
| German slug for filename | Custom transliterator | Hard-code ß→ss/ä→ae/ö→oe/ü→ue in a 20-line util | No npm dep needed; scope is tiny. |

**Key insight:** every sub-problem in Phase 4 either has a React-PDF primitive or a pattern already in-repo. Reach for a library or a new utility only when no Phase 1/2/3 analogue exists.

## Runtime State Inventory

N/A — Phase 4 is additive (new tables, new routes, new module). No rename, refactor, or migration of existing state.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 4 adds tables; no schema rename or column re-type | None |
| Live service config | None — no external services are modified | None |
| OS-registered state | None | None |
| Secrets/env vars | None — no new keys | None |
| Build artifacts | None — installing `@react-pdf/renderer` is a standard npm add; no post-install codegen | None |

## Common Pitfalls

### Pitfall 1: Using `renderToStream` inside a Server Action

**What goes wrong:** `renderToStream` returns a `NodeJS.ReadableStream`. Server Actions marshal return values — streams serialize weirdly. Developers then try to convert to `ArrayBuffer` inside the action, doubling the memory.
**Why it happens:** Examples online usually assume you're in a Route Handler, not a Server Action.
**How to avoid:** Use `renderToBuffer(element)` inside the Server Action; we write the buffer to disk and return only the inserted row's id. For the download Route Handler, serving bytes from disk doesn't need streaming either — `readFile` + `Response(ab, …)` is what the existing `documents/[id]/pdf/route.ts` does.

### Pitfall 2: `<Page wrap={false}>` on a whole Laufliste

**What goes wrong:** Renderer throws if content exceeds one page.
**Why it happens:** Copy-paste from "single-page invoice" examples.
**How to avoid:** Keep `<Page>` at the default wrap (true). If you want per-document sections to stay together when they fit, add `wrap={false}` on the **inner** section View — but only when its height < page height.

### Pitfall 3: Non-atomic document-to-case insert

**What goes wrong:** Two tabs add the same document to different cases simultaneously; without a unique constraint, both succeed.
**Why it happens:** D-02 enforcement placed only in application code.
**How to avoid:** `UNIQUE(case_document.document_id)` at the DB level. Server Action catches `SQLITE_CONSTRAINT_UNIQUE` and returns a structured per-row error that the picker UI surfaces as the toast `Dokument ist bereits einem anderen Fall zugeordnet.` Wrap multi-row inserts in `db.transaction(...)` so partial failures roll back.

### Pitfall 4: Reorder with non-unique positions

**What goes wrong:** Swap positions via two UPDATEs without a transaction → if a unique partial index exists on `(case_id, position)`, the second UPDATE fails; without the index, transient duplicates happen on crash.
**Why it happens:** Swap done in two steps.
**How to avoid:** Don't create a unique index on `(case_id, position)`. Perform the swap in `db.transaction(...)`. If the tests require it, do the classic three-step dance (`UPDATE pos=-1 WHERE id=A; UPDATE pos=A.pos WHERE id=B; UPDATE pos=B.pos WHERE id=A`).

### Pitfall 5: Stale resolver snapshot

**What goes wrong:** Phase 3 wrote `document_review.resolved_authority_id`. Someone reuses that stale FK at Laufliste generation, but the Behörden DB has since been edited.
**Why it happens:** Caching feels like an optimization.
**How to avoid:** D-18 is explicit — call `resolveAuthority()` fresh per document at generation time. Inputs come from `document_review.corrected_fields` (JSON column with `dokumenten_typ`, `bundesland`, `ausstellungsort`).

### Pitfall 6: Claude-PDF renderer + Next.js Turbopack compatibility

**What goes wrong:** Turbopack's bundler may attempt to tree-shake `@react-pdf/renderer`'s native-like deps (`fontkit`, `@react-pdf/textkit`).
**Why it happens:** React-PDF has a chain of nested `@react-pdf/*` packages that need to be treated as server externals.
**How to avoid:** Import the module only in Server Action files / Route Handlers (files with `"use server"` or under `app/api/**`). Never import from a client component. If Turbopack issues appear, add `@react-pdf/renderer` to `serverExternalPackages` in `next.config.ts` (Next 16's replacement for the deprecated `experimental.serverComponentsExternalPackages`). [CITED: nextjs.org/docs/app/api-reference/next-config-js/serverExternalPackages]

### Pitfall 7: Filename with German characters in `Content-Disposition`

**What goes wrong:** `Content-Disposition: attachment; filename="Laufliste-Müller.pdf"` — some clients garble the umlaut.
**Why it happens:** Latin-1 vs UTF-8 header interpretation.
**How to avoid:** RFC 5987 two-form header: `attachment; filename="Laufliste-Mueller.pdf"; filename*=UTF-8''Laufliste-M%C3%BCller.pdf`. The existing `app/api/documents/[id]/pdf/route.ts` already does this correctly — copy that pattern verbatim. The slug path (ß→ss, ä→ae, etc.) goes into the ASCII `filename=`; UTF-8 original goes into `filename*=`.

## Code Examples

### PDF Document component

```typescript
// Source: react-pdf.org/components (HIGH confidence — 4.x API stable)
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { styles } from "./styles";
import type { LauflisteInput } from "../build-input";

export function LauflisteDocument({ input }: { input: LauflisteInput }) {
  return (
    <Document title={`Laufliste ${input.person.name}`}>
      <Page size="A4" style={styles.page}>
        <View>
          <Text style={styles.h1}>Laufliste</Text>
          <Text style={styles.body}>
            <Text style={{ fontWeight: "bold" }}>Person: </Text>
            {input.person.name}
          </Text>
          {/* …birthdate, Erstellt am, Dokumente insgesamt … */}
          <View style={styles.hr} />
        </View>

        {input.documents.map((doc, i) => (
          <DocumentSection key={doc.position} doc={doc} index={i} break={i > 0} />
        ))}

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
```

### Render + persist from Server Action

```typescript
// Source: combines CLAUDE.md Server-Action pattern + react-pdf node API
"use server";
import { renderToBuffer } from "@react-pdf/renderer";
import { LauflisteDocument } from "./pdf/Document";
import { writeLauflisteToDisk } from "./storage";
import { buildLauflisteInput } from "./build-input";

export async function generateLauflisteAction(caseId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false as const, error: "UNAUTHORIZED" };

  return db.transaction(async (tx) => {
    const input = await buildLauflisteInput(caseId, session.user.id, tx);
    if (!input) return { ok: false as const, error: "NOT_FOUND" };
    if (input.documents.length === 0) return { ok: false as const, error: "EMPTY_CASE" };
    if (input.documents.some((d) => d.reviewStatus !== "approved")) {
      return { ok: false as const, error: "UNREVIEWED_DOCS" };
    }

    const bytes = await renderToBuffer(<LauflisteDocument input={input} />);
    const storagePath = await writeLauflisteToDisk(caseId, bytes);

    const id = crypto.randomUUID();
    await tx.insert(laufliste).values({
      id,
      caseId,
      userId: session.user.id,
      pdfStoragePath: storagePath,
      documentCount: input.documents.length,
      fileSize: bytes.byteLength,
    });
    await tx.update(caseTable)
      .set({ status: "pdf_generated", updatedAt: new Date() })
      .where(eq(caseTable.id, caseId));

    return { ok: true as const, lauflisteId: id };
  });
}
```

### Storage helper (mirrors `lib/uploads/storage.ts`)

```typescript
// Source: mirrors lib/uploads/storage.ts verbatim
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

export const LAUFLISTEN_DIR = path.resolve(process.cwd(), "data", "lauflisten");

export async function writeLauflisteToDisk(
  caseId: string,
  bytes: Uint8Array,
): Promise<string> {
  await mkdir(LAUFLISTEN_DIR, { recursive: true });
  const ts = Date.now();
  const abs = path.join(LAUFLISTEN_DIR, `${caseId}-${ts}.pdf`);
  await writeFile(abs, bytes);
  return path.relative(process.cwd(), abs);
}
```

### Download Route Handler

```typescript
// Source: copy of app/api/documents/[id]/pdf/route.ts with ownership chain
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; lauflisteId: string }> },
) {
  const { id: caseId, lauflisteId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const row = await getLauflisteForDownload(caseId, lauflisteId, session.user.id);
  if (!row) return new NextResponse("Not found", { status: 404 });

  const abs = path.isAbsolute(row.pdfStoragePath)
    ? row.pdfStoragePath
    : path.resolve(process.cwd(), row.pdfStoragePath);

  let bytes: Buffer;
  try { bytes = await readFile(abs); }
  catch { return new NextResponse("File missing", { status: 410 }); }

  const asciiName = `Laufliste-${row.personSlug}-${row.generatedDate}.pdf`;
  const utf8Name  = `Laufliste-${row.personName}-${row.generatedDate}.pdf`;

  const ab = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return new Response(ab, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(utf8Name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
```

### Drizzle schema additions

```typescript
// Source: adapted from existing db/schema.ts conventions
export const CASE_STATUS = ["open", "ready_for_pdf", "pdf_generated"] as const;
export type CaseStatus = (typeof CASE_STATUS)[number];

export const caseTable = sqliteTable(
  "case",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    personName: text("person_name").notNull(),
    personBirthdate: text("person_birthdate"), // ISO yyyy-MM-dd, nullable
    notes: text("notes"),
    status: text("status", { enum: CASE_STATUS }).notNull().default("open"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date()).notNull(),
  },
  (t) => [
    index("case_user_idx").on(t.userId),
    index("case_user_updated_idx").on(t.userId, t.updatedAt),
    check("case_status_ck", sql`${t.status} IN ('open','ready_for_pdf','pdf_generated')`),
  ],
);

export const caseDocument = sqliteTable(
  "case_document",
  {
    id: text("id").primaryKey(),
    caseId: text("case_id").notNull().references(() => caseTable.id, { onDelete: "cascade" }),
    documentId: text("document_id").notNull().references(() => document.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    addedAt: integer("added_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`).notNull(),
  },
  (t) => [
    uniqueIndex("case_document_doc_uniq").on(t.documentId),       // D-02: one case per doc
    uniqueIndex("case_document_case_doc_uniq").on(t.caseId, t.documentId),
    index("case_document_case_pos_idx").on(t.caseId, t.position),
  ],
);

export const laufliste = sqliteTable(
  "laufliste",
  {
    id: text("id").primaryKey(),
    caseId: text("case_id").notNull().references(() => caseTable.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    pdfStoragePath: text("pdf_storage_path").notNull(),
    generatedAt: integer("generated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`).notNull(),
    documentCount: integer("document_count").notNull(),
    fileSize: integer("file_size").notNull(),
  },
  (t) => [
    index("laufliste_case_idx").on(t.caseId),
    index("laufliste_case_generated_idx").on(t.caseId, t.generatedAt),
  ],
);
```

Note on `UNIQUE(document_id)`: this is the global uniqueness enforcing D-02 ("a document can only be in ONE case at a time"). The separate `(case_id, document_id)` unique is redundant under that rule but kept for query-plan safety.

### Endbeglaubigung hardcoded map

```typescript
// lib/laufliste/endbeglaubigung.ts
// Source: CONTEXT D-06 — static policy
export type AuthorityBlock = {
  name: string;
  address: string[];     // multi-line
  phone: string | null;
  email: string | null;
  website: string | null;
  officeHours: string | null;
  notes: string | null;
};

export const BUNDESVERWALTUNGSAMT_KOELN: AuthorityBlock = {
  name: "Bundesverwaltungsamt — Endbeglaubigung",
  address: ["Barbarastraße 1", "50735 Köln"],
  phone: "+49 22899 358-0",
  email: "poststelle@bva.bund.de",
  website: "https://www.bva.bund.de",
  officeHours: "Mo–Fr 08:00–16:00",
  notes: null,
};

export const BUNDESAMT_FUER_JUSTIZ_BONN: AuthorityBlock = {
  name: "Bundesamt für Justiz — Apostille",
  address: ["Adenauerallee 99–103", "53113 Bonn"],
  phone: "+49 228 99410-40",
  email: "poststelle@bfj.bund.de",
  website: "https://www.bundesjustizamt.de",
  officeHours: "Mo–Fr 09:00–15:00",
  notes: null,
};

export function endbeglaubigungFor(dokumentTyp: string): AuthorityBlock {
  // Führungszeugnis takes Apostille route via BfJ
  if (/führungszeugnis/i.test(dokumentTyp)) return BUNDESAMT_FUER_JUSTIZ_BONN;
  return BUNDESVERWALTUNGSAMT_KOELN;
}
```

> ⚠️ The phone/email/hours constants above are `[ASSUMED]` placeholder values. The planner must have the user verify exact contact details before Phase 4 ships — or the values should be marked obviously as operator-configurable. The sample Laufliste PDF at repo root is the source of truth; cross-reference it.

### Embassy hardcoded block

```typescript
// lib/laufliste/embassy.ts
// Source: CONTEXT D-07 — single-entry constant
export const UAE_EMBASSY_BERLIN: AuthorityBlock = {
  name: "Botschaft der Vereinigten Arabischen Emirate",
  address: ["Hiroshimastraße 18–20", "10785 Berlin"],
  phone: "+49 30 516516-0",
  email: null,
  website: "https://www.uae-embassy.ae/Embassies/Germany",
  officeHours: "Mo–Do 09:00–13:00",
  notes: "Legalisation nur nach Endbeglaubigung.",
};
```

> ⚠️ All Embassy contact fields `[ASSUMED]`. Verify against the sample Laufliste PDF or the user's current source before locking.

## State of the Art

| Old | Current | When | Impact |
|-----|---------|------|--------|
| `experimental.serverComponentsExternalPackages` | `serverExternalPackages` | Next 15.2 (stable since Next 16) | Only relevant if Turbopack issues appear; stable key exists in `next.config.ts`. |
| Using React `renderToString` for PDF | `renderToBuffer` / `renderToStream` | @react-pdf/renderer 3.x→4.x | Public API consolidated around Buffer/Stream; `renderToString` is internal. |
| Registering DejaVu/Noto fonts for umlauts | Built-in Helvetica | Always | Helvetica's WinAnsi handles all German characters. Custom fonts only needed for non-Latin glyphs. |

**Deprecated / do not use:**
- `Font.registerHyphenationCallback` — use `hyphenationCallback` prop on `<Text>` if needed; unlikely here.
- `@react-pdf/pdfkit` as a direct dep — it's a transitive, not a user-facing API.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Exact contact details of Bundesverwaltungsamt Köln (address, phone, email, hours) | Code Examples — Endbeglaubigung | Inaccurate printed Laufliste → the operator gives the customer a wrong phone or address. HIGH. Planner must have user confirm against sample PDF or up-to-date source. |
| A2 | Exact contact details of Bundesamt für Justiz Bonn for Apostille cases | Code Examples — Endbeglaubigung | Same as A1. HIGH. |
| A3 | Exact contact details of UAE Embassy Berlin | Code Examples — Embassy | Same as A1. HIGH. |
| A4 | `@react-pdf/renderer` 4.5.1 imports cleanly in Next 16.2 Turbopack without explicit `serverExternalPackages` entry | Architecture Patterns Pitfall 6 | LOW — if it fails, add 1 line to `next.config.ts`. Known escape hatch. |
| A5 | React 19 + `@react-pdf/renderer` 4.5 compatibility | Standard Stack | LOW — @react-pdf/renderer uses its own reconciler; does not depend on react-dom version. Confirmed by docs. |
| A6 | `renderToBuffer` accepts a React 19 Server Component element without warnings | Pattern 2 | LOW — the API accepts any React tree using its own component set; nothing is a Server Component *per se*. |

## Open Questions

1. **Page 1 header repeats with `fixed`?**
   - What we know: UI-SPEC says "Page 1 header (appears once on page 1 only)". React-PDF's `fixed` prop repeats on every page.
   - What's unclear: The intended behavior for pages 2..N — UI-SPEC seems to want page 1 header only once, with only the page-number footer repeating.
   - Recommendation: Implement as: page-1 summary is an ordinary (non-`fixed`) `<View>` at the top of the `<Page>`. Footer is the only `fixed` node. This matches UI-SPEC verbatim.

2. **Sample PDF cross-check for exact contact details**
   - Recommendation: Before implementation begins, planner or executor opens `Dokumenten Laufliste Dr. Sandra Hertel-2.pdf` at the repo root and extracts authoritative address/phone/email strings for BVA, BfJ, and UAE Embassy. Those values replace the `[ASSUMED]` constants.

3. **Filename slug character coverage**
   - Recommendation: `ß→ss`, `ä→ae`, `ö→oe`, `ü→ue` plus removing punctuation and whitespace suffices for German names. A 20-line util with a `.replace()` chain is enough; no npm dep.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Next.js 16.2 server runtime | ✓ | (as per project) | — |
| npm | Installing `@react-pdf/renderer` | ✓ | (as per project) | — |
| Filesystem write access to `data/lauflisten/` | D-14 storage | ✓ | — | — (already working for `data/uploads/`) |
| `@react-pdf/renderer` | PDF generation | ✗ (not yet installed) | 4.5.1 on npm | None — this dep is mandatory. Install step is part of the plan. |

**Missing dependencies with no fallback:** `@react-pdf/renderer` — the plan must include `npm install @react-pdf/renderer@4.5.1` as an explicit Wave 0 task.

**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (inferred from existing `lib/**/*.test.ts`) |
| Config file | (existing repo config) |
| Quick run command | `npx vitest run lib/cases lib/laufliste` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CASE-01 | Create-case Server Action validates + inserts row scoped to user | unit | `npx vitest run lib/cases/actions.test.ts -t "creates case"` | ❌ Wave 0 |
| CASE-01 | Zod validation rejects empty person_name | unit | `npx vitest run lib/cases/actions.test.ts -t "rejects empty"` | ❌ Wave 0 |
| CASE-02 | Add-docs action inserts `case_document` rows with sequential positions | unit | `npx vitest run lib/cases/actions.test.ts -t "adds documents"` | ❌ Wave 0 |
| CASE-02 | Cannot add a document already in another case (D-02) | unit | `npx vitest run lib/cases/actions.test.ts -t "rejects cross-case duplicate"` | ❌ Wave 0 |
| CASE-02 | Reorder swaps positions atomically | unit | `npx vitest run lib/cases/actions.test.ts -t "reorder"` | ❌ Wave 0 |
| CASE-03 | `buildLauflisteInput()` composes document + resolved authority + endbeglaubigung + embassy | unit (pure) | `npx vitest run lib/laufliste/build-input.test.ts` | ❌ Wave 0 |
| CASE-03 | Exception routing (Führungszeugnis → Apostille; Reisepass → keine Legalisation) | unit (pure) | `npx vitest run lib/laufliste/build-input.test.ts -t "exception"` | ❌ Wave 0 |
| LAFL-01 | generateLauflisteAction produces non-empty Buffer and writes file to `data/lauflisten/` | integration | `npx vitest run lib/laufliste/actions.test.ts -t "generates pdf"` | ❌ Wave 0 |
| LAFL-01 | D-17 blocker: empty case returns EMPTY_CASE error | unit | `npx vitest run lib/laufliste/actions.test.ts -t "blocks empty"` | ❌ Wave 0 |
| LAFL-01 | D-17 blocker: any unreviewed doc returns UNREVIEWED_DOCS | unit | `npx vitest run lib/laufliste/actions.test.ts -t "blocks unreviewed"` | ❌ Wave 0 |
| LAFL-02 | Rendered PDF Buffer starts with `%PDF-` magic bytes | smoke | `npx vitest run lib/laufliste/render.test.ts -t "magic bytes"` | ❌ Wave 0 |
| LAFL-02 | PDF contains literal substring "Vorbeglaubigung", "Endbeglaubigung", "Laufliste" (grep on raw bytes; fragile — see Open Q4 below) | smoke | `npx vitest run lib/laufliste/render.test.ts -t "contains strings"` | ❌ Wave 0 — **optional** |
| LAFL-03 | Download Route Handler returns 401 unauth, 404 wrong-owner, 200 correct-owner with RFC 5987 header | integration | `npx vitest run app/api/cases/**/download.test.ts` | ❌ Wave 0 |

**On snapshot-testing PDF bytes:** PDF binary output is not deterministic across renderer versions (fonts embed metadata; timestamps; object IDs). **Do not snapshot the raw Buffer.** Instead:
- Snapshot the **render input JSON** (`buildLauflisteInput()` output) — this is pure data, fully deterministic, and exercises 95% of the logic.
- Smoke-test the rendered Buffer only for (a) starts with `%PDF-` magic bytes, (b) byteLength > 1 KB, (c) contains specific UTF-8 literals visible in the raw bytes (works because Helvetica/WinAnsi encoded text is visible as-is in content streams).
- Skip visual diffing entirely in v1.

### Sampling Rate

- **Per task commit:** `npx vitest run lib/cases lib/laufliste` (~15 fast tests, sub-second)
- **Per wave merge:** `npx vitest run` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `lib/cases/actions.test.ts` — CASE-01, CASE-02
- [ ] `lib/cases/queries.ts` + colocated test — list / get / ownership
- [ ] `lib/laufliste/build-input.test.ts` — CASE-03 composition, exception routing
- [ ] `lib/laufliste/render.test.ts` — LAFL-02 smoke (magic bytes + size + literal grep)
- [ ] `lib/laufliste/actions.test.ts` — LAFL-01 generate + persist
- [ ] `app/api/cases/[id]/laufliste/[lauflisteId]/download/route.test.ts` — LAFL-03 download auth matrix
- [ ] Install: `npm install @react-pdf/renderer@4.5.1`

## Sources

### Primary (HIGH confidence)

- `@react-pdf/renderer` on npm — `npm view @react-pdf/renderer version` → **4.5.1** published **2026-04-15T23:30:17Z** [VERIFIED: npm registry, 2026-04-17]
- [react-pdf.org documentation](https://react-pdf.org/documentation) — component list, StyleSheet API, layout
- [react-pdf.org node API](https://react-pdf.org/node) — `renderToBuffer`, `renderToStream`, `renderToFile`
- [react-pdf.org advanced](https://react-pdf.org/advanced) — `break`, `wrap`, `fixed`, `render` callbacks
- [react-pdf.org fonts](https://react-pdf.org/fonts) — built-in Helvetica, standard 14 PDF fonts
- [react-pdf.org styling](https://react-pdf.org/styling) — units (mm, cm, pt, px)
- Existing repo code:
  - `lib/uploads/storage.ts` — canonical FS-write pattern
  - `app/api/documents/[id]/pdf/route.ts` — canonical download pattern with RFC 5987
  - `lib/behoerden/resolve.ts` — resolver to re-invoke per D-18
  - `db/schema.ts` — conventions for Drizzle SQLite tables, relations, checks

### Secondary (MEDIUM confidence)

- [Next.js 16 `serverExternalPackages` config reference](https://nextjs.org/docs/app/api-reference/next-config-js/serverExternalPackages) — fallback for Turbopack issues
- CLAUDE.md pins — `@react-pdf/renderer` 4.5.1, Helvetica umlaut handling declared verified

### Tertiary (LOW confidence) — assumed, needs user verification

- Address / phone / email / office hours for BVA Köln, BfJ Bonn, UAE Embassy Berlin — `[ASSUMED]` placeholders in Code Examples. Must be verified against the sample PDF (`Dokumenten Laufliste Dr. Sandra Hertel-2.pdf`) before shipping.

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| Standard stack | HIGH | All versions pinned in CLAUDE.md; `@react-pdf/renderer` 4.5.1 verified via npm registry today |
| Architecture | HIGH | All patterns have in-repo precedents (uploads/storage, documents/pdf route, review actions) |
| Drizzle schema | HIGH | Shape mirrors existing Phase 2/3 conventions; every column and index pattern exists already in `db/schema.ts` |
| PDF rendering | HIGH | @react-pdf/renderer 4.x API is stable; pitfalls well-documented |
| Static Endbeglaubigung/Embassy data | LOW | Contact details marked `[ASSUMED]` — must be verified from sample PDF |
| Testing strategy | HIGH | Snapshot-testing-the-input pattern is standard; bytes-smoke is sufficient for binary output |

**Research date:** 2026-04-17
**Valid until:** 2026-05-17 (stable stack, 30-day validity)
