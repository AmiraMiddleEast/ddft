# Phase 2: Document Upload & AI Extraction — Research

**Researched:** 2026-04-17
**Domain:** File upload in Next.js 16, Claude PDF extraction with structured JSON+confidence output, Drizzle/SQLite schema, Server-Action concurrency
**Confidence:** HIGH for Claude API format, Next 16 body limits, Drizzle patterns; MEDIUM for exact token-per-page estimation and concurrency tuning

## Summary

Phase 2 is a file-upload + AI-extraction slice. All architectural choices are already locked in CONTEXT.md (D-01 through D-23). This research fills in the operational details: the exact Next 16.2 config needed to accept 10 MB PDFs via a Server Action, the current `@anthropic-ai/sdk` document-block shape, a sample extraction prompt that emits the required `{value, confidence, reasoning}` envelope, the Drizzle table shape for `document` / `extraction` / `extraction_log`, a SHA-256 dedup pattern using `crypto.subtle.digest`, how to gate encrypted PDFs with `pdf-lib`, and a `p-limit(3)` concurrency pattern that stays well under the Tier 1 Anthropic limit (50 RPM).

**Primary recommendation:** Upload happens in a single Next 16 Server Action that (1) validates file type + size via FormData, (2) hashes with `crypto.subtle.digest("SHA-256", ...)`, (3) short-circuits on dedup hit, (4) writes to `data/uploads/{uuid}.pdf`, (5) inserts `document` row with `extraction_status = 'pending'`, then returns progress state via `useActionState`. A second, separately-invoked extraction Server Action runs Claude per-document with `p-limit(3)` fan-out across a batch, writing `extraction` rows and an `extraction_log` audit row. Toast feedback is triggered client-side from `useActionState` transitions via a `useEffect` that watches the returned state shape.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Upload Flow & UX**
- **D-01** Single upload surface at `/upload` route (authenticated, inside `(app)` group). Accessible from home page.
- **D-02** Dropzone + file picker combined: a single visible drop area with an embedded "Dateien auswählen" button. Built with `react-dropzone` (lightweight, well-tested, works with Next 16/React 19). Accept: `application/pdf` only.
- **D-03** Batch upload supported from day one. Each file processed independently — per-file status (queued/uploading/extracting/done/error) so one failure doesn't block others.
- **D-04** Max file size: 10 MB per PDF. Max batch: 10 files. Server rejects larger.
- **D-05** Progress feedback: per-file row with status badge + spinner. Sonner toast on batch complete.

**File Storage**
- **D-06** Local filesystem per CLAUDE.md. Path: `data/uploads/{documentId}.pdf` where documentId is a UUID. Originals immutable — never overwritten. Re-uploads in Phase 5 get new IDs and a versioned link.
- **D-07** Database stores only metadata: id, user_id, filename (original), size, hash (sha256), mime, uploaded_at, storage_path.
- **D-08** SHA-256 dedup: if an identical file was already uploaded by this user, reuse the existing `document` row (saves Claude API calls).

**AI Extraction**
- **D-09** Claude API via `@anthropic-ai/sdk` 0.88 with document content block (base64-encoded PDF). Model: `claude-sonnet-4-20250514` per CLAUDE.md.
- **D-10** Response format: structured JSON, enforced via a detailed prompt + Zod validation on response. No tool-use API — plain JSON response with a strict schema in the prompt.
- **D-11** Confidence levels derived from Claude's own self-reported confidence per field. Prompt asks for `{value, confidence: "high"|"medium"|"low", reasoning}` per field. No secondary model or heuristic scoring.
- **D-12** Missing/unreadable fields: Claude returns `{value: null, confidence: "low", reasoning: "..."}`. UI shows "— nicht erkannt" in destructive color.
- **D-13** Extraction happens server-side in a Server Action (long-running allowed with Next 16 Server Actions up to ~60s). Not a client-side API call.
- **D-14** API errors surfaced to user: rate limit → retry banner; network → "Erneut versuchen" button; content policy → "Dokument konnte nicht analysiert werden" (rare).
- **D-15** Cost guardrail: log `input_tokens`, `output_tokens`, `cost_eur` per extraction to `extraction_log` table for audit.

**Data Model**
- **D-16** New Drizzle tables: `document`, `extraction` (one row per extracted field), `extraction_log`.
- **D-17** Per-field rows rejected JSON-column alternative — keeps Phase 3 review/edit simpler.

**UI Surfaces**
- **D-18** `/upload`, `/documents/[id]`, home page update.
- **D-19** Confidence badge colors: high = neutral, medium = warning (amber, new token), low = destructive.

**Language & Copy**
- **D-20** All UI German. Extracted field labels German.

**Security & Limits**
- **D-21** File-type sniffing, size limit, reject encrypted/password-protected PDFs with clear German error.
- **D-22** `ANTHROPIC_API_KEY` in `.env.local`. Never logged. Never sent to client.
- **D-23** Rate limit upload endpoint: 20 uploads/min per user.

### Claude's Discretion
- Exact confidence thresholds for UI color-coding (following D-11 Claude-reported values).
- Prompt engineering details for optimal extraction (documented in this research).
- Whether to preview PDFs inline (iframe) or link-out — UI-SPEC says inline iframe.
- Specific error message wordings.
- Whether to run extraction in parallel or serial for batch uploads — **recommend parallel with concurrency=3**.

### Deferred Ideas (OUT OF SCOPE)
- Editing extracted values → Phase 3
- Authority lookup from extracted bundesland/dokumenten_typ → Phase 3
- Grouping documents into cases → Phase 4
- Laufliste PDF generation → Phase 4
- Re-upload with versioning → Phase 5
- Extraction retry UI → Phase 5
- Image uploads (JPG/PNG) — future. V1 is PDF-only per CLAUDE.md.
- OCR fallback when Claude can't read the PDF — future.
- Per-document tagging / labels — future.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UPLD-01 | User can upload a single PDF via file picker or drag-and-drop | `react-dropzone` 15.0.0 with combined dropzone+picker (this research §Architecture Pattern 1); Server Action FormData handling (§Architecture Pattern 2) |
| UPLD-02 | User can upload multiple PDFs at once (batch upload) | `p-limit(3)` fan-out pattern (§Architecture Pattern 4); per-file status via `useActionState` (§Architecture Pattern 3) |
| EXTR-01 | System extracts structured data from uploaded PDF via Claude Vision (6 fields) | `@anthropic-ai/sdk` 0.88 `messages.create` with document content block (§Claude PDF Extraction); sample 6-field prompt (§Prompt Engineering) |
| EXTR-02 | System displays confidence indicators (high/medium/low) per extracted field | Self-reported confidence in prompt envelope (D-11); Zod schema validates the returned envelope (§Response Validation); UI badge mapping locked in UI-SPEC |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

- **Anthropic Claude** is the AI provider — no other model substitution.
- **Model:** `claude-sonnet-4-20250514`. Do NOT "upgrade" to Opus or a newer Sonnet without explicit direction.
- **Local filesystem** for uploads — Vercel Blob / S3 are out of scope (self-hosted deployment is the variant).
- **SQLite via better-sqlite3** — no PostgreSQL migration.
- **Drizzle ORM** — no raw SQL, no Prisma.
- **Server Actions (Next 16)** — do not add Express / separate API server.
- **Zod for validation** — reuse pattern from `lib/validations/auth.ts`.
- **GSD workflow enforcement:** implementation MUST go through `/gsd-execute-phase`, not direct edits.
- **German Laufliste output** — app UI may be German or English; Phase 2 CONTEXT D-20 locks German UI.
- **shadcn new-york preset, Tailwind v4 `@theme` directive, system font stack** — no tailwind.config.ts.

