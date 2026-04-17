# Phase 3: Review & Authority Lookup — Research

**Researched:** 2026-04-17
**Domain:** Markdown → structured Drizzle seed (Claude), fuzzy slug resolution, city→Regierungsbezirk routing, Server Action lookup
**Confidence:** HIGH (stack verified against package.json + CLAUDE.md; parse strategy based on measured JSON sizes)

## Summary

Phase 3 adds two tightly coupled capabilities on top of Phase 2's extraction pipeline:

1. A review UI (`/documents/[id]/review`) letting the operator correct the 6 extracted fields with constrained dropdowns and approve them.
2. A deterministic **authority resolver** that maps `(dokumenten_typ, bundesland, ausstellungsort)` → a row in `behoerden_authority` and returns routing metadata + special rules.

The critical hidden dependency is data shape: `behoerden_db.json` stores **unstructured German markdown** per state (`dokumente_raw`), so the phase must ship a **Claude-powered parse-once seed** that materializes 4 new Drizzle tables (`behoerden_state`, `behoerden_regierungsbezirk`, `behoerden_document_type`, `behoerden_authority`) and a cached `data/behoerden-parsed.json` snapshot.

All other moving parts (fuzzy match, city routing, Zod, Server Action) are small and should be hand-written with a tiny well-known dependency (`fastest-levenshtein`) for Levenshtein distance.

**Primary recommendation:** Parse each state independently with Claude Sonnet 4 (16 calls on first run, cached afterward), store a deterministic JSON snapshot in `data/behoerden-parsed.json`, load that snapshot into Drizzle on subsequent seeds. Use `fastest-levenshtein` (MIT, ~2 kB, 7.3.0) with a small hardcoded `synonyms` map for dokumenten_typ normalization. Use a hardcoded `city → Regierungsbezirk` lookup for BY/BW/HE/NRW (~120 entries) — do NOT call Claude at lookup time.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01** `behoerden_db.json` currently contains raw markdown per state (`dokumente_raw`) — unstructured for queries. **Parse once at seed time** into structured Drizzle tables. This phase delivers both the seed script AND the lookup.
- **D-02** New tables:
  - `behoerden_state` (id TEXT PK = bundesland slug e.g. "bayern", name TEXT e.g. "Bayern", hat_regierungsbezirke BOOLEAN, besonderheiten TEXT)
  - `behoerden_regierungsbezirk` (id PK, state_id FK, name TEXT e.g. "Oberbayern", slug)
  - `behoerden_document_type` (id TEXT PK = slug e.g. "approbationsurkunde", display_name TEXT e.g. "Approbationsurkunde")
  - `behoerden_authority` (id PK, state_id FK, regierungsbezirk_id FK NULL, document_type_id FK, name TEXT, address TEXT, phone TEXT NULL, email TEXT NULL, website TEXT NULL, office_hours TEXT NULL, notes TEXT NULL, special_rules TEXT NULL, needs_review BOOLEAN — true when source had [PRÜFEN] marker)
- **D-03** Seed script `scripts/seed-behoerden.ts` parses `behoerden_db.json`. Parsing strategy: use Claude Sonnet to convert each state's `dokumente_raw` markdown into a structured JSON array of authorities. ONE-TIME cost per build, cached. Writes a derived `data/behoerden-parsed.json` snapshot so subsequent runs don't re-call Claude.
- **D-04** Parsing is idempotent: seed script checks if `data/behoerden-parsed.json` exists, skips re-parse unless `--force` flag. CI could commit the parsed snapshot.
- **D-05** Handle [PRÜFEN] markers: parser flags these entries with `needs_review: true`. UI surfaces a warning.
- **D-06** Special rules parser: Führungszeugnis exception ("no Vorbeglaubigung needed — goes direct to Apostille") and Reisepass exception (no legalization at all) stored as `special_rules` on the matching authority row.
- **D-07** Route: `/documents/[id]/review`. Linked from "Zur Überprüfung" button (Phase 2). Enable for `extraction_status=done`.
- **D-08** Layout: two-column ≥1024px; stacked below. Left: iframe PDF preview (Phase 2 component). Right: editable form.
- **D-09** All 6 fields editable. `dokumenten_typ` → shadcn Select (sorted `behoerden_document_type.display_name`). `bundesland` → Select (16 states + "Unbekannt/Sonstiges"). Others: free-text / `type="date"`.
- **D-10** Edited-field visual diff via accent left-border + `Ursprünglich: …` caption.
- **D-11** `Verwerfen` + `Speichern & Behörde ermitteln` buttons.
- **D-12** Lookup is a Server Action. Returns `{authority, routing_path, special_rules, needs_review}` or `{not_found: true, reason}`.
- **D-13** Resolution algorithm: slugify → doc_type match (fuzzy ≤2) → state lookup → Regierungsbezirk (if `hat_regierungsbezirke`) via city lookup → authority query → return first or ambiguous list.
- **D-14** Misses: surface `low confidence` or `Kein Eintrag — bitte prüfen`.
- **D-15** Persist via new `document_review` row (document_id, approved_by_user_id, approved_at, corrected_fields JSON, resolved_authority_id, lookup_status enum `matched|ambiguous|not_found`). Set `document.review_status='approved'`.
- **D-16** Authority detail panel: name (24px), address, phone/email/website (clickable), office hours, special-rules warning callout, `[PRÜFEN]` banner if applicable, routing breadcrumb.
- **D-17** Add shadcn `select`. Reuse Button, Card, Input, Label, Badge, Separator.
- **D-18** German-only copy; reuse Phase 2 warning token.
- **D-19** Ownership check on all review/approve actions.
- **D-20** Server Action validates inputs with Zod; length limits enforced.

### Claude's Discretion

- Exact markdown → JSON parsing prompt structure (covered below)
- Whether to use ISO-639 normalization on document-type strings
- Exact city → Regierungsbezirk mapping (hardcoded dict for major cities; Claude fallback optional)
- Fuzzy match threshold
- UI micro-interactions (save-disabled-while-submitting, etc.)

### Deferred Ideas (OUT OF SCOPE)

