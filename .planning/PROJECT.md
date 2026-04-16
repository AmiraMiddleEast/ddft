# Angela App

## What This Is

A web application for managing the legalization of German documents for use in the United Arab Emirates. The app automates the process of analyzing uploaded documents via AI, looking up the responsible German authorities for pre-authentication (Vorbeglaubigung), and generating a complete routing slip (Laufliste) as a PDF — including the full chain from Vorbeglaubigung through Endbeglaubigung to embassy legalization.

Built as an internal tool for a legalization service provider.

## Core Value

Upload documents, get a correct and complete Laufliste PDF with the right authorities for each document — fast and without manual research.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Document upload (single and batch) with PDF support
- [ ] AI-powered document analysis (Claude Vision) extracting: document type, issuing authority, city, Bundesland, date, full name
- [ ] Automatic authority lookup from Behörden database based on document type and Bundesland
- [ ] Review and correction interface for AI extraction results before finalization
- [ ] PDF Laufliste generation with full chain per document (Vorbeglaubigung → Endbeglaubigung → Legalisation)
- [ ] Simple history of generated Lauflisten
- [ ] Admin interface for maintaining the Behörden database
- [ ] Simple password-based login

### Out of Scope

- Multi-country support — UAE only for now
- End-customer self-service portal — internal tool only
- Email/notification system — manual PDF sharing
- Mobile app — web-first
- Payment processing — billing handled externally
- OAuth/social login — simple password auth sufficient

## Context

### Domain Background

German documents destined for use in the UAE require a multi-step authentication chain:
1. **Vorbeglaubigung** (pre-authentication): Varies by document type and Bundesland. The responsible authority depends on whether it's a medical license (Approbation), university diploma, birth certificate, etc. Some Bundesländer have Regierungsbezirke that further differentiate jurisdiction.
2. **Endbeglaubigung** (final authentication): Performed by the Auswärtiges Amt (Federal Foreign Office) or Bundesamt für Auswärtige Angelegenheiten (BfAA).
3. **Legalisation**: Performed by the UAE Embassy in Berlin.

### Existing Assets

- **behoerden_db.json**: Comprehensive JSON database covering all 16 German Bundesländer with detailed authority information per document type, including addresses, phone numbers, email, office hours, and special notes. This is the core data asset — already fully researched.
- **ActivePieces workflow documentation**: Previous attempt to build this as a no-code automation. The logic and data extraction schema are useful references but the platform is being abandoned in favor of a standalone app.
- **Example Laufliste PDF**: Real output example (Dr. Sandra Hertel) showing the exact format and level of detail expected per document.
- **Example documents**: Transcript, diploma, publication record — representative of real-world inputs.

### Data Model (from behoerden_db.json)

Each Bundesland entry contains:
- `hat_regierungsbezirke`: boolean — whether the state has administrative districts that affect jurisdiction
- `besonderheiten`: string — special notes for the state
- `dokumente_raw`: markdown string — detailed authority information per document type, including sections for Approbation, Universitätsdiplom, Geburtsurkunde, Heiratsurkunde, Führungszeugnis, Notarielle Urkunden, Gerichtliche Urkunden, Kammerbescheinigungen

### AI Extraction Schema

The AI needs to extract from each uploaded document:
- `dokumenten_typ`: Type of document (Approbationsurkunde, Geburtsurkunde, Diplom, etc.)
- `ausstellende_behoerde`: Name of issuing authority
- `ausstellungsort`: City of issuance
- `bundesland`: German state
- `ausstellungsdatum`: Date on document
- `voller_name`: Full name of the person (including maiden name if mentioned)

### Laufliste Format

Per document in the routing slip:
- Document header with type and details (authority, city, date)
- Vorbeglaubigung section: responsible authority with full contact details (address, phone, email, office hours, website, notes)
- Endbeglaubigung section: Auswärtiges Amt / BfAA
- Legalisation section: UAE Embassy Berlin with full contact details
- Special notes where applicable (e.g., Reisepass needs no legalization, Führungszeugnis has special routing)

## Constraints

- **AI Provider**: Anthropic Claude (with Vision capability for PDF analysis)
- **Target Country**: UAE only (embassy data is static for now)
- **Data Source**: behoerden_db.json is the authority database — needs to be importable and maintainable
- **Single User**: Internal tool, one primary user (the service provider)
- **Language**: App UI can be German or English; Laufliste output is German

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Standalone web app over ActivePieces | More control, better UX, no platform dependency | — Pending |
| Claude Vision for document analysis | Already using Anthropic ecosystem, good PDF/image understanding | — Pending |
| UAE-only scope | Primary market, simplifies embassy/legalization data | — Pending |
| Editable AI results before PDF generation | AI may misidentify document types or Bundesland; human review is essential | — Pending |
| Behörden DB maintainable in-app | Authorities change addresses/contacts; needs to stay current without code changes | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-16 after initialization*
