---
phase: 04-laufliste-generation-cases
plan: 03
subsystem: laufliste-pdf-generator
tags: [pdf, react-pdf, laufliste, storage, helvetica, umlauts]

requires:
  - phase: 04-laufliste-generation-cases
    plan: 01
    provides: Drizzle table shapes (consumer Plan 04 will compose LauflisteInput from these)

provides:
  - "LauflisteInput / AuthorityBlock / VorbeglaubigungBlock / LauflisteDocumentEntry types (lib/laufliste/types.ts)"
  - "BUNDESVERWALTUNGSAMT_KOELN + BUNDESAMT_FUER_JUSTIZ_BONN static authority blocks + endbeglaubigungFor() routing (lib/laufliste/endbeglaubigung.ts)"
  - "UAE_EMBASSY_BERLIN static authority block (lib/laufliste/embassy.ts)"
  - "slugifyPersonName() — ASCII slug util with ß/ä/ö/ü expansion + 'unbekannt' fallback (lib/laufliste/slug.ts)"
  - "<LauflisteDocument> React-PDF root component (lib/laufliste/pdf/Document.tsx)"
  - "renderLaufliste(input): Promise<Buffer> thin wrapper around @react-pdf/renderer (lib/laufliste/pdf/render.ts)"
  - "writeLauflisteToDisk(caseId, bytes) + LAUFLISTEN_DIR filesystem helper (lib/laufliste/storage.ts)"

affects:
  - none (fully additive; no existing code touched)

tech-stack:
  added:
    - "@react-pdf/renderer 4.5.1 (already in package.json; first Phase-4 usage)"
  patterns:
    - "Pure render-input shape decouples DB/resolver stage from PDF tree (RESEARCH Pattern 1)"
    - "renderToBuffer inside Server Action (not renderToStream) per RESEARCH Pitfall 1"
    - "Single <Page> + <View break={i > 0}> for automatic pagination (RESEARCH Pattern 4)"
    - "<Text fixed render={({pageNumber, totalPages}) => ...}/> for page-number footer"
    - "StyleSheet.create(...) with tokens from UI-SPEC PDF Layout Contract"
    - "writeLauflisteToDisk mirrors lib/uploads/storage.ts 1:1 (same path.relative return contract)"
    - "Helvetica built-in font handles ä/ö/ü/ß/€ via WinAnsi — no Font.register() needed"

key-files:
  created:
    - lib/laufliste/types.ts
    - lib/laufliste/endbeglaubigung.ts
    - lib/laufliste/embassy.ts
    - lib/laufliste/slug.ts
    - lib/laufliste/slug.test.ts
    - lib/laufliste/pdf/styles.ts
    - lib/laufliste/pdf/sections.tsx
    - lib/laufliste/pdf/Document.tsx
    - lib/laufliste/pdf/render.ts
    - lib/laufliste/pdf/render.test.ts
    - lib/laufliste/storage.ts
  modified: []

decisions:
  - "Used React.createElement(LauflisteDocument, { input }) with DocumentProps cast in render.ts instead of TSX, because the render-wrapper is a .ts file — avoids unnecessary file-extension churn and keeps the JSX isolated to Document.tsx + sections.tsx where it belongs."
  - "Kept authority contact fields as research defaults with explicit @assumed JSDoc; downstream plans should verify against the sample Laufliste PDF at repo root before production ship. Operator can update the constants without touching render logic."
  - "Skipped snapshot-testing of raw PDF bytes per RESEARCH Validation Architecture — PDF output is non-deterministic across renderer versions (font metadata, object IDs). Smoke test asserts %PDF- magic + byteLength > 1KB + exception routing executes cleanly."
  - "Used path-injection-safe design: caseId is expected to be a server-generated UUID (documented in storage.ts JSDoc as the T-04-10 mitigation). File names are `${caseId}-${Date.now()}.pdf`; no user-controlled path segments."
  - "Split Endbeglaubigung title into 'Endbeglaubigung' vs 'Endbeglaubigung (Apostille)' for Führungszeugnis, making the exception visible in the section header rather than only implicit via the authority block."