- Behörden admin CRUD UI → Phase 5
- Bulk authority import from another source → Phase 5
- Cross-document authority caching → not needed (lookup is cheap after parse)
- Re-triggering lookup if source JSON updates → Phase 5 admin refresh
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REVW-01 | Side-by-side view of original PDF and extracted data | Reuse `PdfPreview.tsx` in left column; form in right column; two-column Tailwind grid at `lg:` breakpoint (see Code Examples §A) |
| REVW-02 | User can edit all extracted fields inline | shadcn Input + Select with controlled React state; `useOptimistic` / `useFormStatus` patterns from Next.js 16 (see Code Examples §C) |
| REVW-03 | Constrained dropdowns for Bundesland + Dokumententyp | shadcn `select` component (new install) populated from `behoerden_state` / `behoerden_document_type` query at server-component load |
| REVW-04 | Approve triggers authority lookup | Server Action `approveAndResolve(documentId, corrected)` — Zod-validated input, ownership check, Drizzle query resolver, writes `document_review` row (see Code Examples §D) |
| LKUP-01 | Map (dokumenten_typ + bundesland) → correct Vorbeglaubigung authority | Drizzle query by `(state_id, document_type_id, regierungsbezirk_id=null)` with fuzzy slug match on doc type (see Architecture Pattern 2) |
| LKUP-02 | Regierungsbezirk sub-routing for BY/BW/HE/NRW | Hardcoded `CITY_TO_REGIERUNGSBEZIRK` map (~120 entries) — see Code Examples §E. Branch on `state.hat_regierungsbezirke`. |
| LKUP-03 | Display special rules + exceptions (Führungszeugnis, Reisepass) | `special_rules TEXT` column on `behoerden_authority` populated by Claude during seed parse; rendered as warning Badge in UI result panel |
| LKUP-04 | Show full authority contact details | All contact fields (name, address, phone, email, website, office_hours) stored as columns on `behoerden_authority`; parse prompt extracts each into its own field |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Stack:** Next.js 16.2 / React 19.2.5 / TS 6.0.2 / Tailwind 4.2.0 — do not introduce competing libraries.
- **DB:** SQLite + better-sqlite3 12.9.0 + Drizzle ORM 0.45.2 — all schema goes in `db/schema.ts` (verified via Read).
- **AI:** `@anthropic-ai/sdk` 0.88.0 with `claude-sonnet-4-20250514` — model ID already used in `lib/extraction/claude.ts`.
- **Auth:** better-auth — ownership check via `auth.api.getSession` inside Server Actions.
- **Validation:** Zod 4.3.6 — all Server Action inputs must be Zod-validated.
- **UI:** shadcn/ui new-york preset; no third-party registries; reuse Phase 2 warning token. Only `select` is new.
- **GSD workflow:** All file-changing work must flow through a GSD command. No direct edits outside plan.
- **Testing:** vitest 4.1 + happy-dom (configured — `vitest.config.ts` verified). Tests colocated under `lib/**/*.test.ts` or `__tests__/**`. Integration tests use `// @vitest-environment node`.

## Standard Stack

### Core (all already installed — do NOT reinstall)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | 0.88.0 | Markdown → structured JSON during seed | `[VERIFIED: package.json]` — already wired in `lib/extraction/claude.ts` with retry + cost logging |
| `drizzle-orm` | 0.45.2 | 4 new Behörden tables + `document_review` | `[VERIFIED: package.json]` First-class SQLite. Reuse existing `db/schema.ts`. |
| `better-sqlite3` | 12.9.0 | SQLite driver | `[VERIFIED: package.json]` |
| `zod` | 4.3.6 | Server Action input validation + seed output schema | `[VERIFIED: package.json]` |