---

## Standard Stack

### Core (already installed, do not re-install)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.2.4 | Server Actions for upload + extraction | [VERIFIED: package.json]. Turbopack dev, App Router, body-limit config lives in `next.config.ts`. |
| react / react-dom | 19.2.5 | `useActionState`, server/client components | [VERIFIED: package.json]. `useActionState` is the standard way to wire a Server Action into a form with pending + result state. |
| typescript | 6.0.2 | Type safety | [VERIFIED: package.json]. |
| @anthropic-ai/sdk | 0.88.0 (project pins 0.88; 0.90.0 is latest on npm) | Claude PDF extraction | [VERIFIED: `npm view @anthropic-ai/sdk version` → 0.90.0 on 2026-04-17. CLAUDE.md pins 0.88.0 as current project target.] |
| drizzle-orm | 0.45.2 | New tables `document`, `extraction`, `extraction_log` | [VERIFIED: package.json]. |
| better-sqlite3 | 12.9.0 | SQLite driver | [VERIFIED: package.json]. |
| zod | 4.3.6 | FormData validation + Claude response validation | [VERIFIED: package.json]. Reuse `lib/validations/auth.ts` pattern. |
| sonner | 2.0.7 | Toast notifications | [VERIFIED: package.json]. Already mounted in root layout (Phase 1). |