metrics:
  tasks_completed: 3
  tests_added: 12
  files_created: 11
  duration_minutes: 7
  completed_date: 2026-04-17
---

# Phase 04 Plan 03: Laufliste PDF Generator Summary

**One-liner:** Pure React-PDF generator module that turns a `LauflisteInput` shape into a Buffer of A4 German-language PDF bytes, with static BVA/BfJ/UAE Embassy data, Helvetica built-in umlaut handling, Führungszeugnis/Reisepass exception routing, and a filesystem helper that mirrors Phase 2's upload storage 1:1.

## What Shipped

1. **Types contract (`lib/laufliste/types.ts`)** — Pure-data boundary between the DB/resolver stage (Plan 04) and the PDF renderer (this plan). Three discriminated `VorbeglaubigungBlock` variants (`authority`, `exception-apostille`, `exception-reisepass`) drive all exception rendering.

2. **Static authority data (`lib/laufliste/endbeglaubigung.ts`, `lib/laufliste/embassy.ts`)** — BVA Köln for most document types, BfJ Bonn for Führungszeugnisse (case-insensitive substring routing), UAE Embassy Berlin. All fields explicitly marked `@assumed` with JSDoc pointing to the sample Laufliste PDF as source of truth.

3. **Slug util (`lib/laufliste/slug.ts`)** — 20-line `.replace()` chain with German umlaut expansion (ß→ss, ä→ae, ö→oe, ü→ue + uppercase variants), collapse-to-dashes, and `"unbekannt"` empty fallback. Covers the filename contract from UI-SPEC.

4. **React-PDF tree (`lib/laufliste/pdf/Document.tsx` + `sections.tsx` + `styles.ts`)** — Single `<Page size="A4">` with page-1 header (non-fixed), per-document sections with `break={index > 0}` for auto-pagination, and `<Text fixed render={...}/>` footer for page numbers. Styles carry the UI-SPEC 18/12/10/8pt scale + `#FDE68A` amber `[PRÜFEN]` pill + `#BFBFBF` dividers. Missing fields render as muted `— nicht erkannt` (extractor gaps) or `— nicht hinterlegt` (authority DB gaps).

5. **Render wrapper (`lib/laufliste/pdf/render.ts`)** — `renderLaufliste(input): Promise<Buffer>` calls `renderToBuffer` from `@react-pdf/renderer`. Uses `React.createElement` + `DocumentProps` cast at the boundary so it stays a `.ts` file.

6. **Storage helper (`lib/laufliste/storage.ts`)** — `writeLauflisteToDisk(caseId, bytes)` writes to `data/lauflisten/{caseId}-${Date.now()}.pdf` and returns a repo-relative path. Mirrors `lib/uploads/storage.ts` verbatim.

## Tests

**12 tests, 12 green:**

| File | Tests | Coverage |
|------|-------|----------|
| `lib/laufliste/slug.test.ts` | 9 | slug umlaut expansion, punctuation, empty input, uppercase; endbeglaubigungFor Führungszeugnis substring routing + BVA default |
| `lib/laufliste/pdf/render.test.ts` | 3 | `%PDF-` magic bytes on rendered Buffer; byteLength > 1KB for 3-doc input; exception routing (Führungszeugnis + Reisepass) renders without throwing |

All tests use `@vitest-environment node` (React-PDF needs Node APIs, not happy-dom).

## Verification Evidence

- `npx vitest run lib/laufliste` → 12/12 passed in ~900 ms.
- `npx tsc --noEmit` → zero errors across the whole project.
- `grep -r 'use client' lib/laufliste` → only a comment instructing NOT to add it.
- `grep -r 'renderToStream' lib/laufliste` → only a documentation comment; runtime uses `renderToBuffer`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed TS2345 in render.ts element typing**
- **Found during:** Task 3 tsc verification (after smoke tests passed)
- **Issue:** `renderToBuffer` expects `ReactElement<DocumentProps>` but `React.createElement(LauflisteDocument, { input })` resolves to `ReactElement<unknown>` because `LauflisteDocument`'s return type does not expose the `@react-pdf/renderer` Document prop shape in its React return signature.
- **Fix:** Added `import { type DocumentProps } from "@react-pdf/renderer"` and cast the created element via `as unknown as React.ReactElement<DocumentProps>` at the boundary. Runtime behavior unchanged.
- **Files modified:** `lib/laufliste/pdf/render.ts`
- **Commit:** `3f39723`

