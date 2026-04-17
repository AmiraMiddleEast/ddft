---
phase: 03-review-authority-lookup
verified: 2026-04-17T14:35:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification: null
gaps: []
deferred: []
human_verification:
  - test: "Two-column layout at >= 1024px: navigate to /documents/[id]/review for a done-status document"
    expected: "PDF iframe renders on the left (~640px min), ReviewForm on the right, ~32px gap, aligned tops"
    why_human: "CSS grid layout cannot be asserted programmatically — requires live browser at a specific viewport"
  - test: "Stacked layout at < 1024px: resize browser to 900px wide on the review page"
    expected: "PDF section above form, both full width, no horizontal overflow"
    why_human: "Responsive breakpoint behaviour requires live rendering"
  - test: "Field editing + dirty indicator: open review page, change Dokumenttyp Select value"
    expected: "Changed field shows 2px primary left border, 'Ursprünglich: {original}' caption; reverting removes both"
    why_human: "CSS class application on interaction is not verifiable without a browser"
  - test: "Bundesland Select: open the Bundesland dropdown"
    expected: "All 16 German states listed alphabetically, plus 'Unbekannt / Sonstiges' at the end"
    why_human: "Dropdown option count and ordering requires visual browser inspection"
  - test: "Confidence badges: inspect each field label area"
    expected: "Hoch / Mittel / Niedrig badge appears beside each field label, badge colour matches severity"
    why_human: "Visual badge rendering and colour cannot be tested programmatically"
  - test: "Submit matched: fill in valid Dokumenttyp + Bundesland for which seeded data resolves unambiguously, click 'Speichern & Behörde ermitteln'"
    expected: "Button disables with spinner + 'Behörde wird ermittelt …' while pending; success toast 'Zuständige Behörde ermittelt.' fires; AuthorityResultPanel appears with authority name, contact definition list (Anschrift, Telefon, E-Mail, Website, Öffnungszeiten), and 'Angaben bitte prüfen' PRÜFEN banner (all seeded rows have needs_review=true)"
    why_human: "End-to-end user flow including loading state and toast requires live browser — note: seeded authority data is SYNTHETIC PLACEHOLDERS; real contact fields (phone, email, website, office_hours) will be empty until re-seeded with a real ANTHROPIC_API_KEY"
  - test: "Submit ambiguous: select a Bundesland that has Regierungsbezirke (Bayern, BW, Hessen, NRW) and enter an Ausstellungsort not in the city map"
    expected: "AuthorityResultPanel shows 'Mehrere Behörden möglich', warning banner, candidate table with 'Diese Behörde übernehmen' buttons; clicking a button transitions to matched variant with success toast"
    why_human: "Multi-step interactive flow requires live browser"
  - test: "Submit not_found: select 'Unbekannt / Sonstiges' as Bundesland"
    expected: "AuthorityResultPanel shows 'Keine Behörde gefunden' destructive heading + CircleAlert icon + 'Eingaben anpassen' CTA; CTA scrolls focus to Dokumenttyp field"
    why_human: "Scroll-and-focus behaviour and destructive styling require live browser"
  - test: "Verwerfen + DiscardDialog: edit a field, click 'Verwerfen'"
    expected: "Dialog appears with 'Änderungen verwerfen?' heading, 'Verwerfen' and 'Abbrechen' buttons; 'Abbrechen' dismisses dialog and preserves edits; 'Verwerfen' reverts all fields and clears any result panel"
    why_human: "Modal interaction flow requires live browser"
  - test: "beforeunload guard: edit a field, then close the browser tab or navigate away"
    expected: "Browser shows 'changes will be lost' native dialog"
    why_human: "window.beforeunload behaviour requires live browser interaction"
  - test: "Full contact data accuracy: re-run 'ANTHROPIC_API_KEY=<real key> npm run seed:behoerden -- --force', then repeat matched submission"
    expected: "Authority card shows real name, address, phone, email, website and office_hours (not 'Platzhalter' values)"
    why_human: "Data quality verification requires a real Anthropic API key and re-seeding the DB; cannot be automated without credentials"
---

# Phase 3: Review & Authority Lookup — Verification Report

