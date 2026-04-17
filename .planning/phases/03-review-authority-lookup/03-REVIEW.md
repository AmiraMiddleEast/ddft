---
phase: 03-review-authority-lookup
reviewed: 2026-04-17T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - lib/behoerden/slug.ts
  - lib/behoerden/city-to-regierungsbezirk.ts
  - lib/behoerden/queries.ts
  - lib/behoerden/resolve.ts
  - lib/review/actions.ts
  - lib/validations/review.ts
  - scripts/seed-behoerden.ts
  - scripts/parse-state-with-claude.ts
  - app/(app)/documents/[id]/review/page.tsx
  - app/(app)/documents/[id]/review/_components/ReviewForm.tsx
  - app/(app)/documents/[id]/review/_components/FieldRow.tsx
  - app/(app)/documents/[id]/review/_components/AuthorityResultPanel.tsx
  - app/(app)/documents/[id]/review/_components/DiscardDialog.tsx
  - app/(app)/documents/[id]/_components/ReviewLinkButton.tsx
  - db/schema.ts
findings:
  critical: 3
  warning: 5
  info: 3
  total: 11
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-04-17
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Phase 3 implements the review form, authority resolver, Behörden seed pipeline, and supporting Server Actions. The overall architecture is sound: ownership checks exist on both Server Actions, all Drizzle queries use parameterised builders (no raw SQL injection risk), and the resolver's logic is clear. Three areas need attention before shipping: an unhandled throw from the synchronous SQLite transaction, prompt injection from raw markdown inserted into the Claude seed prompt, and a missing unique constraint that allows duplicate `document_review` rows under concurrent submission.

---

## Critical Issues

### CR-01: Unhandled throw from synchronous transaction in `approveAndResolve`

**File:** `lib/review/actions.ts:97-137`

**Issue:** The `db.transaction()` call at line 97 sits outside any `try/catch`. If the synchronous callback throws (SQLite constraint violation, schema mismatch, etc.) the exception propagates uncaught from the `async` Server Action. Next.js will surface this as an unhandled server error rather than the expected `{ ok: false, error: "..." }` shape. The same problem exists in `chooseAmbiguousAuthority` at lines 199-209. The pattern comment in the file header acknowledges the sync constraint but does not address error containment.

**Fix:**
```typescript
// Wrap both db.transaction() calls:
try {
  db.transaction((tx) => {
    // ... existing body unchanged
  });
} catch (err) {
  console.error("[approveAndResolve] transaction failed:", err);
  return { ok: false, error: "db_error" };
}
```
Apply the same wrapper around the `chooseAmbiguousAuthority` transaction at line 199.

---

### CR-02: Prompt injection via raw markdown in seed Claude prompt

**File:** `scripts/parse-state-with-claude.ts:134-148`

**Issue:** `raw` (the full markdown string from `behoerden_db.json`) is inserted verbatim into the prompt template at line 143 via `STATE_PARSE_PROMPT.replace("{{DOKUMENTE_RAW}}", raw)`. The only structural isolation is the XML-like `<input>...</input>` tag in the prompt. Any `behoerden_db.json` entry whose `dokumente_raw` value contains the literal string `</input>` followed by attacker-controlled text exits the data boundary and can inject arbitrary instructions into the Claude system prompt context. Because `behoerden_db.json` is maintained manually and may be updated without going through code review, this is a plausible vector. In the worst case it can cause the seed to write malformed or fabricated authority records into the database.

**Fix:** Sanitize the raw string before interpolation by stripping or escaping the closing tag:
```typescript
const safeRaw = raw.replace(/<\/input>/gi, "[/input]");
const promptText = STATE_PARSE_PROMPT.replace("{{DOKUMENTE_RAW}}", safeRaw);
```
Additionally, the Zod validation in `StateParseOutput` acts as a second line of defense — it will reject structurally invalid output — but it cannot prevent injected instructions that produce valid-looking JSON with fabricated authority data.

---

### CR-03: TOCTOU race allows duplicate `document_review` rows

**File:** `lib/review/actions.ts:97-137`, `db/schema.ts:321-350`

**Issue:** The upsert in `approveAndResolve` is a read-then-write within the transaction: it selects existing rows (line 99) then branches on `existing.length > 0` (line 104). However, `document_review` has no `UNIQUE` constraint on `documentId` (confirmed in `db/schema.ts` at lines 321-350 — only a plain `index`, not `uniqueIndex`). If two submissions arrive simultaneously, both transactions can read `existing.length === 0` and both insert a new row. The result is two `document_review` rows for the same document, which breaks downstream logic that reads with `.limit(1)` in `chooseAmbiguousAuthority` (line 181) — it would silently target whichever row SQLite returns first.