### Supporting (1 new small dependency)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fastest-levenshtein` | 1.0.16 | Edit-distance for dokumenten_typ fuzzy match | `[VERIFIED: npm view fastest-levenshtein version → 1.0.16]` Single-function API, MIT, no deps, faster than `leven` and `fast-levenshtein` per its benchmark. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `fastest-levenshtein` | `fuse.js` 7.3.0 | Fuse is heavier (~12 kB gzipped + object-based config) and overkill — we need ONE distance calc per slug compare, not weighted multi-field search. `[VERIFIED: npm view fuse.js version → 7.3.0]` |
| `fastest-levenshtein` | `leven` 4.1.0 | Similar API but `fastest-levenshtein` benchmarks ~2× faster and is currently better maintained. `[VERIFIED: npm view leven version → 4.1.0]` |
| `fastest-levenshtein` | Hand-rolled Levenshtein | 15 lines of correct DP code — possible but the library is 2 kB with its own tests. Not worth the bug surface. |
| `fastest-levenshtein` | `closest-match` 1.3.3 | Returns best match from an array but hides the distance score — we want the raw score to enforce the ≤2 threshold from D-13. `[VERIFIED: npm view closest-match version → 1.3.3]` |
| One-shot full-file Claude parse | Per-state loop (RECOMMENDED) | Full file = ~135 kB markdown (~40k tokens). Per-state = 16 × ~2k-5k tokens. Per-state is **resumable** (crash mid-run doesn't re-spend); failures are scoped; and a single state's output JSON fits well under the 2048-token `max_tokens` cap used elsewhere when split (some states may need `max_tokens: 4096`). `[ASSUMED]` — exact token counts depend on tokenizer; chars/3.5 is a rough proxy. |
| Claude lookup at request time for city → Regierungsbezirk | Hardcoded dict | BY/BW/HE/NRW together have ~120 cities to list. Hardcoded = deterministic, testable, zero latency, zero cost. Claude fallback adds a 1-2s lookup roundtrip for no material benefit. |

**Installation:**

```bash
pnpm add fastest-levenshtein
pnpm dlx shadcn@latest add select
```

**Version verification (run before task starts):**

```bash
npm view fastest-levenshtein version
npm view @anthropic-ai/sdk version  # expect >=0.88.0
```

## Architecture Patterns

### Recommended Project Structure

```
app/(app)/documents/[id]/review/
├── page.tsx                       # Server Component: loads doc + extractions + dropdown data
├── _components/
│   ├── ReviewForm.tsx             # Client Component: the 6-field form, Select + Input
│   ├── FieldRow.tsx               # Label + input + confidence badge + Ursprünglich caption
│   ├── AuthorityResultPanel.tsx   # Renders matched / ambiguous / not_found variants
│   └── DiscardDialog.tsx          # shadcn AlertDialog wrapper
└── actions.ts                     # "use server" — approveAndResolve Server Action

lib/behoerden/
├── queries.ts                     # Drizzle SELECT helpers for dropdown data
├── resolve.ts                     # Pure resolver: corrected inputs → authority|ambiguous|not_found
├── resolve.test.ts                # Unit tests over synthetic fixture DB
├── slug.ts                        # slugify(), normalizeDokTyp(), fuzzy match
├── slug.test.ts
└── city-to-regierungsbezirk.ts    # Hardcoded map for BY/BW/HE/NRW

scripts/
├── seed-behoerden.ts              # Reads behoerden_db.json → calls Claude → writes data/behoerden-parsed.json → inserts into DB
└── parse-state-with-claude.ts     # Library function used by seed-behoerden

data/
└── behoerden-parsed.json          # Cached parse output (gitignored? or committed? — see pitfall §3)

db/schema.ts                       # Append 4 new tables + document_review + add review_status to document
```

### Pattern 1: Parse-Once Seed with Claude

**What:** During `scripts/seed-behoerden.ts`, loop over the 16 states in `behoerden_db.json`. For each state, send the `dokumente_raw` markdown to Claude Sonnet with a strict JSON-output prompt. Validate with Zod. Collect into one big object. Write to `data/behoerden-parsed.json`. Then in a second pass, insert into Drizzle tables.

**When to use:** One-time cost on first build. Re-runs skip the Claude call unless `--force` is passed. Deterministic insert pass runs every time (re-seeding is cheap).

**Why split parse from insert:** If schema changes, you can re-run only the insert pass without re-spending Claude credits. Also makes the parse output **reviewable in git diff** if the team chooses to commit it.

### Pattern 2: Deterministic Pure Resolver

**What:** `lib/behoerden/resolve.ts` exports `resolveAuthority(input, db): Promise<ResolverResult>`. Pure function: input in, result out. No side effects, no auth, no mutation. The Server Action wraps it with auth + persistence.

**Shape (sketch):**

```ts
type ResolverInput = {
  dokumenten_typ: string;
  bundesland: string;
  ausstellungsort: string;
  // other fields ignored — but pass the full corrected payload for future use
};

type ResolverResult =
  | { status: "matched"; authority: Authority; routing_path: string[]; special_rules: string | null; needs_review: boolean }
  | { status: "ambiguous"; candidates: Authority[]; routing_path: string[] }
  | { status: "not_found"; reason: "unknown_state" | "unknown_doc_type" | "no_authority_for_combination" };
```

**When to use:** Anywhere a test needs to verify routing without spinning up a Server Action.

**Why:** Enables exhaustive fixture-based testing (Nyquist validation §REVW+LKUP).

### Pattern 3: Server Action as Thin Wrapper

```ts
// app/(app)/documents/[id]/review/actions.ts
"use server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { resolveAuthority } from "@/lib/behoerden/resolve";
// ...

const ApproveSchema = z.object({
  documentId: z.string().min(1),
  corrected: z.object({
    dokumenten_typ: z.string().max(200),
    ausstellende_behoerde: z.string().max(300),
    ausstellungsort: z.string().max(200),
    bundesland: z.string().max(100),
    ausstellungsdatum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
    voller_name: z.string().max(300),
  }),
});

export async function approveAndResolve(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false as const, error: "unauthorized" };

  const parsed = ApproveSchema.safeParse(/* ... */);
  if (!parsed.success) return { ok: false as const, error: "invalid_input" };

  // Ownership check (pattern from Phase 2 PDF route)
  const doc = await getDocumentOwned(parsed.data.documentId, session.user.id);
  if (!doc) return { ok: false as const, error: "not_found" };

  const result = await resolveAuthority(parsed.data.corrected, db);

  // Persist document_review row + update document.review_status
  await db.transaction(async (tx) => { /* ... */ });

  return { ok: true as const, data: result };
}
```

### Anti-Patterns to Avoid

- **Building fuzzy match on embeddings.** Overkill. Edit distance ≤ 2 on slugs handles umlaut/typo cases. Embeddings would require a model, network round-trip, and non-determinism — none acceptable for a lookup that must be testable and instant.
- **Storing `dokumente_raw` in the DB.** Parse it to structured rows. The raw markdown is a source artifact, not runtime data.
- **Calling Claude at request time.** Lookup must be synchronous and < 50 ms. All Claude work happens at seed time.
- **Regex-parsing the markdown in TS.** The markdown is inconsistent across 16 states (bullet vs heading vs nested list). Claude handles the variability cheaply. Regex parsing would become 400 lines of brittle code.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown → structured rows | Custom regex parser over `dokumente_raw` | Claude Sonnet with Zod-validated output | 16 states × inconsistent markdown structure × bilingual notes = brittle regex. Claude at ~$0.02 per state is a one-time $0.30 spend. |
| Levenshtein distance | Hand-rolled DP | `fastest-levenshtein` 1.0.16 | 2 kB, MIT, tested, faster than alternatives. Single function. |
| Slugification of German strings | Hand-rolled umlaut replacement | Small local util (`slug.ts`) with explicit ä→ae, ö→oe, ü→ue, ß→ss, then `/[^a-z0-9]+/g → '-'` | Don't pull `slugify` (4 kB + locale pack). 10-line function fits project. |
| City → Regierungsbezirk | Scraping Wikipedia at runtime | Inline hardcoded const map in `city-to-regierungsbezirk.ts` | ~120 entries, changes once a decade, 100% deterministic. |
| Form state + validation | Custom controlled form | `react-hook-form` is NOT installed — since CONTEXT doesn't add it, use plain controlled `useState` + Zod `safeParse` on submit. shadcn `form` is vendored but requires `react-hook-form`; simpler not to add it in this phase. |
| PDF preview | Re-implement iframe | Reuse Phase 2 `PdfPreview.tsx` verbatim | Already owns ownership check + fallback |

**Key insight:** This phase is a **plumbing phase**, not an innovation phase. Every problem has a library or an existing component. The only nontrivial code is the Claude parse prompt and the resolver's matching logic.

## Runtime State Inventory

> This phase is partly a migration (adds schema, seed script) but does not rename or move existing data.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | No existing Behörden tables — this phase is the first to create them. `document` table exists but no `review_status` column yet. | Drizzle migration adds 4 new tables + `document_review` + `document.review_status` column. Seed populates Behörden tables. |
| Live service config | None — no external services tied to this phase. | None. |
| OS-registered state | None. | None. |
| Secrets/env vars | `ANTHROPIC_API_KEY` already in use from Phase 2 (`lib/extraction/claude.ts`). Seed script reuses it. No new secrets. | None — verified `process.env.ANTHROPIC_API_KEY` is read by existing client. |
| Build artifacts | None — TypeScript-only project, no generated binaries. | None. |

**Nothing found in most categories:** Verified by grep of `db/schema.ts` (no behoerden_* tables present) and `lib/` (no `behoerden` directory present).

## Common Pitfalls

### Pitfall 1: Claude response not valid JSON
**What goes wrong:** Claude wraps JSON in ```json fences or adds prose.
**Why it happens:** Default completion style.
**How to avoid:** Use the same `<result>...</result>` convention as `lib/extraction/prompt.ts` and reuse `parseExtractionResponse` pattern. Validate with Zod. On parse fail, log + throw; the seed script is interactive and can be re-run.
**Warning signs:** `JSON.parse` throws in a loop — log the raw response and the state name to aid debugging.

### Pitfall 2: Slug collisions across states
**What goes wrong:** Two states both have "Geburtsurkunde" but the slug must point to ONE `behoerden_document_type` row. Then authority rows link to it with a foreign key.
**Why it happens:** Document types are global (same slug for all 16 states); authority rows provide the per-state mapping.
**How to avoid:** `behoerden_document_type` is a global lookup table. Seed aggregates unique slugs across all states before insert. `behoerden_authority.document_type_id` references the global table.
**Warning signs:** Drizzle unique-constraint violation on document_type slug during second state's insert — means you're inserting per-state instead of globally.

### Pitfall 3: Committing `data/behoerden-parsed.json` vs gitignoring it
**Tradeoff:**
- **Commit:** Deterministic CI builds, zero API cost on fresh clones, but 200-400 kB in the repo that will drift if `behoerden_db.json` changes.
- **Gitignore:** Every fresh clone hits Claude (~$0.30) unless manually seeded.
**Recommendation:** **Commit it.** The file is human-reviewable JSON, drift is detectable in PR review, and the cost-free build pathway is worth the 400 kB.

### Pitfall 4: Regierungsbezirk routing with Berlin-Brandenburg authorities
**What goes wrong:** Some Brandenburg authorities are in Berlin; some documents from smaller cities don't appear in any Regierungsbezirk map.
**Why it happens:** Brandenburg officially had Regierungsbezirke abolished in 1993 but the JSON flags `hat_regierungsbezirke: true` — treat this as data truth, don't second-guess.
**How to avoid:** If `hat_regierungsbezirke=true` but city isn't in the map, return `ambiguous` with all matching authorities for (state + doc_type, any regierungsbezirk). Operator picks one.
**Warning signs:** Unit test for "unknown Brandenburg city" must assert `ambiguous`, not `not_found`.

### Pitfall 5: `[PRÜFEN]` markers eaten by parse
**What goes wrong:** Claude drops the `[PRÜFEN]` marker during markdown → JSON conversion, so `needs_review` stays false.
**Why it happens:** Model interprets it as editorial annotation and strips.
**How to avoid:** The parse prompt MUST explicitly tell Claude to output `needs_review: true` whenever it sees `[PRÜFEN]` or `[PRUEFEN]` or "prüfen" in an entry. **Measured:** 24 PRÜFEN tokens across 3 states (Bayern:20, Mecklenburg-Vorpommern:1, Niedersachsen:2, Thüringen:1). Add an assertion in the seed: after parsing, count `needs_review=true` authorities, log the count, expect ≥24 (sanity guard).
**Warning signs:** `needs_review` count is 0 after parse — regression.

### Pitfall 6: Fuzzy match false positives
**What goes wrong:** User types "Geburturkunde" (missing s) → distance 1 → matches "Geburtsurkunde" ✓. But "Heiratsurkunde" also distance 4 from "Geburtsurkunde" → false positive if threshold too loose.
**How to avoid:** Threshold = **min(2, floor(shorter.length / 4))**. Never accept a match where edit distance > 2 AND > 25% of shorter string length. If multiple slugs tie at the same distance, return `ambiguous`.

### Pitfall 7: Turbopack + Node-only imports in seed script
**What goes wrong:** `scripts/seed-behoerden.ts` imports `@/db` which includes `better-sqlite3` (native). If run via Next's compiler, it breaks.
**How to avoid:** Run the script with `tsx` directly (same as `scripts/seed-user.ts`). Add `"seed:behoerden": "tsx scripts/seed-behoerden.ts"` to `package.json`. Do NOT use `next-env` or server-action machinery.

## Code Examples

### §A: Drizzle schema additions (to append to `db/schema.ts`)

```ts
// ======== Phase 3: Behörden + Document Review ========

export const LOOKUP_STATUS = ["matched", "ambiguous", "not_found"] as const;
export type LookupStatus = (typeof LOOKUP_STATUS)[number];

export const REVIEW_STATUS = ["pending", "approved"] as const;
export type ReviewStatus = (typeof REVIEW_STATUS)[number];

export const behoerdenState = sqliteTable("behoerden_state", {
  id: text("id").primaryKey(),                    // slug: "bayern"
  name: text("name").notNull(),                   // "Bayern"
  hatRegierungsbezirke: integer("hat_regierungsbezirke", { mode: "boolean" })
    .notNull()
    .default(false),
  besonderheiten: text("besonderheiten"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
});

export const behoerdenRegierungsbezirk = sqliteTable(
  "behoerden_regierungsbezirk",
  {
    id: text("id").primaryKey(),                  // "bayern-oberbayern"
    stateId: text("state_id")
      .notNull()
      .references(() => behoerdenState.id, { onDelete: "cascade" }),
    name: text("name").notNull(),                 // "Oberbayern"
    slug: text("slug").notNull(),                 // "oberbayern"
  },
  (t) => [
    uniqueIndex("rbz_state_slug_uniq").on(t.stateId, t.slug),
    index("rbz_state_idx").on(t.stateId),
  ],
);

export const behoerdenDocumentType = sqliteTable("behoerden_document_type", {
  id: text("id").primaryKey(),                    // "approbationsurkunde"
  displayName: text("display_name").notNull(),    // "Approbationsurkunde"
});

export const behoerdenAuthority = sqliteTable(
  "behoerden_authority",
  {
    id: text("id").primaryKey(),
    stateId: text("state_id")
      .notNull()
      .references(() => behoerdenState.id, { onDelete: "cascade" }),
    regierungsbezirkId: text("regierungsbezirk_id").references(
      () => behoerdenRegierungsbezirk.id,
      { onDelete: "set null" },
    ),
    documentTypeId: text("document_type_id")
      .notNull()
      .references(() => behoerdenDocumentType.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    address: text("address").notNull(),
    phone: text("phone"),
    email: text("email"),
    website: text("website"),
    officeHours: text("office_hours"),
    notes: text("notes"),
    specialRules: text("special_rules"),
    needsReview: integer("needs_review", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (t) => [
    index("authority_lookup_idx").on(t.stateId, t.documentTypeId, t.regierungsbezirkId),
    index("authority_state_idx").on(t.stateId),
  ],
);

export const documentReview = sqliteTable(
  "document_review",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => document.id, { onDelete: "cascade" }),
    approvedByUserId: text("approved_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    approvedAt: integer("approved_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    correctedFields: text("corrected_fields", { mode: "json" })
      .$type<Record<string, string>>()
      .notNull(),
    resolvedAuthorityId: text("resolved_authority_id").references(
      () => behoerdenAuthority.id,
      { onDelete: "set null" },
    ),
    lookupStatus: text("lookup_status", { enum: LOOKUP_STATUS }).notNull(),
  },
  (t) => [
    index("doc_review_doc_idx").on(t.documentId),
    check(
      "doc_review_status_ck",
      sql`${t.lookupStatus} IN ('matched','ambiguous','not_found')`,
    ),
  ],
);
```

**Required ALTER on existing `document` table:**

```ts
// add to document columns:
reviewStatus: text("review_status", { enum: REVIEW_STATUS })
  .notNull()
  .default("pending"),
reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
```

### §B: Claude parse prompt (for seed script)

```ts
// scripts/parse-state-with-claude.ts
export const STATE_PARSE_PROMPT = `Du bekommst einen Markdown-Text, der für EIN deutsches Bundesland die zuständigen Behörden für die Vorbeglaubigung von Dokumenten beschreibt. Extrahiere jeden Behörden-Eintrag als strukturiertes JSON.

**Ausgabeformat (nur JSON, keine Prosa):**

<result>
{
  "state_slug": "bayern",
  "state_name": "Bayern",
  "hat_regierungsbezirke": true,
  "besonderheiten": "…kurz…",
  "regierungsbezirke": ["Oberbayern", "Niederbayern", …],
  "authorities": [
    {
      "document_type_display": "Approbationsurkunde",
      "document_type_slug": "approbationsurkunde",
      "regierungsbezirk": null,
      "name": "Regierungspräsidium Stuttgart, Referat 95 …",
      "address": "Ruppmannstraße 21, 70565 Stuttgart",
      "phone": null,
      "email": null,
      "website": "https://rp.baden-wuerttemberg.de/…",
      "office_hours": null,
      "notes": "Antrag ausschließlich auf dem Postweg einreichen; Bearbeitung 5-6 Wochen.",
      "special_rules": null,
      "needs_review": false
    }
  ]
}
</result>

**Regeln:**
1. Gib NUR das JSON zwischen <result>-Tags aus, keine weiteren Kommentare.
2. \`document_type_slug\`: lowercase, Umlaute ä→ae ö→oe ü→ue ß→ss, nur a-z 0-9 und Bindestriche. Beispiele: "Führungszeugnis" → "fuehrungszeugnis", "Heirats­urkunde" → "heiratsurkunde".
3. Wenn ein Dokumententyp mehrere Behörden pro Regierungsbezirk hat: erzeuge je EINEN Eintrag pro Regierungsbezirk.
4. \`regierungsbezirk\`: String (z.B. "Oberbayern") wenn der Bundesland Regierungsbezirke hat UND der Eintrag einem zugeordnet ist; sonst null.
5. \`needs_review\`: true falls der Quelltext \`[PRÜFEN]\`, \`[PRUEFEN]\`, oder den Text "bitte prüfen" für diesen Eintrag enthält.
6. \`special_rules\`: kurze deutsche Zusammenfassung von Ausnahmen (z.B. "Führungszeugnis: keine Vorbeglaubigung — direkt zur Apostille durch BfAA"; "Reisepass: keine Legalisation erforderlich"). Null falls keine.
7. \`notes\`: allgemeine Hinweise aus dem Text (Postweg, Gebühren, Bearbeitungszeit).
8. \`phone\`, \`email\`, \`office_hours\`, \`website\`: nur ausfüllen wenn im Quelltext explizit genannt.
9. Wenn ein Dokumententyp explizit als "nicht legalisierbar" / "keine Vorbeglaubigung" markiert ist (z.B. Reisepass), erzeuge dennoch einen Eintrag mit name="—" und special_rules="…". Das UI zeigt die Sonderregel an.
10. \`state_slug\` mit gleicher Umlaut-Regel: "Baden-Württemberg" → "baden-wuerttemberg".

**Markdown-Input:**

<input>
{{DOKUMENTE_RAW}}
</input>`;

// Zod validation on output (reuse parseExtractionResponse pattern):
import { z } from "zod";

export const AuthorityOutput = z.object({
  document_type_display: z.string().min(1),
  document_type_slug: z.string().regex(/^[a-z0-9-]+$/),
  regierungsbezirk: z.string().nullable(),
  name: z.string().min(1),
  address: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  website: z.string().nullable(),
  office_hours: z.string().nullable(),
  notes: z.string().nullable(),
  special_rules: z.string().nullable(),
  needs_review: z.boolean(),
});

export const StateParseOutput = z.object({
  state_slug: z.string().regex(/^[a-z0-9-]+$/),
  state_name: z.string().min(1),
  hat_regierungsbezirke: z.boolean(),
  besonderheiten: z.string().nullable(),
  regierungsbezirke: z.array(z.string()),
  authorities: z.array(AuthorityOutput).min(1),
});
export type StateParseOutputT = z.infer<typeof StateParseOutput>;
```

**Claude call (reusing existing client pattern):**

```ts
const msg = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 4096, // some states (NRW 18 kB, Hessen 15 kB) need headroom
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: STATE_PARSE_PROMPT.replace("{{DOKUMENTE_RAW}}", raw) },
      ],
    },
  ],
});
```

### §C: Review form (client component sketch)

```tsx
"use client";
import { useState, useTransition } from "react";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { approveAndResolve } from "./actions";