### New dependencies to add
| Library | Version (latest verified) | Purpose | Why |
|---------|---------------------------|---------|-----|
| react-dropzone | 15.0.0 | Dropzone + file picker UI on `/upload` | [VERIFIED: `npm view react-dropzone version` → 15.0.0. D-02 locked this choice.] Supports React 19 (hooks-based since 16.8+). |
| pdf-lib | 1.17.1 | Server-side encrypted-PDF rejection (D-21) | [VERIFIED: `npm view pdf-lib version` → 1.17.1. Per `pdf-lib` issue #61 on GitHub, loading an encrypted PDF with `PDFDocument.load()` throws — this is the documented detection mechanism.] |
| p-limit | 7.3.0 (latest) — pin 7.x | Concurrency throttle for batch extraction | [VERIFIED: `npm view p-limit version` → 7.3.0. ESM-only since v4; Next 16 + Node 22 handle ESM cleanly.] |

### Installation
```bash
npm install react-dropzone@15 pdf-lib@1.17 p-limit@7
```

### Alternatives Considered (for planner context, not for re-opening)
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain JSON prompt + Zod | Anthropic Tool Use / `tool_choice` for structured output | Tool Use gives stronger schema guarantees but adds a `tool_result` round-trip and deviates from D-10. Rejected per CONTEXT. |
| `pdf-lib` | `pdfjs-dist` server-side | `pdfjs-dist` is heavier, browser-oriented, and overkill for just detecting encryption. |
| `p-limit` | `p-queue` / `bottleneck` | Our need is a fixed concurrency cap, not a full scheduler. `p-limit` is 1 KB; sufficient. |
| `crypto.subtle.digest` | `node:crypto` `createHash('sha256')` | Both work. WebCrypto is available in Node 22 globals (`globalThis.crypto`), portable to Edge if ever needed. Either is fine — Node's `createHash` streams, WebCrypto doesn't. For ≤10 MB we read the whole file anyway. |

---

## Architecture Patterns

### Recommended Project Structure (additions to Phase 1 layout)
```
app/
├── (app)/
│   ├── upload/
│   │   ├── page.tsx                      # Server Component: header + <UploadClient />
│   │   └── _components/
│   │       ├── UploadClient.tsx          # "use client": react-dropzone + useActionState
│   │       └── BatchRow.tsx              # Per-file status row
│   └── documents/
│       └── [id]/
│           ├── page.tsx                   # Server Component: fetch doc + extractions
│           └── _components/
│               ├── PdfPreview.tsx         # <iframe>
│               └── ExtractionTable.tsx    # table with confidence badges
lib/
├── uploads/
│   ├── actions.ts                         # "use server": uploadDocumentsAction, extractDocumentAction
│   ├── storage.ts                         # writeUploadToDisk, deleteUpload
│   ├── hash.ts                            # sha256 helper (Web Crypto)
│   └── pdf-validate.ts                    # isEncryptedPdf, isValidPdf (pdf-lib)
├── extraction/
│   ├── claude.ts                          # extractFields(pdfBuffer) -> ExtractionResult
│   ├── prompt.ts                          # EXTRACTION_PROMPT + EXPECTED_SCHEMA
│   ├── schema.ts                          # Zod schema for Claude response
│   └── cost.ts                            # computeCostEur({inputTokens, outputTokens})
└── validations/
    └── upload.ts                          # Zod schema for upload input (file-level)
db/
└── schema.ts                              # ADD document, extraction, extraction_log (do NOT overwrite better-auth tables)
data/
└── uploads/                               # gitignored; created on first upload
```

### Pattern 1: react-dropzone wrapped in shadcn Card

```tsx
// app/(app)/upload/_components/UploadClient.tsx
"use client";

import { useDropzone } from "react-dropzone";
import { useActionState, useCallback } from "react";
import { uploadDocumentsAction, type UploadState } from "@/lib/uploads/actions";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_BATCH = 10;

export function UploadClient() {
  const [state, formAction, pending] = useActionState<UploadState, FormData>(
    uploadDocumentsAction,
    { rows: [] },
  );

  const onDrop = useCallback((accepted: File[], rejected: unknown[]) => {
    // rejected handled via react-dropzone's fileRejections
    const fd = new FormData();
    for (const f of accepted) fd.append("files", f);
    React.startTransition(() => formAction(fd));
  }, [formAction]);

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxSize: MAX_FILE_BYTES,
    maxFiles: MAX_BATCH,
    multiple: true,
    disabled: pending,
  });

  // ... render
}
```
Source: [react-dropzone README](https://github.com/react-dropzone/react-dropzone). [CITED]

### Pattern 2: Server Action signature for FormData upload

```ts
// lib/uploads/actions.ts
"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export type UploadRowStatus = "queued" | "uploaded" | "extracting" | "done" | "error";
export type UploadRow = {
  clientKey: string;           // stable per-file id, echoed back to UI
  filename: string;
  status: UploadRowStatus;
  documentId?: string;         // set once uploaded
  errorCode?: UploadErrorCode; // localized copy looked up client-side
};
export type UploadState = { rows: UploadRow[] };

export async function uploadDocumentsAction(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { rows: [{ clientKey: "_", filename: "", status: "error", errorCode: "unauthenticated" }] };

  const files = formData.getAll("files") as File[];
  // ... validate each, hash, dedup, write to disk, insert row
  // ... return per-file row with status: "uploaded" and documentId
}
```

Two-step server flow:
1. **`uploadDocumentsAction(FormData)`** — synchronously writes each file to disk + inserts `document` row + returns `documentId[]`.
2. **`extractDocumentAction(documentId)`** — called per-document from the client (one Server Action invocation per file), runs Claude, writes `extraction` rows + `extraction_log`. This keeps each extraction's wall-clock independent and makes retry trivial.

Alternative: one fat action that does upload + extract. **Rejected** — a single slow extraction would block the UI from seeing that its siblings uploaded successfully.

### Pattern 3: Client-side fan-out with p-limit after upload returns

```tsx
"use client";
import pLimit from "p-limit";
import { extractDocumentAction } from "@/lib/uploads/actions";

const limit = pLimit(3); // CONTEXT Claude's Discretion: concurrency=3

async function triggerExtractions(docIds: string[], setRow: (id: string, patch: Partial<UploadRow>) => void) {
  await Promise.all(
    docIds.map(id => limit(async () => {
      setRow(id, { status: "extracting" });
      try {
        await extractDocumentAction(id);
        setRow(id, { status: "done" });
      } catch (e) {
        setRow(id, { status: "error", errorCode: classifyError(e) });
      }
    }))
  );
  toast.success("Analyse abgeschlossen."); // Sonner, per UI-SPEC
}
```

**Why concurrency=3:** Tier 1 Anthropic allows 50 RPM and 30,000 ITPM for Sonnet 4 models [CITED: docs.anthropic.com/en/api/rate-limits, 2026-04]. A 3-page PDF is roughly 5–7K input tokens (Anthropic docs show per-page token overhead varies by content density); at concurrency 3, a batch of 10 PDFs completes in ~3–4 waves, well under 30K ITPM. Concurrency 5+ risks hitting the ITPM ceiling in bursts. [ASSUMED: the token-per-page band is an informed estimate; verify with Anthropic's token-counting API on sample fixtures in Wave 0.]

### Pattern 4: Claude document content block via SDK 0.88

```ts
// lib/extraction/claude.ts
import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "node:fs/promises";
import { EXTRACTION_PROMPT } from "./prompt";
import { parseExtractionResponse } from "./schema";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function extractFields(storagePath: string) {
  const pdfBuffer = await readFile(storagePath);
  const base64 = pdfBuffer.toString("base64");

  const msg = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: base64,
          },
        },
        { type: "text", text: EXTRACTION_PROMPT },
      ],
    }],
  });

  // response.content is ContentBlock[]; find the first TextBlock
  const textBlock = msg.content.find(b => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("no_text_block");

  return {
    parsed: parseExtractionResponse(textBlock.text), // Zod-validated
    usage: msg.usage, // { input_tokens, output_tokens, cache_*, ... }
    model: msg.model,
  };
}
```
Source shape: [Claude PDF support docs](https://platform.claude.com/docs/en/build-with-claude/pdf-support) [CITED]. SDK signature: [@anthropic-ai/sdk README](https://github.com/anthropics/anthropic-sdk-typescript) [CITED]. The response `content` is an array of typed blocks — never treat it as a string; find the `type === "text"` block.

### Anti-Patterns to Avoid
- **Sending files through a Route Handler when a Server Action suffices.** Server Actions with `FormData` handle `File` natively in Next 16 and remove a whole HTTP layer of error-handling code.
- **Storing the PDF bytes in SQLite as a BLOB.** Keep the DB small and backups trivial (D-07). Files go on disk.
- **Hand-rolling a JSON parser on Claude's response.** Always wrap `JSON.parse` in a try/catch AND run the parsed object through Zod — Claude occasionally adds a preamble or wraps output in a `json` code fence.
- **Throwing from the Server Action for user-visible errors.** Throw only for unrecoverable bugs; return a discriminated-union state instead so `useActionState` shows the right message.
- **Assuming `pdf-lib` silently returns `false` for encrypted PDFs.** It throws. The detection pattern IS the try/catch around `PDFDocument.load(bytes)`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop with file picker fallback | Custom `drop`/`dragover` listeners + hidden `<input type=file>` | `react-dropzone` useDropzone | Handles drag-counter race, keyboard focus, paste, cross-browser MIME, filter-by-accept. |
| SHA-256 over a File/Buffer | Roll own with `crypto-js` or manual digest | `crypto.subtle.digest("SHA-256", bytes)` (Web Crypto, global in Node 22) | No dep added, FIPS-grade, same API server+Edge. |
| Structured output schema | Regex / split / hand-parse | Zod schema + `parse()` on Claude's JSON text block | Catches Claude drift from schema; gives typed `parsed` object. |
| Concurrency throttle | Loop with counters / semaphore class | `p-limit(3)` | 1 KB library, battle-tested, returns `Promise.all`-compatible promises. |
| Encrypted-PDF detection | Read bytes, look for `/Encrypt` dictionary | `pdf-lib`'s `PDFDocument.load()` throws on encrypted | Correct, accounts for multiple encryption variants. |
| PDF MIME sniffing | Trust the `Content-Type` header or file extension | `file.type === "application/pdf" && bytes.slice(0,4).toString() === "%PDF"` magic-bytes check | Header can be spoofed; magic-bytes is a 1-liner. |
| Cost tracking per request | Parse headers / guess token counts | `response.usage.{input_tokens,output_tokens}` from SDK | First-class on the SDK response. |

**Key insight:** Every item in this table is one line of dependency or API call away. Phase 2 has zero custom-cryptography, zero custom-concurrency, zero custom-PDF-parsing surface.

---

## Prompt Engineering (6-Field Extraction)

### Design Goals
1. Single round-trip — no tool-use, no multi-turn (D-10).
2. Output is a single JSON object wrapped in `<result>…</result>` XML tags so we can extract it robustly even if Claude adds narrative around it.
3. Each field reports `{value, confidence, reasoning}` — the exact envelope D-11 mandates.
4. Null-handling is explicit (D-12): if field is missing or unreadable, `value: null` + `confidence: "low"`.
5. German-document awareness — we tell Claude the input is German.
6. Output is plain JSON, NOT a tool call, matching D-10.

### Sample Prompt (verified-pattern, locked)

```
You are a precise information-extraction system for official German documents
that are being prepared for legalization for use in the United Arab Emirates.

The attached PDF is in German. Extract exactly these six fields. For each field,
output a JSON object with {value, confidence, reasoning}.

Fields:
  - dokumenten_typ        : The type of document (e.g. "Geburtsurkunde", "Heiratsurkunde",
                            "Zeugnis", "Führungszeugnis", "Diplom", "Apostille",
                            "Reisepass", "Handelsregisterauszug"). If unclear, return the
                            single best label in German. Do not invent types.
  - ausstellende_behoerde : The issuing authority as printed on the document
                            (e.g. "Standesamt München", "Bundesamt für Justiz",
                            "Universität Heidelberg"). Include the town when present.
  - ausstellungsort       : The place of issue (city only).
  - bundesland            : One of: "Baden-Württemberg", "Bayern", "Berlin",
                            "Brandenburg", "Bremen", "Hamburg", "Hessen",
                            "Mecklenburg-Vorpommern", "Niedersachsen",
                            "Nordrhein-Westfalen", "Rheinland-Pfalz", "Saarland",
                            "Sachsen", "Sachsen-Anhalt", "Schleswig-Holstein", "Thüringen",
                            or "Bund" if issued by a federal authority.
                            Infer from the city/authority if not explicit.
  - ausstellungsdatum     : The date of issue in ISO format YYYY-MM-DD.
                            If only month/year visible, use the 1st of the month and
                            mark confidence "medium".
  - voller_name           : The full name of the person the document is about
                            (not the official signing the document).

Confidence levels:
  - "high"   : You read it directly and unambiguously from the document.
  - "medium" : You inferred it from context or partial information.
  - "low"    : You are guessing, or the value is missing/unreadable.

If a field is missing or unreadable, set value to null and confidence to "low"
with a short reasoning in German.

Return ONLY a single JSON object wrapped in <result> tags. No prose before
or after. Use German strings for values. Keep reasoning under 120 characters.

<result>
{
  "dokumenten_typ":        { "value": "...", "confidence": "high|medium|low", "reasoning": "..." },
  "ausstellende_behoerde": { "value": "...", "confidence": "high|medium|low", "reasoning": "..." },
  "ausstellungsort":       { "value": "...", "confidence": "high|medium|low", "reasoning": "..." },
  "bundesland":            { "value": "...", "confidence": "high|medium|low", "reasoning": "..." },
  "ausstellungsdatum":     { "value": "YYYY-MM-DD", "confidence": "high|medium|low", "reasoning": "..." },
  "voller_name":           { "value": "...", "confidence": "high|medium|low", "reasoning": "..." }
}
</result>
```

### Response Validation (Zod)

```ts
// lib/extraction/schema.ts
import { z } from "zod";

const confidence = z.enum(["high", "medium", "low"]);
const fieldStr = z.object({
  value: z.string().nullable(),
  confidence,
  reasoning: z.string().max(240),
});
const fieldDate = z.object({
  value: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  confidence,
  reasoning: z.string().max(240),
});

export const ExtractionResponse = z.object({
  dokumenten_typ:        fieldStr,
  ausstellende_behoerde: fieldStr,
  ausstellungsort:       fieldStr,
  bundesland:            fieldStr,
  ausstellungsdatum:     fieldDate,
  voller_name:           fieldStr,
});
export type ExtractionResponseT = z.infer<typeof ExtractionResponse>;

export function parseExtractionResponse(raw: string): ExtractionResponseT {
  const m = raw.match(/<result>([\s\S]*?)<\/result>/);
  const json = m ? m[1] : raw; // fallback: try raw if no tags
  const parsed = JSON.parse(json.trim());
  return ExtractionResponse.parse(parsed);
}
```

Sources: [Anthropic Cookbook — structured JSON extraction](https://github.com/anthropics/anthropic-cookbook/blob/main/tool_use/extracting_structured_json.ipynb) [CITED]. [Claude prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) [CITED].

### Tuning Notes
- `max_tokens: 2048` is generous — typical responses are ~500 tokens for this schema. Leave headroom for Claude's reasoning strings.
- **Temperature:** default (1.0) is fine for this schema. For stricter determinism on extraction tasks, `temperature: 0` is defensible but not mandatory. [ASSUMED: both work for this prompt; defaulting to `temperature` unset.]
- Do NOT pass `system` prompt — the task is self-contained in the user turn.

---

## Schema Additions (Drizzle + SQLite)

Extend `db/schema.ts` — **do not overwrite** existing better-auth tables (`user`, `session`, `account`, `verification`). Append:

```ts
import { sqliteTable, text, integer, real, index, uniqueIndex, check } from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";
import { user } from "./schema"; // existing better-auth user

export const EXTRACTION_STATUS = ["pending", "extracting", "done", "error"] as const;
export const CONFIDENCE = ["high", "medium", "low"] as const;
export const FIELD_NAMES = [
  "dokumenten_typ",
  "ausstellende_behoerde",
  "ausstellungsort",
  "bundesland",
  "ausstellungsdatum",
  "voller_name",
] as const;

export const document = sqliteTable(
  "document",
  {
    id: text("id").primaryKey(),                           // uuid
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),                  // original filename as uploaded
    size: integer("size").notNull(),                       // bytes
    sha256: text("sha256").notNull(),                      // hex
    mime: text("mime").notNull().default("application/pdf"),
    storagePath: text("storage_path").notNull(),           // "data/uploads/{id}.pdf"
    uploadedAt: integer("uploaded_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`).notNull(),
    extractedAt: integer("extracted_at", { mode: "timestamp_ms" }),
    extractionStatus: text("extraction_status", { enum: EXTRACTION_STATUS })
      .notNull().default("pending"),
    errorCode: text("error_code"),                         // null unless status=error
  },
  (t) => [
    uniqueIndex("document_user_sha_uniq").on(t.userId, t.sha256),
    index("document_user_idx").on(t.userId),
    index("document_uploaded_at_idx").on(t.uploadedAt),
    check("document_status_ck",
      sql`${t.extractionStatus} IN ('pending','extracting','done','error')`),
  ],
);

export const extraction = sqliteTable(
  "extraction",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id").notNull()
      .references(() => document.id, { onDelete: "cascade" }),
    fieldName: text("field_name", { enum: FIELD_NAMES }).notNull(),
    fieldValue: text("field_value"),                       // nullable per D-12
    confidence: text("confidence", { enum: CONFIDENCE }).notNull(),
    reasoning: text("reasoning"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`).notNull(),
  },
  (t) => [
    uniqueIndex("extraction_doc_field_uniq").on(t.documentId, t.fieldName),
    index("extraction_doc_idx").on(t.documentId),
    check("extraction_confidence_ck",
      sql`${t.confidence} IN ('high','medium','low')`),
    check("extraction_field_ck",
      sql`${t.fieldName} IN ('dokumenten_typ','ausstellende_behoerde','ausstellungsort','bundesland','ausstellungsdatum','voller_name')`),
  ],
);

export const extractionLog = sqliteTable(
  "extraction_log",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id").notNull()
      .references(() => document.id, { onDelete: "cascade" }),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    costEur: real("cost_eur").notNull(),
    claudeModel: text("claude_model").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`).notNull(),
  },
  (t) => [index("extraction_log_doc_idx").on(t.documentId)],
);

export const documentRelations = relations(document, ({ one, many }) => ({
  user: one(user, { fields: [document.userId], references: [user.id] }),
  extractions: many(extraction),
  logs: many(extractionLog),
}));
export const extractionRelations = relations(extraction, ({ one }) => ({
  document: one(document, { fields: [extraction.documentId], references: [document.id] }),
}));
export const extractionLogRelations = relations(extractionLog, ({ one }) => ({
  document: one(document, { fields: [extractionLog.documentId], references: [document.id] }),
}));
```

### Drizzle SQLite enum notes
- `text("x", { enum: [...] as const })` gives TypeScript inference only, NOT runtime enforcement [CITED: orm.drizzle.team/docs/column-types/sqlite].
- `check()` constraint is required for DB-level enforcement [CITED: Drizzle AnswerOverflow thread]. Both are layered above for safety.

### Generate migration
```bash
npx drizzle-kit generate   # writes new SQL to drizzle/
npx drizzle-kit push       # applies to data/angela.db (dev)
```
Commit the generated SQL + `meta/` to git per Phase 1 pattern.

---

## SHA-256 Dedup Strategy

```ts
// lib/uploads/hash.ts
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}
```

**Flow:**
1. In the Server Action, for each `File`, get bytes with `new Uint8Array(await file.arrayBuffer())`.
2. Compute hash.
3. Query `document` WHERE `user_id = session.user.id AND sha256 = :hash`.
4. If hit → skip write to disk, reuse existing row, return its `documentId` with status `done` (or current status).
5. If miss → write file to `data/uploads/{uuid}.pdf`, insert row, return new `documentId` with status `pending`.

**Why `(user_id, sha256)` and not just `sha256`:** Different users could legitimately upload the same file (though Angela is single-user for now). Scoping to user matches CONTEXT D-08.

[CITED: developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest] — `crypto.subtle.digest` is spec-compliant on Node 22 via `globalThis.crypto`.

---

## PDF Validation (encrypted rejection)

```ts
// lib/uploads/pdf-validate.ts
import { PDFDocument } from "pdf-lib";

