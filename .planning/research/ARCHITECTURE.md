# Architecture Research

**Domain:** Document processing / workflow management web app (German document legalization)
**Researched:** 2026-04-16
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
+------------------------------------------------------------------+
|                     Presentation Layer                            |
|  +-------------+  +--------------+  +------------+  +----------+ |
|  | Upload View |  | Review/Edit  |  | History    |  | Admin    | |
|  | (PDF drop)  |  | (extraction) |  | (Laufl.)   |  | (DB mgmt)| |
|  +------+------+  +------+-------+  +-----+------+  +----+-----+ |
|         |                |               |              |         |
+---------+----------------+---------------+--------------+---------+
|                     Application Layer                            |
|  +----------------+  +------------------+  +------------------+  |
|  | Upload Handler |  | Authority Lookup |  | PDF Generator    |  |
|  | (Server Action)|  | Service          |  | (Laufliste)      |  |
|  +-------+--------+  +--------+---------+  +--------+---------+  |
|          |                    |                      |           |
|  +-------+--------------------+----------------------+---------+ |
|  |              AI Extraction Service                          | |
|  |  (Claude API: PDF in -> structured JSON out)                | |
|  +-------------------------------------------------------------+ |
|                                                                  |
+---------+----------------+---------------+--------------+---------+
|                     Data Layer                                   |
|  +-------------+  +------------------+  +------------------+     |
|  | SQLite DB   |  | File Storage     |  | Behoerden DB     |     |
|  | (users,     |  | (uploaded PDFs,  |  | (JSON -> SQLite  |     |
|  |  history,   |  |  generated PDFs) |  |  authority data) |     |
|  |  sessions)  |  |                  |  |                  |     |
|  +-------------+  +------------------+  +------------------+     |
+------------------------------------------------------------------+
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Upload View | Accept single/batch PDF uploads, show progress | React dropzone component with Next.js Server Action |
| AI Extraction Service | Send PDF to Claude API, receive structured data | Server-side service calling Anthropic SDK with structured outputs |
| Authority Lookup Service | Match extraction results to Behoerden DB entries | Pure function: (document_type, bundesland) -> authority chain |
| Review/Edit View | Display extraction results, allow corrections | React form with pre-filled AI results, editable fields |
| PDF Generator | Produce Laufliste PDF from finalized data | @react-pdf/renderer on server side (renderToBuffer) |
| History View | Browse and re-download past Lauflisten | Paginated list from SQLite, links to stored PDFs |
| Admin Panel | CRUD operations on Behoerden database | Form-based editor for authority records |
| Auth Layer | Simple password login, session management | NextAuth.js with Credentials provider or custom cookie session |
| File Storage | Store uploaded and generated PDFs | Local filesystem with organized directory structure |
| SQLite Database | Persist users, sessions, document history, authority data | better-sqlite3 via Drizzle ORM |

## Recommended Project Structure