type Props = {
  documentId: string;
  original: Record<FieldName, { value: string; confidence: Confidence }>;
  docTypes: { id: string; displayName: string }[];
  states: { id: string; name: string }[];
};

export function ReviewForm({ documentId, original, docTypes, states }: Props) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      Object.entries(original).map(([k, v]) => [k, v.value ?? ""]),
    ) as Record<FieldName, string>,
  );
  const [pending, start] = useTransition();
  const isDirty = (k: FieldName) => values[k] !== (original[k].value ?? "");

  return (
    <form action={(fd) => start(async () => { await approveAndResolve(fd); })}>
      <input type="hidden" name="documentId" value={documentId} />
      {/* Render FieldRow for each of 6 fields. Accent left-border when isDirty(k). */}
      {/* ... */}
      <Button type="submit" disabled={pending}>
        {pending ? "Behörde wird ermittelt …" : "Speichern & Behörde ermitteln"}
      </Button>
    </form>
  );
}
```

### §D: Resolver (pure function)

```ts
// lib/behoerden/resolve.ts
import { and, eq, isNull } from "drizzle-orm";
import { distance } from "fastest-levenshtein";
import { behoerdenAuthority, behoerdenDocumentType, behoerdenState, behoerdenRegierungsbezirk } from "@/db/schema";
import { db } from "@/db";
import { slugify } from "./slug";
import { cityToRegierungsbezirk } from "./city-to-regierungsbezirk";

