# Feature Landscape

**Domain:** Document legalization management -- internal tool for German-to-UAE document authentication workflow
**Researched:** 2026-04-16

## Table Stakes

Features the operator expects from day one. Missing any of these means the tool does not replace the manual process.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **PDF upload (single + batch)** | The entire workflow starts with document intake; drag-and-drop with multi-file support is baseline for any doc processing tool | Low | Support drag-and-drop zone, file picker, and multi-select. Validate PDF-only. Show upload progress per file. |
| **AI document data extraction** | Core value prop -- extracting Dokumententyp, Bundesland, issuing authority, city, date, full name from uploaded PDFs eliminates manual reading | High | Claude Vision API call per document. Must handle German-language official documents, various layouts (certificates, diplomas, birth certificates). Define extraction schema as structured output. |
| **Confidence indicators on extraction results** | AI extraction is imperfect; users need to know which fields to trust vs. scrutinize. Industry standard for HITL document processing. | Medium | Use tiered indicators (high/medium/low) not raw percentages. Color-code: green (>90%), yellow (70-90%), red (<70%). Flag low-confidence fields visually. |
| **Side-by-side review/edit interface** | Human-in-the-loop review is non-negotiable -- AI may misidentify document type or Bundesland, and wrong authority lookup cascades into wrong Laufliste | High | Show original PDF on left, extracted fields on right. Inline editing of all fields. Dropdown selectors for constrained fields (Bundesland, Dokumententyp). This is the critical quality gate. |
| **Automatic Behoerden lookup** | After extraction + review, map (Dokumententyp + Bundesland) to the correct Vorbeglaubigung authority. This is the core domain logic. | Medium | Query behoerden_db by document type and Bundesland. Handle Regierungsbezirk sub-routing where applicable. Display full contact details (address, phone, email, hours). |
| **PDF Laufliste generation** | The deliverable output -- a routing slip per case showing the full authentication chain per document (Vorbeglaubigung -> Endbeglaubigung -> Legalisation) | High | Match existing Laufliste format exactly. Include per-document sections with authority contact details. Generate as downloadable PDF. Must look professional (this goes to clients). |
| **Case/session management** | Group multiple documents belonging to one person/submission into a single case. A legalization request typically involves 3-8 documents for one individual. | Medium | Create a case, upload documents to it, review all docs, generate one consolidated Laufliste. Cases need a name/identifier (person name, date). |
| **Behoerden database admin (CRUD)** | Authorities change addresses, phone numbers, office hours. The operator must update these without developer involvement. | Medium | List/search/filter authorities. Edit contact details, add new document types, modify routing rules. Changes take effect immediately on new lookups. |
| **Simple password-based login** | Internal tool needs basic access control. Not enterprise auth, but a gate to prevent unauthorized access. | Low | Single-user or small-team auth. Username + password. Session management. No OAuth/SSO needed per project constraints. |
| **Laufliste history** | Operator needs to find and re-download previously generated Lauflisten. Essential for client follow-ups and record-keeping. | Low | List of past generations with date, person name, document count. Click to re-download PDF. Basic search/filter by name or date. |

## Differentiators

Features that elevate the tool from "functional" to "indispensable." Not expected on day one, but high value once table stakes are solid.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Regierungsbezirk auto-detection** | Some Bundeslaender (e.g., Bayern, NRW) have sub-jurisdictions that affect which authority handles Vorbeglaubigung. Auto-detecting this from the document's city saves manual lookup. | Medium | Cross-reference extracted city against a Regierungsbezirk mapping table. Only relevant for states where `hat_regierungsbezirke: true`. Significant time-saver for Bayern/NRW cases. |
| **Smart document type suggestion** | AI sometimes extracts ambiguous document types. Suggesting from a constrained list of known types (mapped to behoerden_db categories) reduces errors. | Low | Dropdown with fuzzy search, pre-populated from behoerden_db document categories. Auto-map common AI outputs to canonical types. |
| **Batch processing with progress dashboard** | When processing 5-8 documents per case, show a batch overview with per-document extraction status (processing, needs review, approved). | Medium | Progress indicators per document. Batch "approve all" for high-confidence extractions. Exception queue for low-confidence items. |
| **Laufliste PDF customization** | Different clients or use cases may need slight format variations (with/without contact details, different header information, bilingual output). | Medium | Template system for Laufliste. Configurable sections. Operator-specific header/footer. Could be a later phase enhancement. |
| **Document re-processing** | If AI extraction was poor (e.g., bad scan), allow re-upload of a better scan for the same document slot without recreating the case. | Low | Replace document in existing case. Re-trigger AI extraction. Preserve any manual edits as defaults. |
| **Special routing rules display** | Some documents have non-standard routing (e.g., Fuehrungszeugnis has special handling, Reisepass needs no legalization). Surface these rules prominently during review. | Low | Pull special notes from behoerden_db. Display as warnings/info banners during review. Prevent operator errors on edge cases. |
| **Export/print case summary** | Beyond the Laufliste PDF, export a case overview showing all documents, their status, and extraction results for internal record-keeping. | Low | Simple tabular export (PDF or CSV). Useful for internal tracking and billing reconciliation. |
| **Duplicate document detection** | Flag if the same document appears to be uploaded twice within a case (same type + same issuing authority + same date). | Low | Compare extracted metadata across documents in a case. Warn but do not block -- sometimes duplicates are intentional (certified copies). |

## Anti-Features