```
angela-app/
+-- app/                        # Next.js App Router pages
|   +-- (auth)/                 # Route group: unauthenticated
|   |   +-- login/
|   |   |   +-- page.tsx
|   +-- (app)/                  # Route group: authenticated
|   |   +-- layout.tsx          # Auth-guarded layout
|   |   +-- page.tsx            # Dashboard / upload page
|   |   +-- upload/
|   |   |   +-- page.tsx        # Upload interface
|   |   +-- review/
|   |   |   +-- [id]/
|   |   |   |   +-- page.tsx    # Review extraction results for a batch
|   |   +-- history/
|   |   |   +-- page.tsx        # List of past Lauflisten
|   |   +-- admin/
|   |   |   +-- page.tsx        # Behoerden DB management
|   +-- api/                    # API routes (only where Server Actions won't work)
|   |   +-- download/[id]/
|   |   |   +-- route.ts        # PDF download endpoint
+-- lib/                        # Shared server-side logic
|   +-- ai/
|   |   +-- extract.ts          # Claude API extraction logic
|   |   +-- schema.ts           # Extraction result schema/types
|   +-- db/
|   |   +-- index.ts            # Database connection
|   |   +-- schema.ts           # Drizzle schema definitions
|   |   +-- seed.ts             # Import behoerden_db.json into SQLite
|   +-- lookup/
|   |   +-- authority.ts        # Authority chain lookup logic
|   +-- pdf/
|   |   +-- laufliste.tsx       # React-PDF Laufliste template
|   |   +-- generate.ts         # PDF generation orchestration
|   +-- auth/
|   |   +-- session.ts          # Session management
|   +-- storage/
|   |   +-- files.ts            # File read/write helpers
+-- components/                 # Shared React components
|   +-- ui/                     # Generic UI components (buttons, inputs, etc.)
|   +-- upload/                 # Upload-specific components
|   +-- review/                 # Review/edit form components
|   +-- admin/                  # Admin panel components
+-- actions/                    # Server Actions (co-located by feature)
|   +-- upload.ts               # Handle file upload
|   +-- extract.ts              # Trigger AI extraction
|   +-- generate.ts             # Generate Laufliste PDF
|   +-- admin.ts                # Behoerden CRUD operations
+-- types/                      # Shared TypeScript types
|   +-- document.ts             # Document types, extraction results
|   +-- authority.ts            # Authority/Behoerden types
|   +-- laufliste.ts            # Laufliste data types
+-- storage/                    # Local file storage (gitignored)
|   +-- uploads/                # Uploaded PDFs
|   +-- generated/              # Generated Laufliste PDFs
+-- data/
|   +-- behoerden_db.json       # Source authority database
+-- drizzle/                    # Database migrations
+-- public/                     # Static assets
+-- drizzle.config.ts
+-- next.config.ts
+-- package.json
+-- tsconfig.json
```

### Structure Rationale

- **app/(auth) and app/(app):** Route groups separate authenticated from unauthenticated pages. The (app) layout wraps all pages with session checks and a common navigation shell.
- **lib/:** All server-only business logic lives here, organized by domain concern. This code never ships to the client bundle.
- **actions/:** Server Actions grouped by feature. These are the primary mutation interface -- Next.js Server Actions handle form submissions, file uploads, and data mutations without separate API routes.
- **components/:** Reusable React components, organized by feature area. UI primitives (buttons, inputs) are separate from domain components.
- **types/:** Shared TypeScript types used across server and client code. Single source of truth for data shapes.
- **storage/:** Local filesystem directory for uploaded and generated PDFs. Kept outside of `public/` for access control.

## Architectural Patterns

### Pattern 1: Server Action Pipeline

**What:** Chain Server Actions for the multi-step document processing workflow. Each step is a discrete Server Action that can be called independently or composed.
**When to use:** For all mutation operations (upload, extract, generate). This is the primary pattern for the entire app.
**Trade-offs:** Simpler than API routes (no fetch boilerplate, automatic type safety), but limited to POST requests and not callable from external clients. Perfect for an internal tool that has no external API consumers.

**Example:**
```typescript
// actions/extract.ts
"use server";

import { extractDocumentData } from "@/lib/ai/extract";
import { lookupAuthorities } from "@/lib/lookup/authority";
import { db } from "@/lib/db";

export async function extractAndLookup(documentId: string) {
  // Step 1: Get the stored PDF
  const document = await db.query.documents.findFirst({
    where: eq(documents.id, documentId),
  });

  // Step 2: Send to Claude for extraction
  const extraction = await extractDocumentData(document.filePath);

  // Step 3: Look up authorities based on extraction
  const authorities = lookupAuthorities(
    extraction.dokumenten_typ,
    extraction.bundesland
  );

  // Step 4: Store results, return for review
  await db.update(documents).set({
    extraction: extraction,
    authorities: authorities,
    status: "pending_review",
  });

  return { extraction, authorities };
}
```

### Pattern 2: Structured Output Extraction

**What:** Use Claude's structured outputs feature (output_config with json_schema) to guarantee the AI returns valid, typed JSON matching the extraction schema. No parsing errors, no retry loops.
**When to use:** For the document extraction step. Define the exact schema (dokumenten_typ, bundesland, etc.) and Claude will always return valid JSON matching it.
**Trade-offs:** First request per schema has compilation latency (~1-2s). Schema changes invalidate the cache. Limited to supported JSON Schema features (no recursive schemas, no min/max constraints). But for this use case, the schema is simple and stable.