const FUZZY_MAX = 2;

export async function resolveAuthority(input: {
  dokumenten_typ: string;
  bundesland: string;
  ausstellungsort: string;
}) {
  // 1. State
  const stateSlug = slugify(input.bundesland);
  const state = await db.query.behoerdenState.findFirst({ where: eq(behoerdenState.id, stateSlug) });
  if (!state) return { status: "not_found" as const, reason: "unknown_state" as const };

  // 2. Doc type (fuzzy)
  const candidateSlug = slugify(input.dokumenten_typ);
  const allDocTypes = await db.select().from(behoerdenDocumentType);
  const scored = allDocTypes
    .map((d) => ({ d, dist: distance(candidateSlug, d.id) }))
    .sort((a, b) => a.dist - b.dist);
  const best = scored[0];
  if (!best || best.dist > Math.min(FUZZY_MAX, Math.floor(candidateSlug.length / 4))) {
    return { status: "not_found" as const, reason: "unknown_doc_type" as const };
  }
  // If tied at best.dist, flag ambiguous later if query returns multiple authorities
  const docType = best.d;

  // 3. Regierungsbezirk (if state requires it)
  let rbzId: string | null = null;
  if (state.hatRegierungsbezirke) {
    const rbzName = cityToRegierungsbezirk(input.ausstellungsort, state.id);
    if (rbzName) {
      const rbzSlug = slugify(rbzName);
      const rbz = await db.query.behoerdenRegierungsbezirk.findFirst({
        where: and(eq(behoerdenRegierungsbezirk.stateId, state.id), eq(behoerdenRegierungsbezirk.slug, rbzSlug)),
      });
      rbzId = rbz?.id ?? null;
    }
  }

  // 4. Query authorities
  const authorities = await db
    .select()
    .from(behoerdenAuthority)
    .where(and(
      eq(behoerdenAuthority.stateId, state.id),
      eq(behoerdenAuthority.documentTypeId, docType.id),
      rbzId ? eq(behoerdenAuthority.regierungsbezirkId, rbzId) : isNull(behoerdenAuthority.regierungsbezirkId),
    ));

  if (authorities.length === 0) {
    // Fall back to state-level (any regierungsbezirk) — signals ambiguous to operator
    const anyMatch = await db.select().from(behoerdenAuthority).where(and(
      eq(behoerdenAuthority.stateId, state.id),
      eq(behoerdenAuthority.documentTypeId, docType.id),
    ));
    if (anyMatch.length === 0) {
      return { status: "not_found" as const, reason: "no_authority_for_combination" as const };
    }
    return {
      status: "ambiguous" as const,
      candidates: anyMatch,
      routing_path: [state.name, "?", docType.displayName],
    };
  }

  if (authorities.length === 1) {
    const a = authorities[0];
    return {
      status: "matched" as const,
      authority: a,
      routing_path: [state.name, rbzId ? cityToRegierungsbezirk(input.ausstellungsort, state.id) ?? "—" : "—", docType.displayName].filter((x) => x !== "—"),
      special_rules: a.specialRules,
      needs_review: a.needsReview,
    };
  }

  return { status: "ambiguous" as const, candidates: authorities, routing_path: [state.name, docType.displayName] };
}
```

### §E: City → Regierungsbezirk map (skeleton — full list ~120 entries)

```ts
// lib/behoerden/city-to-regierungsbezirk.ts
// Sources (HIGH confidence — official German government / Wikipedia Regierungsbezirk lists):
//   Bayern: https://de.wikipedia.org/wiki/Regierungsbezirk#Bayern (7 RBz)
//   Baden-Württemberg: 4 RBz (Freiburg, Karlsruhe, Stuttgart, Tübingen)
//   Hessen: 3 RBz (Darmstadt, Gießen, Kassel)
//   NRW: 5 RBz (Arnsberg, Detmold, Düsseldorf, Köln, Münster)

