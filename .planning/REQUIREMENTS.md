# Requirements: Angela App

**Defined:** 2026-04-16
**Core Value:** Upload documents, get a correct and complete Laufliste PDF with the right authorities for each document -- fast and without manual research.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication

- [ ] **AUTH-01**: User can log in with username and password
- [ ] **AUTH-02**: User session persists across browser refresh
- [ ] **AUTH-03**: User can log out

### Document Upload

- [ ] **UPLD-01**: User can upload a single PDF via file picker or drag-and-drop
- [ ] **UPLD-02**: User can upload multiple PDFs at once (batch upload)
- [ ] **UPLD-03**: User can re-upload a better scan for an existing document without recreating the case

### AI Extraction

- [ ] **EXTR-01**: System extracts structured data from uploaded PDF via Claude Vision (dokumenten_typ, ausstellende_behoerde, ausstellungsort, bundesland, ausstellungsdatum, voller_name)
- [ ] **EXTR-02**: System displays confidence indicators (high/medium/low) per extracted field

### Review & Edit

- [ ] **REVW-01**: User sees side-by-side view of original PDF and extracted data
- [ ] **REVW-02**: User can edit all extracted fields inline
- [ ] **REVW-03**: User can select Bundesland and Dokumententyp from constrained dropdown lists
- [ ] **REVW-04**: User can approve extraction results to trigger authority lookup

### Authority Lookup

- [ ] **LKUP-01**: System maps dokumenten_typ + bundesland to the correct Vorbeglaubigung authority from Behoerden database
- [ ] **LKUP-02**: System handles Regierungsbezirk sub-routing for states with administrative districts (Bayern, Baden-Wuerttemberg, Hessen, NRW)
- [ ] **LKUP-03**: System displays special routing rules and exceptions (e.g., Fuehrungszeugnis special handling, Reisepass needs no legalization)
- [ ] **LKUP-04**: System shows full authority contact details (name, address, phone, email, office hours, website)

### Laufliste / PDF Generation

- [ ] **LAFL-01**: System generates a PDF Laufliste with the full authentication chain per document (Vorbeglaubigung -> Endbeglaubigung -> Legalisation)
- [ ] **LAFL-02**: PDF matches the existing Laufliste format with professional layout and correct German characters (umlauts)
- [ ] **LAFL-03**: User can download the generated PDF

### Case Management

- [ ] **CASE-01**: User can create a case for a person (with name)
- [ ] **CASE-02**: User can add multiple documents to a case
- [ ] **CASE-03**: System generates one consolidated Laufliste per case covering all documents

### History

- [ ] **HIST-01**: User can view a list of past Lauflisten with date, person name, document count
- [ ] **HIST-02**: User can search and filter history by name or date
- [ ] **HIST-03**: User can re-download a previously generated Laufliste PDF

### Admin

- [ ] **ADMN-01**: User can view, search, and filter the Behoerden database
- [ ] **ADMN-02**: User can edit authority contact details (address, phone, email, hours, website)
- [ ] **ADMN-03**: User can add new document types or modify routing rules

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhancement

- **ENHC-01**: PDF Laufliste customization (configurable header, optional sections, bilingual output)
- **ENHC-02**: Batch progress dashboard with per-document extraction status
- **ENHC-03**: Smart document type suggestion with fuzzy matching from known types
- **ENHC-04**: Duplicate document detection within a case
- **ENHC-05**: Export case summary as CSV for internal tracking

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Multi-country support | UAE only -- no other embassy data needed for now |
| Client self-service portal | Internal tool only, operator shares PDF manually |
| Email/notification system | Single user, no async workflows needed |
| Document status tracking through legalization steps | Laufliste shows WHERE to go, not whether you went -- that's a different product |
| OCR/text extraction fallback | Claude Vision handles PDFs directly; bad scans get re-uploaded |
| Mobile app | Desktop workflow, responsive web sufficient |
| Payment/billing integration | Handled externally |
| OAuth/social login | Simple password auth sufficient for internal tool |
| AI fine-tuning / feedback loops | Prompt engineering + human review is sufficient |
| Version control for Behoerden data | Simple last-modified timestamp sufficient; DB backups cover history |
| Real-time collaboration | Single operator tool, no concurrent editing |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| UPLD-01 | Phase 2 | Pending |
| UPLD-02 | Phase 2 | Pending |
| UPLD-03 | Phase 5 | Pending |
| EXTR-01 | Phase 2 | Pending |
| EXTR-02 | Phase 2 | Pending |
| REVW-01 | Phase 3 | Pending |
| REVW-02 | Phase 3 | Pending |
| REVW-03 | Phase 3 | Pending |
| REVW-04 | Phase 3 | Pending |
| LKUP-01 | Phase 3 | Pending |
| LKUP-02 | Phase 3 | Pending |
| LKUP-03 | Phase 3 | Pending |
| LKUP-04 | Phase 3 | Pending |
| LAFL-01 | Phase 4 | Pending |
| LAFL-02 | Phase 4 | Pending |
| LAFL-03 | Phase 4 | Pending |
| CASE-01 | Phase 4 | Pending |
| CASE-02 | Phase 4 | Pending |
| CASE-03 | Phase 4 | Pending |
| HIST-01 | Phase 5 | Pending |
| HIST-02 | Phase 5 | Pending |
| HIST-03 | Phase 5 | Pending |
| ADMN-01 | Phase 5 | Pending |
| ADMN-02 | Phase 5 | Pending |
| ADMN-03 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0

---
*Requirements defined: 2026-04-16*
*Last updated: 2026-04-16 after roadmap creation*