**Example:**
```typescript
// lib/ai/extract.ts
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";

const client = new Anthropic();

export async function extractDocumentData(filePath: string) {
  const pdfData = fs.readFileSync(filePath).toString("base64");

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfData,
            },
          },
          {
            type: "text",
            text: `Analysiere dieses deutsche Dokument und extrahiere die folgenden Informationen.
                   Wenn ein Feld nicht erkennbar ist, setze den Wert auf null.`,
          },
        ],
      },
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            dokumenten_typ: {
              type: "string",
              enum: [
                "Approbationsurkunde",
                "Geburtsurkunde",
                "Heiratsurkunde",
                "Diplom",
                "Zeugnis",
                "Fuehrungszeugnis",
                "Notarielle_Urkunde",
                "Gerichtliche_Urkunde",
                "Kammerbescheinigung",
                "Sonstiges",
              ],
            },
            ausstellende_behoerde: { type: ["string", "null"] },
            ausstellungsort: { type: ["string", "null"] },
            bundesland: {
              type: ["string", "null"],
              enum: [
                "Baden-Wuerttemberg", "Bayern", "Berlin", "Brandenburg",
                "Bremen", "Hamburg", "Hessen", "Mecklenburg-Vorpommern",
                "Niedersachsen", "Nordrhein-Westfalen", "Rheinland-Pfalz",
                "Saarland", "Sachsen", "Sachsen-Anhalt",
                "Schleswig-Holstein", "Thueringen", null,
              ],
            },
            ausstellungsdatum: { type: ["string", "null"] },
            voller_name: { type: ["string", "null"] },
          },
          required: [
            "dokumenten_typ", "ausstellende_behoerde",
            "ausstellungsort", "bundesland",
            "ausstellungsdatum", "voller_name",
          ],
          additionalProperties: false,
        },
      },
    },
  });

  return JSON.parse(response.content[0].text);
}
```

### Pattern 3: JSON-to-SQLite Authority Database

**What:** Import the existing behoerden_db.json into SQLite tables at setup time, then query it relationally. The admin panel edits SQLite directly; an export function can regenerate the JSON if needed.
**When to use:** At application initialization/seeding and for all authority lookups during the workflow.
**Trade-offs:** Adds a migration/seed step, but enables proper querying, indexing, and CRUD through the admin panel. The alternative (reading JSON from disk at runtime) works for reads but makes admin editing fragile and risks data corruption. Since the JSON is ~60K tokens with a complex nested structure (16 Bundeslaender, each with multiple document types), a relational representation is cleaner for lookups.

## Data Flow

### Primary Workflow: Upload to Laufliste

```
User uploads PDF(s)
    |
    v
[Server Action: upload]
    |-- Validate file (PDF, size < 32MB)
    |-- Store file to /storage/uploads/{uuid}.pdf
    |-- Create document record in SQLite (status: "uploaded")
    |-- Return document ID(s) to client
    |
    v
[Server Action: extract] (per document)
    |-- Read PDF from disk
    |-- Base64-encode and send to Claude API
    |   with structured output schema
    |-- Receive guaranteed-valid JSON extraction
    |-- Run authority lookup:
    |   (dokumenten_typ + bundesland) -> query SQLite Behoerden tables
    |   -> returns Vorbeglaubigung authority with full contact details
    |-- Store extraction + authority data in document record
    |-- Update status to "pending_review"
    |-- Return extraction + authorities to client
    |
    v
[Review/Edit UI]
    |-- User sees AI extraction results + matched authorities
    |-- User can correct any field (document type, Bundesland, etc.)
    |-- On correction: re-run authority lookup with corrected values
    |-- User confirms all documents are correct
    |
    v
[Server Action: generate]
    |-- Collect all confirmed documents for the batch
    |-- Build Laufliste data structure:
    |   Per document: header + Vorbeglaubigung + Endbeglaubigung + Legalisation
    |-- Render PDF using @react-pdf/renderer (server-side renderToBuffer)
    |-- Store generated PDF to /storage/generated/{uuid}.pdf
    |-- Create Laufliste history record in SQLite
    |-- Return download link
    |
    v
User downloads Laufliste PDF
```

### Authority Lookup Flow (Detail)