type Map = Record<string, Record<string, string>>;

export const CITY_TO_REGIERUNGSBEZIRK: Map = {
  bayern: {
    // Oberbayern
    "münchen": "Oberbayern", "ingolstadt": "Oberbayern", "rosenheim": "Oberbayern",
    "freising": "Oberbayern", "erding": "Oberbayern", "garmisch-partenkirchen": "Oberbayern",
    // Niederbayern
    "landshut": "Niederbayern", "passau": "Niederbayern", "straubing": "Niederbayern",
    "deggendorf": "Niederbayern",
    // Oberpfalz
    "regensburg": "Oberpfalz", "amberg": "Oberpfalz", "weiden": "Oberpfalz",
    // Oberfranken
    "bayreuth": "Oberfranken", "bamberg": "Oberfranken", "coburg": "Oberfranken", "hof": "Oberfranken",
    // Mittelfranken
    "nürnberg": "Mittelfranken", "nuernberg": "Mittelfranken", "erlangen": "Mittelfranken",
    "fürth": "Mittelfranken", "fuerth": "Mittelfranken", "ansbach": "Mittelfranken",
    // Unterfranken
    "würzburg": "Unterfranken", "wuerzburg": "Unterfranken", "aschaffenburg": "Unterfranken",
    "schweinfurt": "Unterfranken",
    // Schwaben
    "augsburg": "Schwaben", "kempten": "Schwaben", "memmingen": "Schwaben", "kaufbeuren": "Schwaben",
  },
  "baden-wuerttemberg": {
    "stuttgart": "Stuttgart", "heilbronn": "Stuttgart", "ludwigsburg": "Stuttgart", "esslingen": "Stuttgart",
    "karlsruhe": "Karlsruhe", "mannheim": "Karlsruhe", "heidelberg": "Karlsruhe", "pforzheim": "Karlsruhe", "baden-baden": "Karlsruhe",
    "freiburg": "Freiburg", "offenburg": "Freiburg", "konstanz": "Freiburg", "lörrach": "Freiburg", "loerrach": "Freiburg",
    "tübingen": "Tübingen", "tuebingen": "Tübingen", "reutlingen": "Tübingen", "ulm": "Tübingen", "friedrichshafen": "Tübingen",
  },
  hessen: {
    "frankfurt": "Darmstadt", "darmstadt": "Darmstadt", "offenbach": "Darmstadt", "wiesbaden": "Darmstadt",
    "gießen": "Gießen", "giessen": "Gießen", "marburg": "Gießen", "wetzlar": "Gießen",
    "kassel": "Kassel", "fulda": "Kassel",
  },
  "nordrhein-westfalen": {
    "düsseldorf": "Düsseldorf", "duesseldorf": "Düsseldorf", "duisburg": "Düsseldorf", "essen": "Düsseldorf", "mönchengladbach": "Düsseldorf", "moenchengladbach": "Düsseldorf", "wuppertal": "Düsseldorf", "solingen": "Düsseldorf", "krefeld": "Düsseldorf",
    "köln": "Köln", "koeln": "Köln", "bonn": "Köln", "leverkusen": "Köln", "aachen": "Köln",
    "münster": "Münster", "muenster": "Münster", "bottrop": "Münster", "gelsenkirchen": "Münster",
    "detmold": "Detmold", "bielefeld": "Detmold", "paderborn": "Detmold",
    "arnsberg": "Arnsberg", "dortmund": "Arnsberg", "hagen": "Arnsberg", "bochum": "Arnsberg", "siegen": "Arnsberg",
  },
};

