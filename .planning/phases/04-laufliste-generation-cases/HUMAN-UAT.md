# Phase 4 — Human UAT Items (Deferred)

**Status:** pending
**Auto-approved:** 2026-04-17 in autonomous mode
**Source:** 04-06-PLAN.md Task 3 (human-verify checkpoint)

These 10 UAT items require a real browser + visual PDF inspection. They were
auto-approved so the phase can close; the operator should work through them
when a browser + sample PDF session becomes available and update the checkbox
column below.

## Setup

Start dev server: `npm run dev` → http://localhost:3000

## Items

| # | Status | Item |
| - | ------ | ---- |
| 1 | [ ] | **Create case** — `/cases/new` → `Dr. Müller-Özgür Weiß` → redirect to `/cases/[id]` + toast "Fall angelegt." |
| 2 | [ ] | **Add documents** — click `Dokumente hinzufügen` → sheet opens right → select 2-3 approved docs → `{n} hinzufügen` → toast `{n} Dokumente hinzugefügt.` + sheet closes + table shows positions 1..N |
| 3 | [ ] | **Reorder** — ↓ on row 1 → rows 1-2 swap → screen reader announces `Position 2 von N.` |
| 4 | [ ] | **Remove** — `Entfernen` → dialog with exact copy → Cancel preserves state; Confirm renumbers 1..N-1 |
| 5 | [ ] | **Blocker banners** — zero docs shows `Bitte mindestens ein Dokument hinzufügen.` + CTA disabled; unapproved doc shows `Mindestens ein Dokument ist noch nicht geprüft.` + CTA disabled |
| 6 | [ ] | **Generate Laufliste** — button disables + label `Laufliste wird erstellt …`; < 5s; toast `Laufliste erstellt.`; Laufliste card shows `Zuletzt erstellt am …` + `Herunterladen` |
| 7 | [ ] | **Download + visual PDF** — open in Preview/Acrobat: umlauts ä/ö/ü/ß/Ä/Ö/Ü render; A4 ~20mm margins; page-1 header (Laufliste + Person + Erstellt am + Dokumente insgesamt); per-doc `{n}. Dokument — {Dokumenttyp}` title; 3 step sections (or exception path for Führungszeugnis/Reisepass); `Seite X von Y` footer; `[PRÜFEN]` amber pill when needsReview. Filename `Laufliste-dr-mueller-oezguer-weiss-YYYY-MM-DD.pdf`. |
| 8 | [ ] | **Regenerate** — `Erneut generieren` → dialog → Confirm → new Laufliste; Historie section shows prior generation with `Herunterladen`; prior download returns same bytes (D-14 immutability) |
| 9 | [ ] | **Cross-case constraint** — create second case; picker does NOT show docs already assigned to first case; race via two tabs shows toast `Dokument ist bereits einem anderen Fall zugeordnet.` |
| 10 | [ ] | **Ownership guard** — logout + visit `/cases/[id]` → redirect to `/login`; as different user visit another user's case id → 404 |

## Report

When all items pass, set the status column to [x] and flip `Status:` above to
`approved`. Any failures open a gap-closure cycle via `/gsd-plan-phase --gaps`.

Known visual nits (exact font size, divider weight, spacing) are within
Claude's Discretion per 04-CONTEXT.md and are acceptable.