export type PdfValidation =
  | { ok: true }
  | { ok: false; reason: "invalid_pdf" | "encrypted_pdf" };

export async function validatePdf(bytes: Uint8Array): Promise<PdfValidation> {
  // 1. Magic bytes
  if (bytes.byteLength < 5 || String.fromCharCode(...bytes.slice(0, 4)) !== "%PDF") {
    return { ok: false, reason: "invalid_pdf" };
  }
  // 2. pdf-lib load — throws on encrypted
  try {
    await PDFDocument.load(bytes, { ignoreEncryption: false });
    return { ok: true };
  } catch (e) {
    const msg = String((e as Error).message ?? e).toLowerCase();
    if (msg.includes("encrypt")) return { ok: false, reason: "encrypted_pdf" };
    return { ok: false, reason: "invalid_pdf" };
  }
}
```

Map `reason` to the locked German copy in UI-SPEC:
- `invalid_pdf` → `Datei ist kein gültiges PDF.`
- `encrypted_pdf` → `PDF ist passwortgeschützt und kann nicht analysiert werden.`

[CITED: Hopding/pdf-lib issue #61] — `PDFDocument.load` throws on encrypted documents; this IS the detection pattern. [CITED]

---

## Cost Tracking

```ts
// lib/extraction/cost.ts
export const PRICING_PER_MTOK = {
  "claude-sonnet-4-20250514": { inputUsd: 3, outputUsd: 15 },
} as const;

