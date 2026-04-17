# Phase 5 — Human UAT Items (Deferred)

**Status:** pending
**Auto-approved:** 2026-04-17 in autonomous mode
**Source:** 05-05-PLAN.md Task 05-05-02 (human-verify checkpoint)

These 8 UAT items require a real browser + live app session. They were
auto-approved so the phase can close; the operator should work through them
when a browser session becomes available and update the checkbox column below.

## Setup

Start dev server: `npm run dev` → http://localhost:3000

Prereqs:

- Logged in as the seeded user.
- At least 2-3 approved documents and 1-2 Lauflisten exist (run through Phase 2-4 UAT first if starting clean).
- For reanalyze flow: a live `ANTHROPIC_API_KEY` in `.env.local` (synthetic placeholder will fail gracefully).

## Items

| # | Status | Item |
| - | ------ | ---- |
| 1 | [ ] | **/history list renders** — `/history` shows a table of prior Lauflisten with date, person name, document count, size; `Herunterladen` link per row returns PDF |
| 2 | [ ] | **/history search filter** — type in the search box → 300ms debounce → list narrows to rows whose `personName` contains the query (case-insensitive, umlaut-safe); URL updates with `?q=…`; `Zurücksetzen` clears |
| 3 | [ ] | **/history date range filter** — pick `Von` / `Bis` dates → list narrows inclusively; URL updates with `?from=YYYY-MM-DD&to=YYYY-MM-DD`; combining with search works |
| 4 | [ ] | **Nav links (Historie + Behörden)** — top nav shows both links on every app page; clicking each navigates correctly; active link styled |
| 5 | [ ] | **Re-upload dialog + version bump** — on `/documents/[id]` click `Neuen Scan hochladen` → dialog opens → drop a PDF → `Hochladen` → toast success → page refreshes → header shows `Version 2` → a `document_version` row exists for v1 (check via Drizzle Studio) |
| 6 | [ ] | **Re-analyze triggers extraction** — click `Erneut analysieren` on doc detail → button shows `Wird analysiert …` → after ~3-8s the extraction table updates with fresh values; `extraction_status` flips to `done` |
| 7 | [ ] | **Admin authorities edit form** — `/admin/behoerden/authorities` → filter/search/state/docType/needsReview all narrow table; `Bearbeiten` on a row → edit all contact fields (phone/email/website/office hours/notes/special rules) → save → toast + redirect → changes persisted |
| 8 | [ ] | **Admin document types add/edit** — `/admin/behoerden/document-types` → add new type (`Testurkunde`) → slug `testurkunde` appears in list; edit display name of existing type → saves; DUPLICATE rejection on second add with same slug |

## Report

When all items pass, set the status column to [x] and flip `Status:` above to
`approved`. Any failures open a gap-closure cycle via `/gsd-plan-phase --gaps`.

Known visual nits (exact font size, divider weight, spacing) are within
Claude's Discretion per 05-CONTEXT.md and are acceptable.