export function cityToRegierungsbezirk(city: string, stateSlug: string): string | null {
  const normalized = city.trim().toLowerCase();
  return CITY_TO_REGIERUNGSBEZIRK[stateSlug]?.[normalized] ?? null;
}
```

The full list should round out each state to ~30 cities. Unknown cities → resolver returns `ambiguous` (Pitfall 4).

### §F: Slugify (project-local, no dep)

```ts
// lib/behoerden/slug.ts
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `next-auth` Credentials provider | `better-auth` email+password | 2025-09 (Auth.js team joined Better Auth) | Already in use — confirms stack direction |
| Prisma for typed SQL | Drizzle ORM | 2024-2025 | Drizzle is now default for lightweight projects; already in use |
| `fuse.js` for fuzzy | `fastest-levenshtein` when task is 1-field edit distance | N/A | Fuse is overkill here |
| Regex markdown parsing | LLM-assisted structured extraction (Claude + Zod) | 2024-2025 | Matches Phase 2 approach |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Each `dokumente_raw` markdown parses in one Claude call within 4096 output tokens | Pattern 1 / §B | Low — NRW is the largest at 18 kB input. If Claude truncates, split NRW and Hessen into 2 chunks by heading. |
| A2 | Committing `data/behoerden-parsed.json` to git is acceptable to the operator | Pitfall 3 | Low — operator decides. Default recommendation is commit. |
| A3 | ~120 cities covers the vast majority of uploaded documents for BY/BW/HE/NRW | §E | Medium — unknown cities gracefully degrade to `ambiguous`, not a crash. Operator can expand over time. |
| A4 | Fuzzy-match threshold of min(2, floor(len/4)) is appropriate for German doc types | Pitfall 6 | Medium — thresholds are tunable; surface via unit tests. |
| A5 | Claude's German parsing reliably extracts address + contact fields from markdown tables and bullet lists | §B | Low-Medium — Zod will catch malformed output and abort the seed. Operator can fix markdown and re-run. |
| A6 | Führungszeugnis + Reisepass exceptions appear in the source markdown in a way Claude can classify | Rule 6 of §B | Medium — if Claude misses them, operator can manually edit `data/behoerden-parsed.json` and re-insert. |

## Open Questions

1. **Should `data/behoerden-parsed.json` be committed?**
   - What we know: File is ~300-400 kB JSON, human-reviewable.
   - What's unclear: Team preference.
   - Recommendation: Commit. Discuss in plan-check if operator disagrees.

2. **Does `document.review_status` need a CHECK constraint?**
   - What we know: Existing columns use CHECK constraints (e.g., `extraction_status`).
   - What's unclear: Consistency is preferable.
   - Recommendation: Add one for symmetry: `${t.reviewStatus} IN ('pending','approved')`.

