---
status: partial
phase: 02-document-upload-ai-extraction
source: [02-VERIFICATION.md]
started: 2026-04-17T11:35:00Z
updated: 2026-04-17T11:35:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Dropzone drag-drop UX (UPLD-01)
expected: Drag a PDF onto /upload. Border tints on hover, copy swaps to "Zum Hochladen loslassen", on drop a row enters "In Warteschlange". Non-PDF rejected with inline red error.
result: [pending]

### 2. Batch upload + p-limit(3) gating (UPLD-02)
expected: Drop 4 PDFs. First 3 transition "Wird hochgeladen" → "Wird analysiert" in parallel; 4th waits. All settle. Sonner toast fires once at batch complete.
result: [pending]

### 3. iframe PDF preview (EXTR-01)
expected: /documents/{id} shows two-column layout. Left iframe renders PDF ≥480px tall, readable. Right table with 6 field rows + confidence badges. Skeleton while pending.
result: [pending]

### 4. Extraction accuracy (EXTR-01/02) — requires real ANTHROPIC_API_KEY
expected: Upload transcript.pdf. /documents/{id} shows 6 plausible German values (Dokumenttyp, Ausstellende Behörde, Ausstellungsort, Bundesland, Ausstellungsdatum, Voller Name). No fabricated Bundesland for a German doc. Missing fields → "— nicht erkannt" with "Niedrig" badge (acceptable per D-12).
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

None yet recorded.