// Runtime-configurable FX rate; default 0.92 EUR/USD.
const USD_TO_EUR = Number(process.env.USD_TO_EUR ?? "0.92");

export function computeCostEur(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING_PER_MTOK[model as keyof typeof PRICING_PER_MTOK];
  if (!p) return 0; // unknown model — don't fabricate cost
  const usd = (inputTokens * p.inputUsd + outputTokens * p.outputUsd) / 1_000_000;
  return Number((usd * USD_TO_EUR).toFixed(6));
}
```

**Pricing verification:** $3.00 per MTok input, $15.00 per MTok output for `claude-sonnet-4-20250514`. [CITED: platform.claude.com/docs/en/about-claude/pricing; pricepertoken.com/anthropic-claude-sonnet-4, 2025-2026]. These have been stable since model release in May 2025.

**FX rate:** [ASSUMED: 0.92 EUR/USD is a ballpark number for internal audit logging. For production accounting, either wire up a daily FX feed or accept a rough audit-only value. Flag for planner to confirm whether operator needs accurate-to-the-day EUR or a "good enough" indicator.]

---

## Batch Extraction Concurrency

```ts
// Client-side, after uploadDocumentsAction returns documentId[]:
import pLimit from "p-limit";
const limit = pLimit(3);

const results = await Promise.all(
  docIds.map(id => limit(async () => {
    try {
      return { id, ok: true, result: await extractDocumentAction(id) };
    } catch (e) {
      return { id, ok: false, error: e };
    }
  }))
);
```

### Why concurrency=3 (and not 5 or 10)
Tier 1 Anthropic limits for Sonnet 4 [CITED: docs.anthropic.com/en/api/rate-limits, as of April 2026]:
- 50 RPM
- 30,000 ITPM (input tokens per minute) — shared across Sonnet 4.x variants

A typical 1–3 page German document at 1,500–3,000 input tokens per page (plus ~200 tokens for the prompt) is ~3K–10K input tokens per call. [ASSUMED estimate — verify with the token-counting API against fixtures in Wave 0.]

At concurrency=3 sustained, 3 calls/wave × ~5K tokens avg = 15K tokens in flight per ~5-second wave. Over a minute that's well under 30K ITPM — comfortable headroom. Concurrency=5 would approach the ceiling on batches of dense scans; concurrency=10 would burst past it.

### Retry on 429
Rate-limit errors from the SDK surface as `APIError` with `status: 429`. Wrap `extractDocumentAction` body with a single retry after the `retry-after` header, max 1 retry. More than 1 retry risks amplifying a sustained rate-limit event.

---

## Next 16 Server Action body size limit (critical gotcha)

### The problem
Default Server Action body limit is **1 MB**, which would reject every PDF upload [CITED: nextjs.org/docs/app/api-reference/config/next-config-js/serverActions].

### The fix
```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb", // 10 files × ~2.4 MB avg; headroom for base64 overhead
    },
    // Next 15.5+ added a second gate that also defaults to 1 MB when standalone.
    // See pitfall below — may need to set for production parity.
    proxyClientMaxBodySize: "25mb",
  },
};