**Phase Goal:** User can verify and correct AI extraction results, then trigger authority lookup to see the correct Vorbeglaubigung authority with full contact details
**Verified:** 2026-04-17T14:35:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User sees the original PDF side-by-side with extracted data and can compare them visually | VERIFIED | `app/(app)/documents/[id]/review/page.tsx` renders two-column layout with `<PdfPreview>` left and `<ReviewForm>` right inside `lg:grid-cols-[1fr_minmax(420px,520px)]`. `PdfPreview` is wired to `/api/documents/[id]/pdf` route handler (Phase 2). Server Component gate: only `extractionStatus === "done"` documents reach this page. |
| 2 | User can edit any extracted field inline, with Bundesland and Dokumententyp selectable from constrained dropdown lists | VERIFIED | `ReviewForm.tsx` renders 6 controlled fields: Dokumenttyp + Bundesland use `<Select>` from shadcn (`components/ui/select.tsx`), populated from `listDocumentTypes()` and `listStates()` respectively. Four other fields use `<Input>`. `FieldRow.tsx` shows confidence badge and dirty indicator per field. Zod validation via `CorrectedFieldsSchema` guards min-length on routing fields. |
| 3 | User can approve extraction results, triggering the system to look up the correct Vorbeglaubigung authority from the Behoerden database | VERIFIED | `approveAndResolve()` in `lib/review/actions.ts` chains: session gate → Zod validation → ownership check → `resolveAuthority()` → transactional upsert into `document_review` + flip `document.reviewStatus = 'approved'`. Unique index `doc_review_doc_uniq` prevents duplicates. Server Action is called from `ReviewForm.onSubmit()` via `useTransition`. |
| 4 | After approval, system displays the resolved authority with full contact details (name, address, phone, email, office hours, website) | VERIFIED (mechanism) — DATA: SYNTHETIC PLACEHOLDER | `AuthorityResultPanel` matched variant renders authority name, `ContactBlock` with Anschrift / Telefon / E-Mail / Website / Öffnungszeiten from the `AuthorityRow`. DB has 188 authority rows seeded, but all have `phone=null`, `email=null`, `website=null`, `office_hours=null`, name/address are "Platzhalter — ..." values. Mechanism is correct; real data requires re-seeding with a live `ANTHROPIC_API_KEY`. |
| 5 | System correctly handles Regierungsbezirk sub-routing and displays special routing rules and exceptions where applicable | VERIFIED (mechanism) — DATA: SYNTHETIC | `resolveAuthority()` routes through `cityToRegierungsbezirk()` for the four RBz states (Bayern, BW, Hessen, NRW). Ambiguous fallback covers unknown cities. DB has `hat_regierungsbezirke=1` for 9 states. 32 authority rows have non-null `special_rules` (confirmed in DB). `AuthorityResultPanel` `MatchedVariant` renders `PruefenBanner` when `needs_review=true` and `specialRules` callout when present. 22 resolver unit tests pass including Pitfall-4 (unknown city → ambiguous), Pitfall-6 (short slug → exact match), and special_rules cases. |

**Score:** 5/5 truths verified

### Data Quality Note