```
Input: (dokumenten_typ, bundesland, [ausstellungsort])
    |
    v
Query Behoerden SQLite table
    |-- Filter by bundesland
    |-- Filter by document type
    |-- Check hat_regierungsbezirke flag
    |   |-- If true: may need ausstellungsort to determine
    |   |   specific Regierungsbezirk authority
    |   |-- If false: direct match
    |
    v
Output: {
    vorbeglaubigung: { authority, address, phone, email, hours, website, notes },
    endbeglaubigung: { static BfAA/Auswaertiges Amt data },
    legalisation: { static UAE Embassy Berlin data }
}
```

### Key Data Flows

1. **Upload Flow:** Browser -> Server Action -> Local filesystem + SQLite record. Files stored with UUID names; original filename preserved in DB.
2. **Extraction Flow:** Server -> Claude API (PDF as base64) -> Structured JSON -> SQLite. This is the only external API call in the entire app. Takes 3-15 seconds per document depending on complexity.
3. **Lookup Flow:** SQLite query, entirely local. Sub-millisecond. Pure function of (document_type, bundesland) with occasional city disambiguation.
4. **Generation Flow:** SQLite data -> React-PDF components -> PDF buffer -> Filesystem. Entirely server-side, no client involvement until download.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1 user (current) | Monolith with SQLite + local filesystem. No scaling needed. This is the target. |
| 2-5 users | Same architecture holds fine. SQLite handles low concurrent writes. Add rate limiting on Claude API calls to manage costs. |
| 10+ users | Consider migrating to PostgreSQL and S3-compatible storage. Add a job queue for AI extraction to avoid blocking requests. |

### Scaling Priorities

1. **First bottleneck: Claude API latency.** Each document extraction takes 3-15 seconds. For batch uploads of 10+ documents, this means sequential processing could take minutes. Solution: Process documents in parallel (Promise.all with concurrency limit of 3-5) from day one. This is a code pattern, not an infrastructure change.
2. **Second bottleneck: File storage.** Local filesystem works for a single-server deployment. If multi-server deployment is ever needed, swap the storage adapter to S3-compatible storage. Design the storage layer as an interface from the start to make this swap trivial.

## Anti-Patterns

### Anti-Pattern 1: Sending the Entire Behoerden JSON to Claude

**What people do:** Include the full 60K-token JSON database in every Claude API call so the AI can "look up" authorities itself.
**Why it's wrong:** Wastes tokens (and money) on every request. Makes results non-deterministic -- the AI might misinterpret authority data or hallucinate addresses. The 60K tokens eat into context window capacity.
**Do this instead:** Use Claude only for document analysis (what type of document, where it was issued). Then use deterministic code to look up authorities in the database. AI for perception, code for logic.

### Anti-Pattern 2: Storing PDFs in the Database

**What people do:** Store uploaded and generated PDFs as BLOBs in SQLite.
**Why it's wrong:** Bloats the database, makes backups slow, degrades query performance. SQLite has a 2GB database size limit in practice.
**Do this instead:** Store PDFs on the filesystem. Store only the file path and metadata (size, original name, content type) in the database. Use UUID-based filenames to avoid collisions.

### Anti-Pattern 3: Client-Side PDF Generation

**What people do:** Generate the Laufliste PDF in the browser using @react-pdf/renderer's PDFViewer or PDFDownloadLink components.
**Why it's wrong:** Ships the entire PDF rendering library to the client bundle (~500KB+). Exposes all authority data to the client. Performance varies by device. No server-side record of what was generated.
**Do this instead:** Generate PDFs server-side using renderToBuffer/renderToStream. Store the result on the server. Serve via a download API route.

### Anti-Pattern 4: Over-Engineering with Microservices or Queues