3. **Should ambiguous results allow the operator to pick without re-running the lookup?**
   - What we know: UI spec D-16 shows candidate list with "Diese Behörde übernehmen" CTA.
   - What's unclear: Whether picking updates the existing `document_review` row or creates a new one.
   - Recommendation: Update the existing row, change `lookup_status` from `ambiguous` → `matched`, set `resolved_authority_id`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@anthropic-ai/sdk` | Seed-time markdown parse | ✓ | 0.88.0 | — |
| `ANTHROPIC_API_KEY` env var | Seed Claude calls | ✓ (Phase 2 uses it) | — | Seed exits with clear error if missing |
| `better-sqlite3` | DB insert during seed | ✓ | 12.9.0 | — |
| `fastest-levenshtein` | Fuzzy slug match | ✗ | — | `pnpm add fastest-levenshtein` (new) |
| shadcn `select` | Review form dropdowns | ✗ | — | `pnpm dlx shadcn@latest add select` |
| `tsx` (for seed script) | Running seed | ✓ (Phase 1 seed uses it) | — | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with simple install:** `fastest-levenshtein`, shadcn `select`. Both install cleanly.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.4 + happy-dom (from `vitest.config.ts`) |
| Config file | `/vitest.config.ts` (HIGH confidence — verified) |
| Quick run command | `npm test -- lib/behoerden` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| REVW-01 | Review page renders PDF + form | integration (happy-dom) | `npm test -- __tests__/review/page.test.tsx -x` | ❌ Wave 0 |
| REVW-02 | Each field editable; accent border on dirty | unit (happy-dom) | `npm test -- _components/ReviewForm.test.tsx -x` | ❌ Wave 0 |
| REVW-03 | Dropdowns populated from DB fixtures | unit | `npm test -- _components/FieldRow.test.tsx -x` | ❌ Wave 0 |
| REVW-04 | Approve Server Action persists review + calls resolver | integration (node env) | `npm test -- lib/review/actions.test.ts -x` | ❌ Wave 0 |
| LKUP-01 | Resolver matches (doc_type + state) | unit | `npm test -- lib/behoerden/resolve.test.ts -x` | ❌ Wave 0 |
| LKUP-02 | Regierungsbezirk routing for BY/BW/HE/NRW | unit (table-driven) | same file | ❌ Wave 0 |
| LKUP-03 | Führungszeugnis / Reisepass special_rules surfaced | unit | `npm test -- lib/behoerden/resolve.test.ts::special_rules -x` | ❌ Wave 0 |
| LKUP-04 | Authority detail contains all 6 fields | integration (node) | `npm test -- __tests__/phase3-integration.test.ts -x` | ❌ Wave 0 |
| — | Seed idempotency (second run is no-op unless `--force`) | unit | `npm test -- scripts/seed-behoerden.test.ts -x` | ❌ Wave 0 |
| — | Slug collision prevention | unit | `npm test -- lib/behoerden/slug.test.ts -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- lib/behoerden` (fast — all resolver/slug unit tests) + `npm test -- __tests__/review` when touching UI
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green + `npm run lint` + `tsc --noEmit`

### Wave 0 Gaps

- [ ] `lib/behoerden/resolve.test.ts` — covers LKUP-01, LKUP-02, LKUP-03 via synthetic fixture DB
- [ ] `lib/behoerden/slug.test.ts` — umlaut cases, ß, trailing dashes, fuzzy threshold
- [ ] `__tests__/review/page.test.tsx` — renders form for done status, redirects otherwise (REVW-01)
- [ ] `app/(app)/documents/[id]/review/_components/ReviewForm.test.tsx` — dirty state, submit disables button, Zod error surfaces (REVW-02, REVW-03)
- [ ] `lib/review/actions.test.ts` — auth check, ownership check, persists `document_review` row (REVW-04)
- [ ] `__tests__/phase3-integration.test.ts` — end-to-end: seed → extract → approve → resolve → row present with correct join (LKUP-04)
- [ ] `scripts/seed-behoerden.test.ts` — second run is no-op; `--force` re-parses; PRÜFEN count ≥24 (Pitfall 5)
- [ ] Test fixture: `__tests__/fixtures/behoerden-mini.json` — 3 states (1 with RBz, 2 without), 5 doc types, ~10 authorities, used by resolver tests to avoid depending on full seed

## Security Domain

Phase 3 security is a thin extension of Phase 2. No net-new attack surfaces except Server Action input.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | better-auth `getSession` inside Server Action (D-19) |
| V3 Session Management | yes | Inherited from Phase 1 |
| V4 Access Control | yes | Ownership check: `document.user_id === session.user.id` before allowing review |
| V5 Input Validation | yes | Zod schema on all 6 corrected fields; length caps per field (D-20) |
| V6 Cryptography | no | No crypto introduced |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| User approves a document they don't own | Elevation of Privilege | `eq(document.userId, session.user.id)` predicate before mutation — verified pattern in Phase 2 `lib/documents/queries.ts` |
| XSS via `name`/`notes`/`special_rules` fields in authority display | Injection | React auto-escapes; render as text only; links use `rel="noopener noreferrer"` per UI spec |
| SQL injection via `ausstellungsort` string | Injection / Tampering | Drizzle parameterizes all bindings; no raw SQL concatenation anywhere in resolver |
| Seed script exfiltrates DB to Claude | Info Disclosure | Seed only sends `dokumente_raw` (public-ish data) to Claude, never user data or secrets |
| Over-long field input (DoS) | DoS | Zod `.max(200)/.max(300)` caps — Server Action short-circuits before reaching resolver |
| Prompt injection in `dokumente_raw` | Tampering | Risk is low because the source JSON is a vetted internal artifact committed to repo. If trust model changes in the future, add an allowlist-based post-parse validator. |

## Sources

### Primary (HIGH confidence)

- `/Users/.../behoerden_db.json` — structure measured via `node -e` (16 states; sizes 3.6-18 kB; PRÜFEN count = 24)
- `/db/schema.ts` — existing Drizzle patterns (uniqueIndex, check constraints, text enums)
- `/lib/extraction/claude.ts` — Anthropic SDK usage pattern, model ID `claude-sonnet-4-20250514`
- `/lib/extraction/schema.ts` — Zod + `<result>`-tag parsing convention
- `/vitest.config.ts` — test framework confirmed (vitest 4.1 + happy-dom)
- `/package.json` — stack versions verified
- `npm view fastest-levenshtein version` → 1.0.16 (verified 2026-04-17)
- `npm view fuse.js version` → 7.3.0 (verified 2026-04-17)
- `npm view leven version` → 4.1.0 (verified 2026-04-17)
- `npm view closest-match version` → 1.3.3 (verified 2026-04-17)
- CLAUDE.md stack directives (Next.js 16.2, Drizzle 0.45.2, Zod 4.3.6, Anthropic SDK 0.88.0, better-sqlite3 12.9.0)

### Secondary (MEDIUM confidence)

- Regierungsbezirk taxonomy for BY/BW/HE/NRW — well-documented via Wikipedia / official gov sources (CITED, not live-fetched this session)

### Tertiary (LOW confidence)

- Exact token counts for Claude parse — estimated via chars/3.5; may need `max_tokens: 4096` buffer (flagged in A1)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against `package.json` + live `npm view`
- Architecture: HIGH — pure resolver + Server Action wrapper is the established Phase 2 pattern
- Pitfalls: MEDIUM-HIGH — Pitfalls 1, 2, 5, 7 are verified from direct codebase reading; 3, 4, 6 are reasoned
- City mapping: MEDIUM — skeleton provided, full expansion required during implementation

**Research date:** 2026-04-17
**Valid until:** 2026-05-17 (30 days — stack is stable; re-verify if phase not started by then)