All 188 authority rows in `data/angela.db` are **synthetic placeholders** (name contains "Platzhalter —", address is "Adresse folgt, ...", all contact fields null). The lookup mechanism is fully implemented and tested against a synthetic fixture, but real authority contact accuracy (LKUP-04) cannot be confirmed without running `ANTHROPIC_API_KEY=<real_key> npm run seed:behoerden -- --force`.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `db/schema.ts` | behoerdenState, behoerdenRegierungsbezirk, behoerdenDocumentType, behoerdenAuthority, documentReview tables + REVIEW_STATUS + LOOKUP_STATUS constants | VERIFIED | All 5 tables present. Constants hoisted above `document` table definition. CHECK constraints on `document.review_status` and `document_review.lookup_status`. FK CASCADE/SET NULL correct. |
| `lib/behoerden/resolve.ts` | Pure resolveAuthority(input, db) → discriminated union | VERIFIED | 199 lines. Exports `resolveAuthority`, `ResolverInput`, `AuthorityRow`, `ResolverResult`, `ResolverDb`. Fuzzy threshold with length guard implemented. Wired into `lib/review/actions.ts`. |
| `lib/behoerden/queries.ts` | listDocumentTypes() + listStates() server-only loaders | VERIFIED | Both functions query DB with `asc()` ordering. `server-only` import present. Wired into `app/(app)/documents/[id]/review/page.tsx`. |
| `lib/review/actions.ts` | approveAndResolve + chooseAmbiguousAuthority Server Actions | VERIFIED | Both actions present. `"use server"` directive. Session gate, Zod validation, ownership check, resolver call, sync transaction. `chooseAmbiguousAuthority` has state-scope guard (WR-01 fix). Transaction wrapped in try/catch (CR-01 fix). Upsert via `onConflictDoUpdate` (CR-03 fix). |
| `app/(app)/documents/[id]/review/page.tsx` | Server Component route with PDF + ReviewForm side-by-side | VERIFIED | Loads doc, extractions, docTypes, states in parallel. Gates on `extractionStatus === "done"`. Renders `PdfPreview` + `ReviewForm` in responsive grid. |
| `app/(app)/documents/[id]/review/_components/ReviewForm.tsx` | 6-field controlled form + dirty tracking + Server Action call | VERIFIED | 384 lines. All 6 fields present with correct controls. `beforeunload` guard via `useEffect` with memoized `anyDirty` (WR-05 fix). `approveAndResolve` called via `useTransition`. `chooseAmbiguousAuthority` called with `choosePending` guard (WR-03 fix). Wires `AuthorityResultPanel` with result. |
| `app/(app)/documents/[id]/review/_components/AuthorityResultPanel.tsx` | matched/ambiguous/not_found variants | VERIFIED | All three variants present and exhaustive. `ContactBlock` renders all 5 contact fields with empty-value fallback. `PruefenBanner` for `needs_review` and ambiguous. `NotFoundVariant` with destructive styling and `onAdjustInputs` CTA. |
| `app/(app)/documents/[id]/review/_components/FieldRow.tsx` | Label + confidence badge + dirty indicator + control slot | VERIFIED | Confidence badge with correct label/variant mapping. 2px left border on `isDirty`. "Ursprünglich:" caption when dirty. |
| `app/(app)/documents/[id]/review/_components/DiscardDialog.tsx` | Accessible discard confirmation modal | VERIFIED | File exists. Hand-rolled `role=alertdialog` per CONTEXT D-17. |
| `app/(app)/documents/[id]/_components/ReviewLinkButton.tsx` | Enabled-when-done link-as-button | VERIFIED | File exists. Wired into `documents/[id]/page.tsx`. |
| `lib/behoerden/slug.ts` | German-aware slugify | VERIFIED | Handles ä→ae, ö→oe, ü→ue, ß→ss, soft hyphen, NFKD, idempotent. |
| `lib/behoerden/city-to-regierungsbezirk.ts` | City→RBz map for BY/BW/HE/NRW | VERIFIED | 47+31+22+41 cities. Both umlaut and ASCII spellings. |
| `components/ui/select.tsx` | shadcn Select primitive | VERIFIED | File present. Exports confirmed: `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`. |
| `__tests__/phase3-integration.test.ts` | End-to-end integration suite | VERIFIED | 7 tests: matched, ambiguous, not_found, special_rules, full-contact, upsert, chooseAmbiguous transition. All pass. |
| `__tests__/review/page.test.tsx` | Server Component branch tests | VERIFIED | 4 tests: unauth → redirect, foreign doc → notFound, non-done → redirect, done → render. All pass. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `review/page.tsx` | `lib/behoerden/queries.ts` | `listDocumentTypes()` + `listStates()` | WIRED | Called in `Promise.all()`, results passed as props to `ReviewForm` |
| `ReviewForm.tsx` | `lib/review/actions.ts` | `approveAndResolve` imported and called in `onSubmit` | WIRED | `useTransition` wraps call; result sets `ReviewForm` state |
| `ReviewForm.tsx` | `lib/review/actions.ts` | `chooseAmbiguousAuthority` imported and called in `onChooseAmbiguous` | WIRED | Called from `AuthorityResultPanel` callback |
| `lib/review/actions.ts` | `lib/behoerden/resolve.ts` | `resolveAuthority(parsed.data.corrected, db)` | WIRED | Called at step 4 of action pipeline; result status drives lookupStatus |
| `lib/behoerden/resolve.ts` | DB tables | Drizzle `select()` from `behoerdenState`, `behoerdenDocumentType`, `behoerdenRegierungsbezirk`, `behoerdenAuthority` | WIRED | All four query paths present; parameterized predicates only |
| `lib/review/actions.ts` | DB `document_review` + `document` | Sync transaction `insert().onConflictDoUpdate()` + `update()` | WIRED | Upsert on `doc_review_doc_uniq` constraint; flips `reviewStatus = 'approved'` |
| `AuthorityResultPanel.tsx` | `AuthorityRow` from DB | Props flow from `approveAndResolve` result → `ReviewForm.result` → panel | WIRED | `ContactBlock` renders all 5 contact fields with null fallback |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `ReviewForm.tsx` | `documentTypes` | `listDocumentTypes()` → `behoerden_document_type` table | Yes — 8 real rows in DB | FLOWING |
| `ReviewForm.tsx` | `states` | `listStates()` → `behoerden_state` table | Yes — 16 real rows in DB | FLOWING |
| `AuthorityResultPanel.tsx` | `result.authority` | `resolveAuthority()` → `behoerden_authority` table | Yes — 188 rows (SYNTHETIC names/addresses/null contacts) | FLOWING (synthetic data) |
| `FieldRow.tsx` | `confidence` | `getExtractionsForDocument()` → `extraction` table | Yes — real extraction rows when Phase 2 pipeline ran | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All tests pass (128 total) | `npx vitest run --no-file-parallelism` | 24 files, 128 tests passed | PASS |
| Behoerden unit tests (slug + resolver) | `npx vitest run lib/behoerden` | 2 files, 22/22 tests passed in 757ms | PASS |
| Phase 3 integration suite | `npx vitest run __tests__/phase3-integration.test.ts` | 1 file, 7/7 tests passed | PASS |
| Review page branch tests | `npx vitest run __tests__/review/` | 1 file, 4/4 tests passed | PASS |
| TypeScript clean | `npx tsc --noEmit` | No output (exit 0) | PASS |
| DB tables present | `sqlite3 data/angela.db ".tables"` | All 5 Phase 3 tables present + document_review | PASS |
| document columns present | `PRAGMA table_info(document)` | `review_status` (col 11) + `reviewed_at` (col 12) | PASS |
| fastest-levenshtein resolvable | `node -e "require.resolve('fastest-levenshtein')"` | Exits 0; `distance` is a function | PASS |
| Authority data in DB | `SELECT COUNT(*) FROM behoerden_authority` | 188 rows (SYNTHETIC placeholder data) | PASS (quantity) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| REVW-01 | 03-05 | User sees side-by-side view of original PDF and extracted data | SATISFIED | `review/page.tsx` two-column layout with `PdfPreview` + `ReviewForm` |
| REVW-02 | 03-05 | User can edit all extracted fields inline | SATISFIED | 6 controlled fields in `ReviewForm`; all editable |
| REVW-03 | 03-05 | User can select Bundesland and Dokumententyp from constrained dropdown lists | SATISFIED | Both fields use shadcn `<Select>` populated from DB |
| REVW-04 | 03-05 | User can approve extraction results to trigger authority lookup | SATISFIED | "Speichern & Behörde ermitteln" calls `approveAndResolve`; persists to `document_review` |
| LKUP-01 | 03-03, 03-04 | System maps dokumenten_typ + bundesland to correct Vorbeglaubigung authority | SATISFIED (mechanism) | `resolveAuthority` implements state+doctype lookup; 7 integration tests green |
| LKUP-02 | 03-03 | System handles Regierungsbezirk sub-routing for BY/BW/HE/NRW | SATISFIED (mechanism) | `cityToRegierungsbezirk` map + RBz DB query; resolver tests include Pitfall-4 ambiguous path |
| LKUP-03 | 03-03 | System displays special routing rules and exceptions | SATISFIED | `specialRules` field surfaced in `MatchedVariant` with "Besonderheit" badge; 32 non-null rows in DB |
| LKUP-04 | 03-05 | System shows full authority contact details | SATISFIED (mechanism) — DATA: SYNTHETIC | `ContactBlock` renders name/address/phone/email/website/officeHours; all contact fields null in current seeded data |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `data/angela.db` / `data/behoerden-parsed.json` | all rows | All 188 authority rows are synthetic placeholders ("Platzhalter — ..."), all contact fields null | Warning | LKUP-04 requires real data; mechanism works but displayed contact details will be empty. Re-seed with real API key before production use. |
| `ReviewForm.tsx` | 227, 299 | `placeholder="Dokumenttyp auswählen"` / `"Bundesland auswählen"` in `SelectValue` | Info | Normal UX placeholder text — not a stub, not a code anti-pattern |

