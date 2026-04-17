---
status: partial
phase: 03-review-authority-lookup
source: [03-VERIFICATION.md]
started: 2026-04-17T14:30:00Z
updated: 2026-04-17T14:30:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Two-column layout at ≥1024px (REVW-01)
expected: /documents/[id]/review shows PDF left + form right, ~32px gap, aligned tops
result: [pending]

### 2. Stacked layout at <1024px (REVW-01)
expected: PDF above form, both full-width
result: [pending]

### 3. Field dirty indicator (REVW-02)
expected: Edited field gets 2px accent-color left border + "Ursprünglich: {value}" caption; reverts when original value restored
result: [pending]

### 4. Bundesland Select (REVW-03)
expected: 16 German states alphabetical + "Unbekannt / Sonstiges" sentinel
result: [pending]

### 5. Dokumenttyp Select (REVW-03)
expected: Alphabetical list of document types from seeded Behörden DB
result: [pending]

### 6. Confidence badges (REVW-02)
expected: Hoch/Mittel/Niedrig badges beside each field label
result: [pending]

### 7. Submit → matched result (LKUP-01/04)
expected: Spinner + "Behörde wird ermittelt…"; toast "Zuständige Behörde ermittelt"; AuthorityResultPanel renders with breadcrumb, contact info (NOTE: data is synthetic placeholder until re-seed with real API key)
result: [pending]

### 8. Submit → ambiguous result (LKUP-02)
expected: Multiple candidates listed, "Diese Behörde übernehmen" button works
result: [pending]

### 9. Submit → not_found result
expected: "Keine Behörde gefunden" with "Eingaben anpassen" CTA + scroll+focus
result: [pending]

### 10. Verwerfen + DiscardDialog (REVW-02)
expected: Confirm dialog, Abbrechen preserves, Verwerfen reverts all + dismisses result
result: [pending]

### 11. beforeunload warning (REVW-02)
expected: Browser prompts before leaving with dirty edits
result: [pending]

### 12. **DATA PREREQUISITE** — Re-seed with real API key (LKUP-01/02/03/04)
expected: `ANTHROPIC_API_KEY=sk-ant-<real> npm run seed:behoerden -- --force` populates data/behoerden-parsed.json with real authority data. Re-run manual lookup tests; verify real German authorities and contact details appear.
result: [pending]

## Summary

total: 12
passed: 0
issues: 0
pending: 12
skipped: 0
blocked: 0

## Gaps

None yet recorded.