## Known Stubs

- **BVA / BfJ / UAE Embassy contact fields (`lib/laufliste/endbeglaubigung.ts`, `lib/laufliste/embassy.ts`)** — Phone / e-mail / office-hours values are research defaults marked with `@assumed` JSDoc. They are NOT stubs blocking the plan goal (PDF generates correctly and is structurally complete) but the operator must cross-check them against the sample Laufliste PDF at repo root (`Dokumenten Laufliste Dr. Sandra Hertel-2.pdf`) before a customer-facing print. This cross-check was deferred because `pdftoppm` is not installed on the runtime, preventing automated extraction; a future plan or a manual pass can update the constants without any render-logic change.

## Key Decisions Made

1. **Section-title disambiguation for Apostille exception** — rather than only swapping the authority-block payload inside a "Endbeglaubigung" section for Führungszeugnisse, the section title itself becomes "Endbeglaubigung (Apostille)". Operators scanning the PDF immediately see the exception instead of having to parse the authority name.
2. **`renderToBuffer` over `renderToStream`** — Plan 04 needs `buffer.byteLength` for the `laufliste.file_size` column. Buffering is cheap (single-user, ≤10 docs).
3. **Path-injection mitigation documented at the storage site** — T-04-10 annotated directly on `writeLauflisteToDisk` so a future developer adding a second caller must notice the `caseId` contract.
4. **No custom fonts** — Helvetica's WinAnsi encoding handles every German character the Laufliste needs; `Font.register()` would pull fontkit + bytes-loading for zero benefit.

## Threat Flags

None. The plan stays inside the documented threat model:
- T-04-10 (path traversal) — mitigated via JSDoc contract on `caseId` + `Date.now()` suffix; no path separators possible with UUID caseIds.
- T-04-11 (info disclosure of PDFs) — accepted; `data/lauflisten/` remains outside `public/`.
- T-04-12 (DoS from huge cases) — accepted; in-memory Buffer is fine for internal single-user tool.
- T-04-13 (UTF-8 umlauts) — mitigated by Helvetica WinAnsi.

No new endpoints, auth paths, or trust boundaries introduced.

## For Plan 04 (Generate Action)

Plan 04 will compose the flow:
```ts
const input = await buildLauflisteInput(caseId, userId, tx);        // DB + resolver
const bytes = await renderLaufliste(input);                          // this plan
const storagePath = await writeLauflisteToDisk(caseId, bytes);       // this plan
await tx.insert(laufliste).values({                                  // this plan's schema
  id: crypto.randomUUID(),
  caseId, userId,
  pdfStoragePath: storagePath,
  documentCount: input.documents.length,
  fileSize: bytes.byteLength,
});
```

All four steps compose cleanly in a single `db.transaction(...)` because `renderLaufliste` + `writeLauflisteToDisk` are pure / side-effect-clear.

## Self-Check: PASSED

Files verified:
- FOUND: lib/laufliste/types.ts
- FOUND: lib/laufliste/endbeglaubigung.ts
- FOUND: lib/laufliste/embassy.ts
- FOUND: lib/laufliste/slug.ts
- FOUND: lib/laufliste/slug.test.ts
- FOUND: lib/laufliste/pdf/styles.ts
- FOUND: lib/laufliste/pdf/sections.tsx
- FOUND: lib/laufliste/pdf/Document.tsx
- FOUND: lib/laufliste/pdf/render.ts
- FOUND: lib/laufliste/pdf/render.test.ts
- FOUND: lib/laufliste/storage.ts

Commits verified:
- FOUND: f31a26f (Task 1 — types + static data + slug)
- FOUND: b2e8ed6 (Task 2 — React-PDF tree)
- FOUND: 3f39723 (Task 3 — render + storage + smoke test)