### Human Verification Required

#### 1. Two-column layout (desktop)
**Test:** Open `/documents/[id]/review` for a document with `extractionStatus='done'` on a viewport >= 1024px
**Expected:** PDF iframe on the left (min ~640px), ReviewForm card on the right, ~32px gap, tops aligned
**Why human:** CSS grid responsive layout requires live browser rendering

#### 2. Stacked layout (tablet/mobile)
**Test:** Resize browser to ~900px width on the review page
**Expected:** PDF section above form, both full width, no horizontal overflow
**Why human:** Responsive breakpoint behaviour cannot be verified programmatically

#### 3. Field dirty indicator
**Test:** Open review page, change the Dokumenttyp Select value
**Expected:** Changed field shows 2px primary-color left border + "Ursprünglich: {original value}" caption beneath; reverting the field removes both indicators
**Why human:** CSS class conditional rendering and visual styling require live browser

#### 4. Bundesland Select options
**Test:** Open the Bundesland dropdown on the review page
**Expected:** 16 German states listed alphabetically, plus "Unbekannt / Sonstiges" as the final entry
**Why human:** Dropdown option count and visual ordering require browser inspection

#### 5. Confidence badges
**Test:** Inspect each field row on the review page for a document with varied confidence levels
**Expected:** Hoch / Mittel / Niedrig badge visible beside each field label, colour matches severity (secondary / warning / destructive)
**Why human:** Visual rendering and badge colour cannot be verified without a browser