Features to deliberately NOT build. Each would add complexity without proportionate value for this specific use case.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Multi-country support** | UAE is the only target market. Adding embassy data and routing rules for other countries explodes complexity with no current demand. | Hard-code UAE embassy as the final legalization step. Revisit only if business expands to other countries. |
| **Client self-service portal** | This is an internal tool for one service provider. Building a client-facing portal adds auth complexity, UX polish requirements, and support burden. | Operator generates Laufliste and shares PDF manually (email, messenger). |
| **Email/notification system** | Single-user internal tool. No one to notify. Push notifications add infrastructure (email service, queue) for no value. | Operator checks the app when they need it. No async workflows requiring notifications. |
| **Document status tracking through legalization steps** | Tracking whether a document has actually been pre-authenticated, authenticated, and legalized is a CRM/case management feature, not a document processing feature. Adds state machine complexity. | The Laufliste tells the operator WHERE to go. Tracking whether they WENT there is a different product. |
| **OCR/text extraction fallback** | Claude Vision handles PDF reading directly. Adding a separate OCR pipeline (Tesseract, AWS Textract) as fallback adds complexity and a second extraction path to maintain. | Rely on Claude Vision. If a document is unreadable, prompt operator to upload a better scan. |
| **Mobile app** | Internal tool used at a desk when processing documents. No mobile use case. | Responsive web design is sufficient. No native app needed. |
| **Payment/billing integration** | Billing is handled externally. Mixing financial logic with document processing creates unnecessary coupling. | Keep billing in whatever system currently handles it (spreadsheet, accounting software). |
| **OAuth/social login** | Over-engineered for an internal tool with 1-3 users. Adds dependency on external identity providers. | Simple password auth. Possibly upgrade to session tokens with expiry. |
| **AI model fine-tuning / feedback loops** | The extraction schema is well-defined and document types are limited. Fine-tuning adds ML infrastructure (training data collection, model versioning) for marginal gains. | Improve extraction via prompt engineering. The human review step catches AI errors. |
| **Version control for Behoerden data** | Tracking historical authority data changes adds database complexity (temporal tables, audit logs) with minimal value. | Operator updates are infrequent. A simple "last modified" timestamp is sufficient. If historical data is ever needed, database backups suffice. |
| **Real-time collaboration** | Single operator tool. No concurrent editing scenarios. | No need for WebSocket sync, conflict resolution, or presence indicators. |

## Feature Dependencies

```
PDF Upload ─────────────────┐
                             v
                   AI Data Extraction
                             │
                             v
              ┌── Confidence Indicators
              │              │
              v              v
     Behoerden Lookup ◄── Review/Edit Interface
              │              │
              v              v
     Laufliste Generation ◄─┘
              │
              v
     Laufliste History

Behoerden DB Admin ──► Behoerden Lookup (data dependency)
                       (admin maintains the data that lookup queries)

Case Management ──► wraps all of the above into a per-person workflow

Simple Auth ──► gates access to everything
```

**Critical path:** Upload -> Extract -> Review -> Lookup -> Generate PDF. Every feature in this chain must work before the app delivers value.

**Independent features:** Behoerden DB Admin, Laufliste History, and Auth can be built in parallel with the core pipeline but are not useful without it.

## MVP Recommendation

Prioritize the core pipeline end-to-end, then layer on quality-of-life features.

**Phase 1 - Core Pipeline (table stakes, critical path):**
1. Simple auth (gate access before anything else)
2. PDF upload (single file first, batch later)
3. AI data extraction with Claude Vision
4. Review/edit interface with confidence indicators
5. Behoerden lookup from imported database
6. PDF Laufliste generation matching existing format

**Phase 2 - Operational Completeness:**
1. Case management (group documents per person)
2. Batch upload and processing
3. Laufliste history with search
4. Behoerden database admin interface
5. Special routing rules display

**Phase 3 - Polish and Efficiency:**
1. Regierungsbezirk auto-detection
2. Smart document type suggestion
3. Document re-processing
4. Batch progress dashboard
5. Duplicate document detection

**Defer indefinitely:** All anti-features. The tool succeeds by doing one workflow exceptionally well, not by becoming a platform.

## Sources

- [Parseur: Human-in-the-Loop Best Practices](https://parseur.com/blog/hitl-best-practices) - HITL review interface patterns, confidence thresholds
- [Sensible: Human Review for Document Processing](https://www.sensible.so/blog/human-review-document-processing) - Validation-based review triggering, webhook integration
- [Agentic Design: Confidence Visualization Patterns](https://agentic-design.ai/patterns/ui-ux-patterns/confidence-visualization-patterns) - UI patterns for displaying AI confidence
- [Cradl AI: Document Data Extraction Guide 2026](https://www.cradl.ai/posts/document-data-extraction-with-ai) - LLM-based extraction vs OCR approaches
- [Smart Interface Design Patterns: Bulk Import UX](https://smart-interface-design-patterns.com/articles/bulk-ux/) - Batch upload UX patterns
- [Cogency Global: Document Legalization Guide](https://www.cogencyglobal.com/blog/a-step-by-step-guide-to-document-authentication-and-legalization/) - Legalization service provider workflows
- [Auswaertiges Amt: German Documents for Use Abroad](https://www.auswaertiges-amt.de/en/visa-service/konsularisches/urkundenverkehrallgemeines-node/urkundenverkehrteila-node) - Official German legalization process
- [Schmidt & Schmidt: Apostille Germany](https://schmidt-export.com/consular-legalization-and-apostille/apostille-germany) - German apostille/legalization chain
