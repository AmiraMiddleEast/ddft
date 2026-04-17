---
phase: 4
slug: laufliste-generation-cases
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-17
---

# Phase 4 — Validation Strategy

| Property | Value |
|----------|-------|
| Framework | vitest |
| Quick run | `npx vitest run --changed` |
| Full suite | `BETTER_AUTH_SECRET=testsecret12345678901234567890 npx vitest run` |
| Est. runtime | ~15s |

## Sampling
- After each task: quick run
- After each wave: full suite

## Wave 0 Requirements
- [ ] Install @react-pdf/renderer@4.5.1
- [ ] PDF generator input-snapshot fixtures
- [ ] Mock Embassy/BVA static data

## Manual-Only
| Behavior | Req | Why Manual |
|----------|-----|------------|
| Generated PDF visual correctness (umlauts, layout, page breaks) | LAFL-02 | Pixel + typography inspection |
| PDF download UX | LAFL-03 | Browser download dialog |
| Case management CRUD UX | CASE-01/02/03 | Interaction feel |

**Approval:** pending
