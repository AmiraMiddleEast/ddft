---
phase: 2
slug: document-upload-ai-extraction
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-17
---

# Phase 2 — Validation Strategy

| Property | Value |
|----------|-------|
| Framework | vitest (already installed) |
| Quick run | `npx vitest run --changed` |
| Full suite | `npx vitest run` |
| Est. runtime | ~15 s |

## Sampling Rate
- After each task: `npx vitest run --changed`
- After each wave: `npx vitest run`
- Max feedback latency: 20 s

## Wave 0 Requirements
- [ ] Mock Anthropic client fixture (so tests don't hit real API)
- [ ] Fixture PDFs (use transcript.pdf, Publication_Record_SH.pdf)
- [ ] `test-uploads/` tmp dir setup/teardown

## Manual-Only Verifications
| Behavior | Req | Why Manual | Steps |
|----------|-----|------------|-------|
| Dropzone drag-drop UX | UPLD-01 | Real browser drag events | Drag a PDF onto /upload, observe accepted state |
| Batch upload progress | UPLD-02 | Real file I/O timings | Drop 3+ PDFs, verify per-file status |
| iframe PDF preview | EXTR-01 | Cross-browser CSP | View /documents/[id], verify PDF renders |
| Extraction accuracy | EXTR-01/02 | Subjective judgement | Upload real docs (transcript.pdf), inspect field values + confidence |

**Approval:** pending