**Fix:** Add a `uniqueIndex` to the schema and rely on `INSERT OR REPLACE` semantics (or Drizzle's `.onConflictDoUpdate`):
```typescript
// db/schema.ts — add to documentReview table constraints:
uniqueIndex("doc_review_doc_uniq").on(t.documentId),
```
Then in the action, replace the select+branch with a true upsert:
```typescript
tx.insert(documentReview)
  .values({ id: crypto.randomUUID(), documentId: ..., ... })
  .onConflictDoUpdate({
    target: documentReview.documentId,
    set: { approvedByUserId: ..., approvedAt: ..., correctedFields: ..., resolvedAuthorityId: ..., lookupStatus: ... },
  })
  .run();
```

---

## Warnings

### WR-01: `chooseAmbiguousAuthority` accepts any authority ID — no scope check

**File:** `lib/review/actions.ts:190-196`

**Issue:** After verifying document ownership (line 169-178), the action fetches the authority by `authorityId` from the full `behoerdenAuthority` table with no constraint binding it to the document's resolved state or document type. An operator could pass the ID of any authority in the database and it would be accepted and persisted as the resolved authority for that document, regardless of whether that authority is a valid candidate for the document's Bundesland/Dokumenttyp combination.

In a single-user internal tool this is low severity in practice, but it breaks correctness — the final Laufliste would reference the wrong authority.

**Fix:** Cross-check the chosen authority against the candidates list that was computed during `approveAndResolve`. The simplest approach is to verify the authority belongs to the same `stateId` and `documentTypeId` that are stored in `correctedFields` of the existing review row:
```typescript
// After fetching `review` and `chosen`:
const parsedFields = CorrectedFieldsSchema.safeParse(review.correctedFields);
if (!parsedFields.success) return { ok: false, error: "invalid_choice" };
const expectedStateSlug = slugify(parsedFields.data.bundesland);
if (chosen.stateId !== expectedStateSlug) {
  return { ok: false, error: "invalid_choice" };
}
```

---

### WR-02: Empty strings pass `CorrectedFieldsSchema` for required routing fields

**File:** `lib/validations/review.ts:19-31`

**Issue:** `dokumenten_typ`, `bundesland`, and `ausstellungsort` are the three fields the resolver uses to route to an authority. All three have only `.max()` constraints and no `.min(1)`. An empty string passes validation (Zod `.string()` default allows `""`). The resolver handles empty inputs gracefully by returning `not_found`, but the Server Action returns `{ ok: true, data: { status: "not_found" } }` — a success response that shows the "Keine Behörde gefunden" UI. This is confusing; the validation layer should reject empty routing-critical fields before touching the resolver.

**Fix:**
```typescript
export const CorrectedFieldsSchema = z.object({
  dokumenten_typ: z.string().min(1, "Bitte einen Dokumenttyp auswählen.").max(200),
  ausstellende_behoerde: z.string().max(300),
  ausstellungsort: z.string().min(1, "Bitte einen Ausstellungsort angeben.").max(200),
  bundesland: z.string().min(1, "Bitte ein Bundesland auswählen.").max(100),
  ausstellungsdatum: z.string().regex(...).or(z.literal("")),
  voller_name: z.string().max(300),
});
```
`ausstellende_behoerde` and `voller_name` are informational — they don't affect routing — so `.min(1)` is optional there.

---

### WR-03: `onChooseAmbiguous` has no loading state — double-click submits twice

**File:** `app/(app)/documents/[id]/review/_components/ReviewForm.tsx:163-180`

**Issue:** `onChooseAmbiguous` is a plain `async` function called directly from `onClick` in `AuthorityResultPanel`. It has no `pending` guard. A double-click (or two simultaneous presses of "Diese Behörde übernehmen") fires two concurrent calls to `chooseAmbiguousAuthority`. The second call will hit the same `review.lookupStatus === "ambiguous"` check (since both read before either writes) and both succeed, writing the resolved authority ID twice. The second write is idempotent only if both clicks chose the same authority — if different buttons are clicked in fast succession, the last-write-wins outcome is non-deterministic.

**Fix:** Lift the pending state into `ReviewForm` and disable the "Diese Behörde übernehmen" buttons during the call:
```typescript
const [choosePending, setChoosePending] = React.useState(false);

async function onChooseAmbiguous(authorityId: string) {
  if (choosePending) return;
  setChoosePending(true);
  try {
    const res = await chooseAmbiguousAuthority({ documentId, authorityId });
    // ... existing handler
  } finally {
    setChoosePending(false);
  }
}
```
Pass `choosePending` to `AuthorityResultPanel` and set `disabled={choosePending}` on the candidate buttons.

---

### WR-04: Fuzzy match threshold accepts near-matches on very short doc-type inputs

**File:** `lib/behoerden/resolve.ts:80-83`

**Issue:** The threshold formula is `Math.min(FUZZY_MAX, Math.floor(candidateSlug.length / 4))`. For a user-typed Dokumenttyp that slugifies to a short string (4-7 characters), the effective threshold is 1, meaning any document type in the database within edit-distance 1 of the input slug matches. For example, the slug `"pass"` (4 chars) has threshold 1 and would match `"bass"` or `"past"` if those existed. More practically, a typo in a short name (e.g., "Abosso" → "abosso" → dist 1 from "abbosso") could route to a wrong authority without any indication.

This is not a crash but a silent wrong-routing issue. The `needs_review` flag on the authority is the only downstream safeguard.

**Fix:** Add a minimum floor on the input length. Only allow fuzzy matching when `candidateSlug.length >= 5`:
```typescript
const threshold =
  candidateSlug.length < 5
    ? 0
    : Math.min(FUZZY_MAX, Math.floor(candidateSlug.length / 4));
```
A zero threshold for short slugs forces an exact match, preventing accidental fuzzy hits on short names.

---

### WR-05: `anyDirty` not memoized — `beforeunload` effect re-registers on every render

**File:** `app/(app)/documents/[id]/review/_components/ReviewForm.tsx:81-93`

**Issue:** `anyDirty` is a plain boolean expression computed at the module scope of the render function (line 81). It is used as a dependency of the `useEffect` on line 84. Because `anyDirty` is a primitive (boolean), its value-based comparison in the dependency array works correctly — the effect only re-runs when it flips between `true` and `false`. However, re-adding and removing the event listener on every `true`→`true` render when fields are dirty causes unnecessary work.

More importantly: `isDirty` is a `useCallback` that recreates when `[values, original]` changes. Every keystroke regenerates `isDirty`, which means `anyDirty` evaluates anew, and the `beforeunload` effect fires on every keystroke even when `anyDirty` stays `true`. This is not a correctness bug but causes observable event-listener churn.

**Fix:** Memoize `anyDirty` so the effect only re-registers when the dirty state actually changes:
```typescript
const anyDirty = React.useMemo(
  () => FIELD_NAMES.some((k) => values[k] !== original[k].value),
  [values, original],
);
```
This also lets you remove the `isDirty` `useCallback` dependency on `anyDirty` and simplifies the dependency chain.

---

## Info

### IN-01: Ambiguous authority routing column shows raw slug IDs, not display names

**File:** `app/(app)/documents/[id]/review/_components/AuthorityResultPanel.tsx:180-182`

**Issue:** In the `AmbiguousVariant` table the Routing cell renders `c.stateId` and `c.regierungsbezirkId` directly (line 180-182). These are slug IDs (e.g., `"nordrhein-westfalen"`, `"nordrhein-westfalen-arnsberg"`), not the human-readable state/RBz names. An operator sees rows like "nordrhein-westfalen › nordrhein-westfalen-arnsberg" instead of "Nordrhein-Westfalen › Arnsberg".

**Fix:** The `AuthorityRow` type (from `behoerdenAuthority.$inferSelect`) does not include the related state name or RBz display name. Either pass the candidates with joined display names from the Server Action result, or look up the name from the `states` prop (already available in `ReviewForm`) and thread it down to `AuthorityResultPanel`. A simpler stop-gap: capitalize and de-slugify the ID client-side.

---

### IN-02: Duplicate slugifier implementations — `normalizeDocTypeSlug` vs `slugify`

**File:** `scripts/parse-state-with-claude.ts:98-110`, `lib/behoerden/slug.ts:14-27`

**Issue:** There are two independent slugifier implementations. `normalizeDocTypeSlug` in `parse-state-with-claude.ts` omits the soft-hyphen strip (`\u00ad`) that `slugify` in `lib/behoerden/slug.ts` includes. German PDFs and markdown files can contain soft hyphens (common in long compound words). If `behoerden_db.json` contains soft hyphens in state names or RBz names, `normalizeDocTypeSlug` will embed them as `-` in the slug (via the `[^a-z0-9]+` rule), while `slugify` strips them first. The resulting slug IDs would not match.

**Fix:** Import and re-export the canonical `slugify` from `lib/behoerden/slug.ts` in `parse-state-with-claude.ts` instead of duplicating it:
```typescript
// scripts/parse-state-with-claude.ts
export { slugify as normalizeDocTypeSlug } from "@/lib/behoerden/slug";
```

---

### IN-03: `dokumenten_typ` Select stores `displayName` as value, not slug

**File:** `app/(app)/documents/[id]/review/_components/ReviewForm.tsx:221-227`

**Issue:** The Select for `dokumenten_typ` uses `dt.displayName` as the item `value` (line 222). The corrected field stored in the database and passed to the resolver is therefore a display name string (e.g., `"Approbationsurkunde"`), not a slug. The resolver then slugifies this value again at line 74 of `resolve.ts`. For most entries this round-trips correctly. However, if `displayName` ever diverges from what slugification produces compared to `document_type_slug` as seeded (e.g., a display name with parentheses, slashes, or extra text), the fuzzy match would need to absorb the edit distance rather than getting an exact hit.

This is low risk today but creates a fragile coupling between display name format and resolver correctness.

**Fix:** Store the slug as the Select value (`dt.id`), keep `dt.displayName` as the visible label, and pass the slug through to the resolver. The `correctedFields` JSON in the DB would then contain the slug rather than the display name, which is more canonical.

---

_Reviewed: 2026-04-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