export default nextConfig;
```

### Size math for "10 files × 10 MB" batch
A batch of 10 × 10 MB raw = 100 MB. That exceeds what a Server Action should accept as a single FormData payload.

**Recommendation:** **Do NOT treat the whole batch as one request.** Either:
- **Option A (recommended):** Client submits each file in its own Server Action call (loop over files client-side, await each), so each request is ≤10 MB. `bodySizeLimit: "15mb"` covers a single 10 MB file plus FormData overhead.
- **Option B:** Bump limit to 110 MB. Works but parses everything into a single FormData tree on the server — more memory pressure.

Option A is cleaner and already fits the per-file status model in UI-SPEC.

```ts
// Revised: per-file client-side loop
async function submitBatch(files: File[]) {
  for (const file of files) {
    const fd = new FormData();
    fd.append("file", file);
    // Each call is independent; update UI after each
    const res = await uploadSingleDocumentAction(fd);
    // then kick off extractDocumentAction via p-limit
  }
}
```

### Next 15.5+ `proxyClientMaxBodySize` gotcha
A separate 1 MB body limit was introduced in Next 15.5 for standalone/production deployments, independent of `serverActions.bodySizeLimit`. Both must be raised. [CITED: nextjs.org/docs/app/api-reference/config/next-config-js/proxyClientMaxBodySize; github.com/vercel/next.js/discussions/77505]. Our deployment target is self-hosted (VPS), so we will hit this — set both.

---

## Common Pitfalls

### Pitfall 1: Sonner toast from Server Action state
**What goes wrong:** Calling `toast.success(...)` from inside a Server Action does nothing (runs on server).
**Why it happens:** Sonner is a client-only toast system.
**How to avoid:**
```tsx
"use client";
const [state, formAction] = useActionState(...);
useEffect(() => {
  if (state.lastEvent === "batch_done") toast.success("Analyse abgeschlossen.");
  if (state.lastEvent === "batch_partial") toast.error(`Analyse abgeschlossen. ${state.errorCount} Datei(en) mit Fehler.`);
}, [state.lastEvent, state.errorCount]);
```
The returned state needs a `lastEvent: "idle" | "batch_done" | "batch_partial"` discriminator so the effect can fire exactly once per transition.

### Pitfall 2: Forgetting `proxyClientMaxBodySize`
**What goes wrong:** Works in `next dev`, silently truncates body in production build.
**Why it happens:** Next 15.5+ added a second body gate.
**How to avoid:** Set both `experimental.serverActions.bodySizeLimit` AND `experimental.proxyClientMaxBodySize` in `next.config.ts`.

### Pitfall 3: Claude response not pure JSON
**What goes wrong:** Claude wraps JSON in ```json ... ``` code fences or adds a prose preamble despite instructions.
**Why it happens:** Model-sampling variance. Prompt discipline reduces but doesn't eliminate it.
**How to avoid:** Wrap JSON in `<result>...</result>` tags in the prompt. Extract with regex `/<result>([\s\S]*?)<\/result>/`. Fall back to `JSON.parse(raw)` if tags missing. Then always run through Zod.

### Pitfall 4: Treating `content` as a string
**What goes wrong:** `msg.content.text` is `undefined`; code throws.
**Why it happens:** `content` is `ContentBlock[]` — an array of typed blocks [CITED: anthropics/anthropic-sdk-typescript issue #432].
**How to avoid:** `const block = msg.content.find(b => b.type === "text"); if (block?.type === "text") { use block.text }`.

### Pitfall 5: Hashing after writing the file
**What goes wrong:** File is written to disk, THEN hashed, THEN dedup check runs. If dedup hits, we have a ghost file.
**Why it happens:** Obvious ordering mistake.
**How to avoid:** Hash FIRST, dedup-check SECOND, write to disk only on miss.

### Pitfall 6: Running extraction inside the upload Server Action
**What goes wrong:** One slow Claude call blocks the whole batch's upload-confirmation UX.
**Why it happens:** "Just call it all in one action."
**How to avoid:** Upload and extraction are two separate Server Actions. Extraction is triggered per-document from the client, throttled by `p-limit(3)`.

### Pitfall 7: Missing `await headers()` in Server Actions
**What goes wrong:** `auth.api.getSession({ headers: headers() })` — returns a Promise-wrapped object; session is always `null`.
**Why it happens:** Next 15+ made `headers()` async.
**How to avoid:** `await headers()` everywhere. Phase 1 already establishes this pattern.

### Pitfall 8: SQLite `uniqueIndex` on `(user_id, sha256)` without an existing row fallback
**What goes wrong:** Dedup race on double-click: two Server Actions hash the same file concurrently, both try to insert, one throws UNIQUE.
**Why it happens:** No `ON CONFLICT DO NOTHING` by default.
**How to avoid:** Use `INSERT ... ON CONFLICT(user_id, sha256) DO NOTHING RETURNING *` and follow up with a `SELECT` by hash if `RETURNING` comes back empty. Drizzle supports `.onConflictDoNothing()`.

### Pitfall 9: `p-limit` is ESM-only (v4+)
**What goes wrong:** `require('p-limit')` fails in a CommonJS context.
**Why it happens:** ESM-only package.
**How to avoid:** Next 16 is ESM-native; this is a non-issue for us. Mentioned for awareness.

### Pitfall 10: Reading the full PDF into memory for hashing when streaming would save RAM
**What goes wrong:** 10 concurrent 10 MB uploads = 100 MB in memory.
**Why it happens:** Web Crypto's `digest()` doesn't stream [CITED: MDN SubtleCrypto.digest].
**How to avoid:** Accept this tradeoff — 10 × 10 MB is 100 MB, tolerable for a single-user internal tool on a VPS. If memory becomes a concern, switch to Node's `createHash('sha256').update(stream)` which streams.

---

## Code Examples (verified patterns)

### Anthropic SDK PDF call
```ts
// Source: https://platform.claude.com/docs/en/build-with-claude/pdf-support
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic();