#### 6. Submit — matched result
**Test:** Submit the review form with a valid Dokumenttyp and a Bundesland that resolves to a single authority
**Expected:** Button shows spinner + "Behörde wird ermittelt …" while pending; success toast "Zuständige Behörde ermittelt." fires; AuthorityResultPanel renders with routing breadcrumb, authority heading, contact definition list (Anschrift / Telefon / E-Mail / Website / Öffnungszeiten), and "Angaben bitte prüfen" banner (all seeded rows have needs_review=true). Note: contact fields will show "— nicht hinterlegt" until real data is seeded.
**Why human:** End-to-end interactive flow including loading state and toast requires live browser

#### 7. Submit — ambiguous result
**Test:** Select a Bundesland with Regierungsbezirke (e.g. Bayern) and an Ausstellungsort not in the city map
**Expected:** AuthorityResultPanel shows "Mehrere Behörden möglich", warning banner, table of candidates with "Diese Behörde übernehmen" buttons; clicking a button transitions to matched variant with success toast
**Why human:** Multi-step interactive flow requires live browser

#### 8. Submit — not_found result
**Test:** Select "Unbekannt / Sonstiges" as Bundesland and submit
**Expected:** AuthorityResultPanel shows "Keine Behörde gefunden" with CircleAlert icon in destructive color, "Eingaben anpassen" CTA; CTA scrolls focus to Dokumenttyp field
**Why human:** Visual destructive styling and scroll-to-focus require live browser

#### 9. Verwerfen + DiscardDialog
**Test:** Edit any field, then click "Verwerfen"
**Expected:** "Änderungen verwerfen?" dialog appears; "Abbrechen" dismisses dialog and preserves edits; "Verwerfen" resets all fields to original values and clears any result panel
**Why human:** Modal interaction and focus management require live browser

#### 10. beforeunload guard
**Test:** Edit a field on the review page, then attempt to close the browser tab or navigate away
**Expected:** Browser shows native "changes will be lost" confirmation dialog
**Why human:** `window.beforeunload` requires actual browser navigation event

#### 11. Real authority data accuracy
**Test:** Run `ANTHROPIC_API_KEY=<real key> npm run seed:behoerden -- --force`, then perform a matched lookup
**Expected:** Authority card displays real authority name, real address, phone, email, website, office_hours — not "Platzhalter" values
**Why human:** Requires a real Anthropic API key and validation of data accuracy by a domain expert who knows the correct German authorities

### Gaps Summary

No automated gaps — all five success criteria are implemented end-to-end and all 128 tests pass. The 11 human verification items above are the only remaining sign-off needed before Phase 3 can be considered fully verified.

The synthetic authority data is a known condition noted at seed time. The lookup mechanism is correct; the data quality item (#11 above) is the operator's responsibility to resolve before production use.

---

_Verified: 2026-04-17T14:35:00Z_
_Verifier: Claude (gsd-verifier)_