**What people do:** Set up separate extraction service, PDF generation service, message queue, etc. for a single-user internal tool.
**Why it's wrong:** Massive operational overhead for zero benefit at this scale. Deployment complexity, debugging difficulty, infrastructure costs.
**Do this instead:** Monolithic Next.js app. All logic in one codebase, one deployment. Extract modules into clean interfaces (not separate services) so they could be split later if genuinely needed.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Claude API (Anthropic) | Direct SDK call from server-side lib/ai/extract.ts | Use @anthropic-ai/sdk. Structured outputs for guaranteed JSON. Claude Sonnet 4.5 recommended for cost/quality balance on document analysis. Base64-encode PDFs (up to 32MB, 100 pages). Each page costs ~1500-3000 text tokens + image tokens. |
| None (no other external services) | -- | This is deliberately a self-contained app. No external DB, no S3, no email service. Simplicity is a feature. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| UI <-> Server | Server Actions (direct function calls) | No REST API needed. Server Actions provide type-safe, RPC-like calls. Use API routes only for file downloads (need streaming response). |
| Server Actions <-> AI Service | Function call to lib/ai/extract.ts | Synchronous within the Server Action. The 3-15s Claude latency is handled by the Server Action's async nature -- the UI shows a loading state. |
| Server Actions <-> Database | Drizzle ORM queries | Type-safe queries. All DB access goes through lib/db/. |
| Server Actions <-> File Storage | Function calls to lib/storage/files.ts | Abstract filesystem operations behind an interface for future portability. |
| AI Service <-> Authority Lookup | Sequential: extraction result feeds into lookup | AI returns structured data, lookup uses it as query parameters. These are explicitly separate steps -- no AI involvement in the lookup. |

### Build Order Dependencies

Understanding these dependencies is critical for phase planning:

```
1. Auth + Database Schema + Project Skeleton
   |  (everything depends on being able to run the app and store data)
   |
   +-> 2. File Upload + Storage
   |      (need to store PDFs before we can extract from them)
   |
   +-> 3. Behoerden DB Import/Seed + Admin Panel
   |      (need authority data in DB before lookup can work)
   |
   +-------> 4. AI Extraction Service
   |            (needs stored PDFs to extract from)
   |
   +-------> 5. Authority Lookup Service
   |            (needs Behoerden data in DB + extraction results)
   |
   +-----------> 6. Review/Edit Interface
   |                (needs extraction results + lookup results to display)
   |
   +-----------> 7. PDF Generation (Laufliste)
   |                (needs confirmed/reviewed data to generate from)
   |
   +---------------> 8. History + Download
                        (needs generated PDFs to list and serve)
```

**Key insight for phase structure:** Steps 2 and 3 can be built in parallel. Steps 4 and 5 depend on 2 and 3 respectively but are independent of each other. Step 6 needs both 4 and 5. Step 7 needs 6. Step 8 needs 7. This suggests a 4-phase build:

- Phase 1: Skeleton + Auth + DB + File Storage + Behoerden Import
- Phase 2: AI Extraction + Authority Lookup (can be developed in parallel)
- Phase 3: Review UI + PDF Generation (the core user-facing workflow)
- Phase 4: History + Admin Panel + Polish

## Sources

- [Claude API PDF Support](https://platform.claude.com/docs/en/build-with-claude/pdf-support) -- Official Anthropic documentation, verified 2026-04-16. Confirms 32MB limit, 100 pages (200k context models), base64 and URL upload methods, structured output compatibility.
- [Claude API Structured Outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) -- Official Anthropic documentation. Confirms output_config json_schema approach, supported schema features, compilation latency on first request.
- [Next.js Project Structure](https://nextjs.org/docs/app/getting-started/project-structure) -- Official Next.js docs, route groups, App Router conventions.
- [Next.js Server Actions](https://nextjs.org/docs/13/app/building-your-application/data-fetching/server-actions-and-mutations) -- Official Next.js docs. Server Actions recommended over API routes for mutations in App Router apps.
- [react-pdf/renderer npm](https://www.npmjs.com/package/@react-pdf/renderer) -- v4.5.1 (April 2026), actively maintained, React 19 compatible since v4.1.0.
- [Anthropic TypeScript SDK](https://www.npmjs.com/package/@anthropic-ai/sdk) -- v0.88.0 (April 2026), actively maintained.
- [Next.js App Router 2026 Guide](https://dev.to/ottoaria/nextjs-app-router-in-2026-the-complete-guide-for-full-stack-developers-5bjl) -- Community guide confirming App Router as the recommended architecture for new projects.
- [SQLite vs PostgreSQL comparison](https://dev.to/lovestaco/postgresql-vs-sqlite-dive-into-two-very-different-databases-5a90) -- Confirms SQLite is ideal for single-user, low-concurrency internal tools.

---
*Architecture research for: German document legalization management app (Angela)*
*Researched: 2026-04-16*
