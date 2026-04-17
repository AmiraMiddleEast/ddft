---
phase: 3
slug: review-authority-lookup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-17
---

# Phase 3 — Validation Strategy

| Property | Value |
|----------|-------|
| Framework | vitest (installed) |
| Quick run | `npx vitest run --changed` |
| Full suite | `BETTER_AUTH_SECRET=testsecret12345678901234567890 npx vitest run` |
| Est. runtime | ~12 s |

## Sampling Rate
- After each task: `npx vitest run --changed`
- After each wave: full suite

## Wave 0 Requirements
- [ ] Synthetic `__fixtures__/behoerden-mini.json` (3 states, ~10 authorities)
- [ ] Test-DB fixture extension for Behörden tables
- [ ] Mock Anthropic response for seed parser tests

## Manual-Only Verifications
| Behavior | Req | Why Manual |
|----------|-----|------------|
| Side-by-side PDF preview + form renders correctly | REVW-01 | Browser layout + iframe CSP |
| Inline edit UX + field diff indicator | REVW-02 | Interaction feel |
| Real Behörden lookup produces correct authority | LKUP-01/02/03/04 | Requires real seed data + subjective judgment |

**Approval:** pending