const msg = await client.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 2048,
  messages: [{
    role: "user",
    content: [
      { type: "document",
        source: { type: "base64", media_type: "application/pdf", data: base64Pdf } },
      { type: "text", text: extractionPrompt },
    ],
  }],
});
// msg.usage.input_tokens, msg.usage.output_tokens
// msg.content is ContentBlock[]
```

### Server Action receiving a File from FormData
```ts
// Source: https://nextjs.org/docs/app/guides/forms
"use server";
export async function uploadSingleDocumentAction(_prev, fd: FormData) {
  const file = fd.get("file");
  if (!(file instanceof File)) return { ok: false, error: "no_file" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  // bytes is ready to hash / validate / persist
}
```

### react-dropzone with shadcn Card
```tsx
// Source: https://github.com/react-dropzone/react-dropzone
const { getRootProps, getInputProps, isDragActive } = useDropzone({
  accept: { "application/pdf": [".pdf"] },
  maxSize: 10 * 1024 * 1024,
  maxFiles: 10,
  onDrop: (accepted, rejected) => { /* ... */ },
});
// <Card {...getRootProps()} className="border-dashed">
//   <input {...getInputProps()} />
//   {isDragActive ? "Zum Hochladen loslassen" : "PDFs hierher ziehen"}
// </Card>
```

### Drizzle INSERT with dedup (onConflictDoNothing)
```ts
import { and, eq } from "drizzle-orm";
const inserted = await db.insert(document)
  .values({ id: uuid(), userId, filename, size, sha256, storagePath, mime: "application/pdf" })
  .onConflictDoNothing({ target: [document.userId, document.sha256] })
  .returning();

let docRow = inserted[0];
if (!docRow) {
  // conflict — fetch existing
  docRow = (await db.select().from(document)
    .where(and(eq(document.userId, userId), eq(document.sha256, sha256)))
    .limit(1))[0];
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Route Handler + `formidable` / `multer` | Next 16 Server Action with native `FormData` | Next 14 stabilized Server Actions; Next 16 expanded bodySizeLimit config | No Route Handler needed for uploads. |
| Anthropic text-only with OCR preprocessing | Claude PDF document block (native visual parsing) | Claude 3.5 Sonnet (Nov 2024) | No OCR step; Claude reads scanned German docs directly. |
| Tool Use for structured output | Plain JSON + Zod, OR Anthropic "Structured Outputs" | Structured Outputs launched 2026 | CONTEXT D-10 locks plain JSON. Noted for Phase 3+ if we hit reliability issues. |
| `crypto.createHash('sha256')` | `crypto.subtle.digest("SHA-256", ...)` (Web Crypto) | Node 18+ (stable in 20/22) | Universal API — no import needed, works in Edge runtime too. |

**Deprecated/outdated to avoid:**
- `PDFDocument.load(..., { ignoreEncryption: true })` — defeats the whole detection strategy. Don't.
- `@anthropic-ai/sdk` pre-0.27 — older `completions` API. We use `messages`.
- Single-request batch upload (multiple files in one FormData) at >10 MB total — use per-file requests.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (runtime for Server Actions) | All | ✓ | ≥22 per package.json `engines` | — |
| npm | Install new deps | ✓ | bundled with Node | — |
| `ANTHROPIC_API_KEY` env var | Extraction | ✗ (not set per Phase 1) | — | **BLOCKING** — operator must provide. `/gsd-discuss-phase` locked this as D-22. Plan must include setup step. |
| `data/uploads/` directory writable | Upload storage | ✓ (assumed — repo root is writable) | — | Create in Task 1; ensure `.gitignore` entry. |
| `USD_TO_EUR` env var | Cost calculation | ✗ (optional) | — | Default 0.92 hardcoded. |

**Missing dependencies with no fallback:**
- `ANTHROPIC_API_KEY` — operator MUST set this in `.env.local` before first extraction call. Plan should include a startup guard in `lib/extraction/claude.ts` that throws a clear error if the env var is unset.

**Missing dependencies with fallback:**
- `USD_TO_EUR` — defaults to `0.92` when unset.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.4 with happy-dom ^20.9.0 |
| Config file | `vitest.config.ts` (established Phase 1) |
| Quick run command | `npx vitest run --testNamePattern "<name>"` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| UPLD-01 | Server Action accepts a single PDF, stores to disk, inserts `document` row | integration (node env) | `npx vitest run __tests__/uploads/upload-single.test.ts` | ❌ Wave 0 |
| UPLD-01 | Rejects wrong-type FormData with `invalid_pdf` | integration | `npx vitest run __tests__/uploads/upload-invalid-type.test.ts` | ❌ Wave 0 |
| UPLD-01 | Rejects encrypted PDF with `encrypted_pdf` | integration | `npx vitest run __tests__/uploads/upload-encrypted.test.ts` | ❌ Wave 0 (needs encrypted PDF fixture) |
| UPLD-01 | Rejects >10 MB with `too_large` | integration | `npx vitest run __tests__/uploads/upload-too-large.test.ts` | ❌ Wave 0 |
| UPLD-02 | Duplicate hash returns existing `documentId` (dedup) | integration | `npx vitest run __tests__/uploads/dedup.test.ts` | ❌ Wave 0 |
| UPLD-02 | Multiple per-file Server Action invocations each return independently | integration | `npx vitest run __tests__/uploads/batch.test.ts` | ❌ Wave 0 |
| EXTR-01 | Extract calls Claude with document block + returns Zod-parsed envelope | unit (mocked SDK) | `npx vitest run __tests__/extraction/claude-mocked.test.ts` | ❌ Wave 0 |
| EXTR-01 | Prompt contains all 6 field names and confidence enum literals | unit | `npx vitest run __tests__/extraction/prompt.test.ts` | ❌ Wave 0 |
| EXTR-01 | `parseExtractionResponse` extracts `<result>` tags and parses JSON | unit | `npx vitest run __tests__/extraction/parse.test.ts` | ❌ Wave 0 |
| EXTR-01 | `parseExtractionResponse` rejects malformed JSON with clear error | unit | same file | ❌ Wave 0 |
| EXTR-02 | Extraction persists per-field `confidence` into `extraction` rows | integration | `npx vitest run __tests__/extraction/persist.test.ts` | ❌ Wave 0 |
| EXTR-02 | Null value maps to `confidence: low` per D-12 | unit | `npx vitest run __tests__/extraction/null-handling.test.ts` | ❌ Wave 0 |
| (audit) | `computeCostEur` matches pricing table + FX default 0.92 | unit | `npx vitest run __tests__/extraction/cost.test.ts` | ❌ Wave 0 |
| (audit) | `extraction_log` row written with correct model + token counts | integration | same file as persist test | ❌ Wave 0 |
| (manual-only) | Visual dropzone interaction (drag-over color swap, focus ring) | manual UAT | — | Acceptable — UI behavior verified via HUMAN-UAT.md |
| (manual-only) | End-to-end PDF preview iframe renders in browser | manual UAT | — | Manual only — iframe blocked by test env |

### Sampling Rate
- **Per task commit:** `npx vitest run --changed` (runs only tests touching changed files).
- **Per wave merge:** `npx vitest run` (full suite).
- **Phase gate:** Full suite green + `npx tsc --noEmit` clean before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `__tests__/_fixtures/test-db.ts` — extend for new tables (if not auto-covered by `drizzle-kit push`).
- [ ] `__tests__/_fixtures/pdf-fixtures.ts` — helpers to load fixture PDFs from repo root (use `Publication_Record_SH.pdf`, `transcript.pdf`, `diploma.pdf`).
- [ ] `__tests__/_fixtures/encrypted.pdf` — need to generate/acquire a password-protected PDF fixture. (Can be produced via `qpdf --encrypt` or pdf-lib's encryption fork.)
- [ ] `__tests__/_fixtures/claude-mock.ts` — factory that returns a typed mock `messages.create` response.
- [ ] All 13 test files listed above.
- [ ] `.gitignore` entry: `data/uploads/` (if not already present from Phase 1).

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | `auth.api.getSession()` gate in every Server Action (Phase 1 pattern) |
| V3 Session Management | yes | Inherit better-auth cookie scheme from Phase 1; no changes here |
| V4 Access Control | yes | Every `document` query scoped by `session.user.id`; `documents/[id]` page 404s if `document.userId !== session.user.id` |
| V5 Input Validation | yes | Zod on FormData; magic-bytes check for PDF; MIME check; size check; `pdf-lib` structural check |
| V6 Cryptography | partial | SHA-256 via Web Crypto (never hand-rolled). No encryption of files at rest in Phase 2 (deferred — single-user VPS) |
| V8 Data Protection | yes | API key only in `.env.local`, never logged, never in responses (D-22) |
| V12 Files & Resources | yes | Stored under `data/uploads/` with UUID filenames (not user-supplied); never served via path joining user input |
| V13 API | yes | Server Actions are not public APIs; CSRF is handled by Next |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious PDF (exploit in the PDF viewer iframe) | Tampering / Elevation | Serve the PDF via a streaming route that sets `Content-Disposition: inline` + `X-Content-Type-Options: nosniff`; consider sandboxed iframe `sandbox="allow-same-origin"` (minimum needed for PDF.js). [ASSUMED: browser's built-in PDF viewer sandbox is sufficient for an internal tool; confirm before external handoff.] |
| Path traversal via filename | Tampering | NEVER use user-supplied filename as disk path. We use UUIDs exclusively. Original filename is stored only in the `document` row for display. |
| DoS via oversized uploads | DoS | `bodySizeLimit` + `proxyClientMaxBodySize` + per-file 10 MB client-side + D-23 rate limit 20/min |
| API key exfiltration | Information Disclosure | `ANTHROPIC_API_KEY` never rendered to a Client Component, never in a Server Action return value, never in error messages |
| Cost-abuse (someone uploading to burn our Claude spend) | Repudiation / DoS | D-23 rate limit on uploads; `extraction_log` gives a real-time cost view the operator can check; single-user auth means only operator can upload at all |
| SQL injection | Tampering | Drizzle uses parameterized queries universally — no string concat in queries |
| SSRF via PDF embedded URLs | Information Disclosure | N/A — we send PDF bytes to Anthropic, we don't fetch anything from PDF content |
| CSRF on Server Action | Tampering | Next 16 Server Actions have built-in origin check and action-ID binding |

### Additional policy decisions required
- **PII retention:** Uploaded PDFs may contain personal data (names, dates of birth). **ASSUMED:** No retention policy is specified in REQUIREMENTS.md or CONTEXT.md. Plan should either (a) flag this as a deferred decision, or (b) surface to the operator before production. Not blocking for Phase 2 internal-tool scope.
- **File serving route:** Phase 2 renders PDFs via an iframe. The planner will need a `app/(app)/documents/[id]/file/route.ts` that streams the PDF from disk after verifying `document.userId === session.user.id`. This is a new Route Handler (exception to "no Route Handlers" — required because iframes can't call Server Actions).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 1,500–3,000 input tokens per PDF page (content-density dependent) | Batch Concurrency | Low — only affects concurrency-safety reasoning. Verify in Wave 0 via Anthropic token-counting API on the fixture PDFs. |
| A2 | `temperature` default (unset) is fine for extraction | Prompt Tuning Notes | Low — may revisit if extraction consistency is poor. |
| A3 | FX rate 0.92 USD→EUR is acceptable as a static approximation | Cost Tracking | Low — audit-only; not a user-facing billing value. Confirm with operator before any invoicing use. |
| A4 | Browser PDF iframe sandbox is sufficient security for internal tool | Security Domain | Medium — acceptable for single-user internal use; re-evaluate before external handoff. |
| A5 | No PII retention/deletion policy needed for V1 internal tool | Security Domain — policy | Medium — legal/compliance concern if app ever goes multi-tenant. Should be surfaced to operator. |
| A6 | Operator will supply `ANTHROPIC_API_KEY` in `.env.local` before first extraction | Environment Availability | **BLOCKING** if unset — clear-error guard is in the plan. |
| A7 | Pricing $3/$15 per MTok has not changed in the ~6 weeks since most recent verification | Cost Tracking | Low — off by 10% would be tolerable for audit logging. Re-verify on pricing page at plan time. |

---

## Open Questions

1. **Should extraction retry on 429 be in Phase 2 or Phase 5?**
   - What we know: CONTEXT defers "extraction retry UI" to Phase 5 but a single automatic retry on rate-limit makes the UX meaningfully better.
   - What's unclear: whether "retry" in D-Deferred means "user-visible retry button" only, or also backend auto-retry.
   - Recommendation: do a single silent retry in Phase 2 (simple, reduces noise). The user-visible "Erneut versuchen" button is explicitly in scope (UI-SPEC mentions it for error state). Ask the planner to confirm.

2. **Is the iframe PDF preview blocked by any same-origin or CSP rule we should know about?**
   - What we know: Phase 1 established no CSP yet. Iframes of same-origin PDFs are standard.
   - What's unclear: if `next start` production adds strict headers by default.
   - Recommendation: include a smoke test in HUMAN-UAT for the iframe actually rendering in production build.

3. **Where does the PDF file stream come from for the iframe?**
   - What we know: iframes cannot call Server Actions; they need a URL.
   - What's unclear: not explicitly decided — UI-SPEC says iframe but doesn't say how the iframe `src` is served.
   - Recommendation: a dedicated `app/(app)/documents/[id]/file/route.ts` Route Handler that validates ownership and streams bytes. Plan should include this.

4. **Should we persist `raw_response_text` from Claude for audit/debug?**
   - What we know: CONTEXT logs tokens + cost. Does not mention raw response storage.
   - What's unclear: whether keeping the raw Claude output is valuable for later re-parsing or debugging.
   - Recommendation: add an optional `extraction_log.raw_response TEXT` column. Non-blocking for Phase 2 success but cheap insurance. Planner to decide.

---

## Sources

### Primary (HIGH confidence — official docs or package metadata)
- [Claude PDF support docs](https://platform.claude.com/docs/en/build-with-claude/pdf-support) — 32 MB file / 100 page limits, document-block shape
- [Claude API pricing](https://platform.claude.com/docs/en/about-claude/pricing) — $3/$15 per MTok Sonnet 4
- [Claude rate limits](https://docs.anthropic.com/en/api/rate-limits) — Tier 1: 50 RPM, 30K ITPM
- [Anthropic TypeScript SDK README](https://github.com/anthropics/anthropic-sdk-typescript) — messages.create signature, ContentBlock array shape
- [Next.js serverActions config](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions) — bodySizeLimit default 1 MB, configurable
- [Next.js proxyClientMaxBodySize](https://nextjs.org/docs/app/api-reference/config/next-config-js/proxyClientMaxBodySize) — second body gate introduced 15.5+
- [Next.js Forms guide](https://nextjs.org/docs/app/guides/forms) — useActionState + FormData pattern
- [Drizzle SQLite column types](https://orm.drizzle.team/docs/column-types/sqlite) — text enum, check constraint
- [MDN SubtleCrypto.digest](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest) — SHA-256 usage, no streaming
- [react-dropzone README](https://github.com/react-dropzone/react-dropzone) — useDropzone API
- [pdf-lib issue #61 (Hopding/pdf-lib)](https://github.com/Hopding/pdf-lib/issues/61) — encrypted-PDF detection via load() throw
- [p-limit README](https://github.com/sindresorhus/p-limit) — concurrency API
- npm registry: `@anthropic-ai/sdk@0.90.0`, `react-dropzone@15.0.0`, `pdf-lib@1.17.1`, `p-limit@7.3.0` (verified via `npm view` on 2026-04-17)

### Secondary (MEDIUM confidence — verified against multiple sources)
- [Anthropic Cookbook: structured JSON extraction](https://github.com/anthropics/anthropic-cookbook/blob/main/tool_use/extracting_structured_json.ipynb) — prompt patterns
- [Claude prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
- [GitHub discussion #77505 (vercel/next.js)](https://github.com/vercel/next.js/discussions/77505) — proxyClientMaxBodySize gotcha
- [tokencalculator.com Claude rate limits April 2026](https://tokencalculator.com/blog/claude-api-rate-limits-april-2026) — Tier 1 numbers cross-verified

### Tertiary (LOW confidence — informed estimates, flagged for validation)
- Token-per-page estimate (1,500–3,000) — general-knowledge estimate; validate against Anthropic token-counting API before relying on the concurrency math (captured as A1).

---

## Metadata

**Confidence breakdown:**
- Standard stack + versions: HIGH — verified via `npm view` and package.json.
- Claude API shape + pricing: HIGH — official docs, stable since May 2025.
- Next 16 body-limit config: HIGH — official Next docs + confirmed gotcha in 15.5+.
- Drizzle schema: HIGH — official docs for SQLite enum + check.
- Prompt design: MEDIUM — structure is standard (XML tags + JSON payload) but exact wording is a Claude-Discretion item in CONTEXT; expect minor tuning in Wave 0.
- Concurrency=3: MEDIUM — derived from published Tier 1 limits + estimated tokens/page; safe but tunable.
- Security / PII retention: MEDIUM — no explicit requirement; assumptions flagged for planner.

**Research date:** 2026-04-17
**Valid until:** 2026-05-17 (stack is stable; re-verify Anthropic pricing and `proxyClientMaxBodySize` defaults if Next ships a 16.3 before plan execution).
