---
phase: quick-260626-wou
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/extraction/error-code.ts
  - lib/extraction/error-code.test.ts
  - lib/uploads/errors.ts
  - app/(app)/upload/_components/ErrorCopy.ts
  - db/schema.ts
  - lib/settings/store.ts
  - lib/validations/settings.ts
  - lib/settings/actions.ts
  - lib/extraction/claude.ts
  - lib/extraction/actions.ts
  - lib/extraction/actions.test.ts
  - app/(app)/admin/settings/page.tsx
  - app/(app)/admin/settings/SettingsForm.tsx
  - app/(app)/layout.tsx
  - app/(app)/documents/[id]/page.tsx
autonomous: true
requirements: [SET-A, SET-B]
user_setup: []

must_haves:
  truths:
    - "Operator can open /admin/settings via an 'Einstellungen' nav link"
    - "Operator can save a new Anthropic API key and Claude model from the UI without a code deploy"
    - "Saving with a blank API key field keeps the existing key (does not wipe it)"
    - "The stored key is never rendered in full — only a masked hint is shown"
    - "'Speichern & testen' returns a specific German status (gültig / no_credit / invalid_key / model_unavailable / rate_limited / other)"
    - "A changed key/model takes effect on the next extraction without restarting the server"
    - "A failed extraction shows a SPECIFIC German reason instead of the generic 'Analyse fehlgeschlagen'"
    - "When errorCode is credit or auth, the document page links to /admin/settings"
  artifacts:
    - path: "lib/extraction/error-code.ts"
      provides: "classifyAnthropicError(e) + extractionErrorMessageDe(code) shared classifier"
      exports: ["classifyAnthropicError", "extractionErrorMessageDe", "ExtractionErrorCode"]
    - path: "lib/extraction/error-code.test.ts"
      provides: "unit tests for the pure classifier"
    - path: "db/schema.ts"
      provides: "appSetting key-value table"
      contains: "appSetting"
    - path: "lib/settings/store.ts"
      provides: "getSetting/setSetting + resolveAnthropicKey/resolveClaudeModel + masking helper"
    - path: "lib/settings/actions.ts"
      provides: "saveAndTestSettingsAction Server Action"
      exports: ["saveAndTestSettingsAction"]
    - path: "app/(app)/admin/settings/page.tsx"
      provides: "Server Component settings page"
    - path: "app/(app)/admin/settings/SettingsForm.tsx"
      provides: "client form with masked key + test result"
  key_links:
    - from: "lib/extraction/claude.ts"
      to: "lib/settings/store.ts"
      via: "resolve key+model at call time (per-call client, no module cache)"
      pattern: "resolveAnthropicKey|resolveClaudeModel"
    - from: "lib/extraction/actions.ts"
      to: "lib/extraction/error-code.ts"
      via: "classifyAnthropicError(e) in catch block"
      pattern: "classifyAnthropicError"
    - from: "lib/settings/actions.ts"
      to: "lib/extraction/error-code.ts"
      via: "classifyAnthropicError on the validation call"
      pattern: "classifyAnthropicError"
    - from: "app/(app)/documents/[id]/page.tsx"
      to: "lib/extraction/error-code.ts"
      via: "extractionErrorMessageDe(doc.errorCode)"
      pattern: "extractionErrorMessageDe"
---

<objective>
Make Anthropic API failures visible and self-serviceable for the single operator.

This delivers two things:
- **A) A Settings page** under the existing admin area to configure the Anthropic API key and Claude model at runtime, with a real "Speichern & testen" validation call. A key/model change must take effect on the next extraction with NO server restart and NO code deploy.
- **B) Specific extraction error messages** — replace the generic "Analyse fehlgeschlagen" with a precise German reason (e.g. "Kein Anthropic-Guthaben — bitte unter console.anthropic.com aufladen") derived from a shared error classifier reused by both the settings test and the extraction catch block.

Purpose: The Anthropic account is currently out of credit (HTTP 400 "credit balance is too low"), but the UI only showed a generic failure so the operator could not diagnose it. This makes the reason visible and lets the operator swap the key/model from the UI.

Output: Settings page + nav link, a key-value `appSetting` table, a shared error classifier with a unit test, call-time key/model resolution in claude.ts, richer error mapping in the extraction action, and a specific failure message on the document detail page.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md

# Files to modify / mirror (conventions)
@db/schema.ts
@db/client.ts
@lib/extraction/claude.ts
@lib/extraction/actions.ts
@lib/extraction/cost.ts
@lib/uploads/errors.ts
@app/(app)/upload/_components/ErrorCopy.ts
@app/(app)/layout.tsx
@app/(app)/documents/[id]/page.tsx
@app/(app)/admin/cogs/page.tsx
@app/(app)/admin/cogs/[id]/edit/page.tsx
@app/(app)/admin/cogs/[id]/edit/EditCogsKammerForm.tsx
@lib/cogs/admin-actions.ts
@lib/validations/admin.ts
@lib/extraction/cost.test.ts

<interfaces>
<!-- Contracts the executor needs. Use these directly; do not re-explore. -->

DB client (db/client.ts):
```typescript
export const db: BetterSQLite3Database<typeof schema>;
export type Db = typeof db;
// better-sqlite3 transactions are SYNCHRONOUS — tx callbacks must NOT be async.
```

Current claude.ts (lib/extraction/claude.ts) — to be changed:
```typescript
const MODEL = "claude-sonnet-4-6" as const;        // <-- replace with resolveClaudeModel()
let _client: Anthropic | null = null;              // <-- DELETE module-level cache
function client(): Anthropic { ... process.env.ANTHROPIC_API_KEY ... } // <-- replace
export async function extractFields(storagePath: string): Promise<ExtractFieldsResult>;
// ExtractFieldsResult = { parsed, usage:{input_tokens,output_tokens}, model:string }
```

Current extraction catch (lib/extraction/actions.ts ~line 77-86) — to be changed:
```typescript
console.error("[extraction] failed for document", documentId, e); // KEEP
const err = e as { status?: number };
const code: UploadErrorCode = err?.status === 429 ? "rate_limited" : "unknown"; // <-- replace with classifyAnthropicError(e)
```
ExtractionActionResult error type is `UploadErrorCode | "not_found"`.

Current error union (lib/uploads/errors.ts):
```typescript
export const UPLOAD_ERROR_CODES = ["unauthenticated","file_too_large","invalid_pdf",
  "encrypted_pdf","batch_limit","rate_limited","unknown"] as const;
export type UploadErrorCode = (typeof UPLOAD_ERROR_CODES)[number];
```

ErrorCopy (app/(app)/upload/_components/ErrorCopy.ts) is a `Record<UploadErrorCode | "not_found", string>` — ANY new code added to the union MUST get an entry here or the build fails.

Document detail page (app/(app)/documents/[id]/page.tsx): `doc` comes from `getDocumentForUser` which does `select()` → `doc.errorCode: string | null` and `doc.extractionStatus` are available. The generic block is the `doc.extractionStatus === "error"` branch (~line 89-98).

CoGS Server Action shape to mirror (lib/cogs/admin-actions.ts):
```typescript
"use server";
const Schema = z.object({...});
export async function action(input): Promise<{ ok: true } | { ok: false; error: string; details?: unknown }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: "unauthenticated" };
  const parsed = Schema.safeParse(input);
  ...
  revalidatePath("/admin/...");
}
```

Client form pattern to mirror (EditCogsKammerForm.tsx): "use client", useState + React.useTransition, sonner `toast`, shadcn Input/Label/Button. Buttons: project Button is base-ui (no asChild) — use `buttonVariants()` on `<Link>` for link-as-button.

Available shadcn primitives (components/ui/): badge, button, card, checkbox, dialog, form, input, label, progress, select, separator, sheet, skeleton, sonner, table, textarea.

Anthropic SDK error shape: thrown errors carry `.status` (number) and `.headers`. The SDK also exposes typed `APIError` subclasses, but classify defensively from `e.status` + message string (do not rely on instanceof across the SDK bundle).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Shared error classifier + extend error-code union + ErrorCopy</name>
  <files>lib/extraction/error-code.ts, lib/extraction/error-code.test.ts, lib/uploads/errors.ts, app/(app)/upload/_components/ErrorCopy.ts</files>
  <behavior>
    classifyAnthropicError(e) maps to ExtractionErrorCode:
    - status 401 → "auth"
    - status 400 AND message contains "credit balance" (case-insensitive) → "credit"
    - status 400 without that phrase → "unknown" (fall through; do not mislabel)
    - status 429 → "rate_limited"
    - status 404 → "model_unavailable"
    - status 413 → "too_large"
    - anything else / no status → "unknown"
    extractionErrorMessageDe(code) returns the German strings from the spec:
    - auth → "API-Schlüssel ungültig"
    - credit → "Kein Anthropic-Guthaben — bitte unter console.anthropic.com aufladen"
    - rate_limited → "Rate-Limit erreicht — später erneut"
    - model_unavailable → "Modell nicht verfügbar"  (page may append the model; keep base msg model-free)
    - too_large → "Dokument zu groß für die Analyse"
    - unknown → "Analyse fehlgeschlagen. Bitte erneut versuchen."
    Test cases (error-code.test.ts, pure, @vitest-environment node):
    - 401 → auth; 400 + "Your credit balance is too low..." → credit; 400 + other msg → unknown;
      429 → rate_limited; 404 → model_unavailable; 413 → too_large; plain Error → unknown; null/undefined → unknown.
  </behavior>
  <action>
    1. Create lib/extraction/error-code.ts. Export:
       - `export const EXTRACTION_ERROR_CODES = ["auth","credit","rate_limited","model_unavailable","too_large","unknown"] as const;`
       - `export type ExtractionErrorCode = (typeof EXTRACTION_ERROR_CODES)[number];`
       - `export function classifyAnthropicError(e: unknown): ExtractionErrorCode` — read `(e as {status?:number}).status` and the message via `(e as {message?:string}).message ?? String(e)`. Implement the mapping in <behavior>. Match "credit balance" with a lowercased `.includes("credit balance")`.
       - `export function extractionErrorMessageDe(code: string | null | undefined): string` — switch over the codes; default (incl. null/legacy "rate_limited"/"unknown" already in DB) → the generic string. NOTE: legacy DB rows may already contain "rate_limited" or "unknown" — both are handled by this same switch, so no migration is needed.
       - IMPORTANT: never log or include the API key here. This module is pure — no DB, no env.
    2. Create lib/extraction/error-code.test.ts with the cases in <behavior>. Use `// @vitest-environment node` and mirror cost.test.ts structure (import from "./error-code"). Build error objects with `Object.assign(new Error(msg), { status })`.
    3. Extend lib/uploads/errors.ts: add the new codes to UPLOAD_ERROR_CODES so the shared type covers everything the extraction action may store: add `"auth"`, `"credit"`, `"model_unavailable"`, `"too_large"` (keep existing entries; "rate_limited" and "unknown" already present). This keeps ExtractionActionResult's `UploadErrorCode | "not_found"` valid for the new codes.
    4. Update app/(app)/upload/_components/ErrorCopy.ts: the Record is keyed by `UploadErrorCode | "not_found"`, so adding union members WILL break the build until every new key has a value. Add German entries reusing the same copy:
       - auth → "API-Schlüssel ungültig. Bitte unter Einstellungen prüfen."
       - credit → "Kein Anthropic-Guthaben. Bitte unter Einstellungen / console.anthropic.com aufladen."
       - model_unavailable → "Modell nicht verfügbar. Bitte unter Einstellungen prüfen."
       - too_large → "Dokument zu groß für die Analyse."
       Do NOT introduce a "v1"/placeholder — fill all keys.
  </action>
  <verify>
    <automated>cd "$PWD" && npm run test:run -- lib/extraction/error-code.test.ts</automated>
  </verify>
  <done>error-code.ts exports the classifier + German message fn; its unit test passes; UPLOAD_ERROR_CODES includes auth/credit/model_unavailable/too_large; ErrorCopy.ts has an entry for every union member (no missing-key TS error).</done>
</task>

<task type="auto">
  <name>Task 2: appSetting table + settings store (resolution + masking) + call-time key/model in claude.ts + actions.ts classifier wiring</name>
  <files>db/schema.ts, lib/settings/store.ts, lib/extraction/claude.ts, lib/extraction/actions.ts, lib/extraction/actions.test.ts</files>
  <action>
    1. db/schema.ts — append a new section with a key-value table:
       ```
       // ======== Quick 260626-wou: App settings (key-value) ========
       export const appSetting = sqliteTable("app_setting", {
         key: text("key").primaryKey(),
         value: text("value"),
         updatedAt: integer("updated_at", { mode: "timestamp_ms" })
           .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
           .$onUpdate(() => /* @__PURE__ */ new Date())
           .notNull(),
       });
       ```
       Keys used at runtime: "anthropic_api_key", "claude_model". No enum/check needed.
    2. Apply the schema to the local dev DB: run `npm run db:push` (drizzle-kit push). Note for SUMMARY: the production server applies this automatically via update.sh (runs push, ignores conflicts) — no generated migration file is required for this quick task, matching the project's push-based convention.
    3. Create lib/settings/store.ts (NOT "use server" — plain server module; add `import "server-only";`). Export:
       - `export const DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-6";`
       - `export async function getSetting(key: string): Promise<string | null>` — `db.select().from(appSetting).where(eq(appSetting.key, key)).limit(1)`, return `row?.value ?? null`.
       - `export async function setSetting(key: string, value: string): Promise<void>` — upsert via `db.insert(appSetting).values({ key, value }).onConflictDoUpdate({ target: appSetting.key, set: { value } })`. (better-sqlite3 sync API is fine via await on drizzle.)
       - `export async function resolveAnthropicKey(): Promise<string | null>` — DB "anthropic_api_key" → fallback `process.env.ANTHROPIC_API_KEY ?? null`. Treat empty string as unset.
       - `export async function resolveClaudeModel(): Promise<string>` — DB "claude_model" (non-empty) → fallback DEFAULT_CLAUDE_MODEL.
       - `export function maskKey(key: string | null): string` — null/empty → "Kein Schlüssel gesetzt"; else `"Gesetzt: sk-ant-…" + last4`. Compute last4 = `key.slice(-4)`. NEVER return the full key.
       - SECURITY: never console.log/console.error the key value anywhere in this module.
    4. lib/extraction/claude.ts — rewrite key/model resolution to be CALL-TIME (no module cache):
       - DELETE `const MODEL = ...`, `let _client`, and the cached `client()` function.
       - Import `{ resolveAnthropicKey, resolveClaudeModel }` from "@/lib/settings/store".
       - Inside `extractFields`, before the API call: `const apiKey = await resolveAnthropicKey(); if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set"); const model = await resolveClaudeModel(); const anthropic = new Anthropic({ apiKey });` then call `anthropic.messages.create({ model, ... })`. Creating the client per call is intentional and acceptable here (single-user tool) — it guarantees a UI key change takes effect immediately with no restart.
       - Keep the rest (base64 read, content blocks, textBlock extraction, return shape) unchanged. Still return `model: msg.model`.
    5. lib/extraction/actions.ts — wire the shared classifier into the catch block (~line 77-86):
       - Import `{ classifyAnthropicError }` from "./error-code"; import `type { ExtractionErrorCode }` if needed.
       - KEEP `console.error("[extraction] failed for document", documentId, e);`.
       - Replace `const code: UploadErrorCode = err?.status === 429 ? "rate_limited" : "unknown";` with `const code = classifyAnthropicError(e);`.
       - The DB column is free-text and UploadErrorCode now includes the new codes, so storing `code` and returning `{ ok:false, documentId, error: code }` type-checks. (errorCode is text — no enum migration.)
       - Leave the existing 429-retry helper (runExtractionWithOneRetry) untouched.
    6. lib/extraction/actions.test.ts — update expectations affected by richer classification, keeping all other tests intact:
       - The "retries once on 429 ... fails cleanly on second 429" test: still expects `error: "rate_limited"` and `doc.errorCode === "rate_limited"` (429 → rate_limited) — should still pass, verify.
       - The "maps non-429 SDK errors to unknown" test uses `new Error("boom")` (no status) → still "unknown" — verify still passes.
       - ADD one test: a 400 error whose message contains "Your credit balance is too low to access the Anthropic API." → `error: "credit"` and `doc.errorCode === "credit"`. Build it with `Object.assign(new Error("...credit balance..."), { status: 400 })` via `extractFieldsMock.mockRejectedValueOnce(...)`, mirroring the existing 429 test setup.
       - Do NOT weaken or delete existing assertions.
  </action>
  <verify>
    <automated>cd "$PWD" && npm run db:push && npm run test:run -- lib/extraction/actions.test.ts lib/extraction/error-code.test.ts</automated>
  </verify>
  <done>app_setting table exists in the local DB; store resolves key/model with DB→env/default precedence and masks keys; claude.ts has no module-level client cache and resolves key+model per call; actions.ts uses classifyAnthropicError; existing extraction tests pass and a new "credit" test passes.</done>
</task>

<task type="auto">
  <name>Task 3: Settings Zod schema + saveAndTestSettingsAction Server Action</name>
  <files>lib/validations/settings.ts, lib/settings/actions.ts</files>
  <action>
    1. Create lib/validations/settings.ts mirroring lib/validations/admin.ts:
       ```
       import { z } from "zod";
       export const SettingsSchema = z.object({
         // blank apiKey = keep existing → optional/empty allowed
         apiKey: z.string().trim().max(300).optional().or(z.literal("")),
         model: z.string().trim().min(1, "Modell darf nicht leer sein.").max(100),
       });
       export type SettingsInput = z.infer<typeof SettingsSchema>;
       ```
    2. Create lib/settings/actions.ts ("use server") mirroring lib/cogs/admin-actions.ts auth+validate+revalidate shape. Export:
       `export type TestStatus = "ok" | "auth" | "credit" | "model_unavailable" | "rate_limited" | "unknown" | "validation" | "unauthenticated" | "no_key";`
       `export async function saveAndTestSettingsAction(input: SettingsInput): Promise<{ status: TestStatus; message: string; model?: string }>`
       Logic, in order:
       a. `const session = await auth.api.getSession({ headers: await headers() });` → if none return `{ status: "unauthenticated", message: "Nicht angemeldet." }`.
       b. `const parsed = SettingsSchema.safeParse(input);` → if !success return `{ status: "validation", message: "Eingabe ungültig." }`.
       c. SAVE FIRST (per spec: save provided values, then test):
          - If `parsed.data.apiKey` is a non-empty string → `await setSetting("anthropic_api_key", parsed.data.apiKey)`. If blank → do NOT call setSetting for the key (keeps existing — never overwrite with empty).
          - `await setSetting("claude_model", parsed.data.model)`.
       d. Resolve effective values for the TEST: `const key = await resolveAnthropicKey(); const model = await resolveClaudeModel();`
          - If `!key` → return `{ status: "no_key", message: "Kein Schlüssel gesetzt." }` (saved model anyway).
       e. Run a REAL minimal validation call against Anthropic with the effective key+model:
          ```
          try {
            const anthropic = new Anthropic({ apiKey: key });
            await anthropic.messages.create({ model, max_tokens: 1, messages: [{ role: "user", content: "ping" }] });
            return { status: "ok", message: "✓ Schlüssel gültig, Guthaben vorhanden", model };
          } catch (e) {
            const code = classifyAnthropicError(e); // reused from Task 1
            const message =
              code === "auth" ? "API-Schlüssel ungültig" :
              code === "credit" ? "Kein Anthropic-Guthaben — bitte unter console.anthropic.com aufladen" :
              code === "model_unavailable" ? `Modell nicht verfügbar: ${model}` :
              code === "rate_limited" ? "Rate-Limit erreicht — später erneut" :
              ((e as {message?:string}).message ?? "Unbekannter Fehler"); // "other" → show API message
            const status: TestStatus = code === "too_large" ? "unknown" : (code as TestStatus);
            return { status, message, model };
          }
          ```
       f. SECURITY: never console.log/console.error the key. It is acceptable to console.error a non-key error summary if useful, but do NOT include `key` in any log. Add `revalidatePath("/admin/settings")` after a successful save (before returning is fine).
       Imports: `{ headers }` from "next/headers", `{ auth }` from "@/lib/auth", `{ revalidatePath }` from "next/cache", `Anthropic` from "@anthropic-ai/sdk", `{ setSetting, resolveAnthropicKey, resolveClaudeModel }` from "@/lib/settings/store", `{ classifyAnthropicError }` from "@/lib/extraction/error-code", `{ SettingsSchema, type SettingsInput }` from "@/lib/validations/settings".
  </action>
  <verify>
    <automated>cd "$PWD" && npx tsc --noEmit -p tsconfig.json</automated>
  </verify>
  <done>saveAndTestSettingsAction type-checks; saves model always, saves key only when non-blank, runs a real Anthropic validation call, and returns a structured German status reusing classifyAnthropicError; no key value is logged.</done>
</task>

<task type="auto">
  <name>Task 4: Settings page + client form + nav link + specific document-page error message</name>
  <files>app/(app)/admin/settings/page.tsx, app/(app)/admin/settings/SettingsForm.tsx, app/(app)/layout.tsx, app/(app)/documents/[id]/page.tsx</files>
  <action>
    1. Create app/(app)/admin/settings/page.tsx — Server Component, mirror app/(app)/admin/cogs/[id]/edit/page.tsx header/auth pattern:
       - `export const metadata = { title: "Einstellungen — DDFT" };`
       - auth: `const session = await auth.api.getSession({ headers: await headers() }); if (!session) redirect("/login");`
       - Load current values: `import { resolveAnthropicKey, resolveClaudeModel, maskKey, DEFAULT_CLAUDE_MODEL } from "@/lib/settings/store";` then `const key = await resolveAnthropicKey(); const model = await resolveClaudeModel(); const keyHint = maskKey(key);`
       - Wrap in `<main className="mx-auto w-full max-w-[900px] px-6 pt-8">` with an h1 "Einstellungen" and a short German subtitle ("Anthropic API-Schlüssel und Claude-Modell konfigurieren.").
       - Render `<SettingsForm keyHint={keyHint} model={model} defaultModel={DEFAULT_CLAUDE_MODEL} />`. NEVER pass the raw key to the client — only keyHint.
    2. Create app/(app)/admin/settings/SettingsForm.tsx — "use client", mirror EditCogsKammerForm.tsx (useState + React.useTransition + sonner toast + shadcn Input/Label/Button/Card):
       - Props: `{ keyHint: string; model: string; defaultModel: string }`.
       - State: `apiKey` (starts ""), `model` (starts from prop), and `result: { status: string; message: string } | null`.
       - API key field: `<Input type="password" ... placeholder="Leer lassen = Schlüssel behalten" />` with a helper line showing `keyHint` (e.g. "Aktuell: {keyHint}") and a note "Der gespeicherte Schlüssel wird nie vollständig angezeigt."
       - Model field: `<Input type="text" value={model} ... />` with helper text: `Standard: {defaultModel}. Frei änderbar für neue Modell-IDs.`
       - Submit button "Speichern & testen" (disabled while pending; "Wird getestet …" while pending). onSubmit calls `saveAndTestSettingsAction({ apiKey, model })` inside startTransition.
       - On result: `toast.success(result.message)` if `status === "ok"`, else `toast.error(result.message)`. Also render the message inline (role="status"/role="alert") below the form with green text for ok and destructive text otherwise so it persists after the toast. Clear the password field after a successful save (so the masked hint remains the source of truth).
       - Import the action from "@/lib/settings/actions".
    3. app/(app)/layout.tsx — add an "Einstellungen" nav link in the `<nav>` block, after the "CoGS" link, matching the existing Link styling:
       `<Link href="/admin/settings" className="font-medium text-muted-foreground hover:text-foreground">Einstellungen</Link>`
    4. app/(app)/documents/[id]/page.tsx — replace the generic error branch (the `doc.extractionStatus === "error"` block, ~lines 89-98) with a specific message:
       - Import `{ extractionErrorMessageDe }` from "@/lib/extraction/error-code".
       - Keep the heading "Analyse fehlgeschlagen" (role="alert"), but render the body as `{extractionErrorMessageDe(doc.errorCode)}` instead of the fixed "Die Analyse konnte nicht abgeschlossen werden..." string.
       - If `doc.errorCode === "credit" || doc.errorCode === "auth"`, render an extra line with a link to settings:
         `<Link href="/admin/settings" className="text-sm underline">API-Schlüssel/Guthaben unter Einstellungen prüfen</Link>` (Link is already imported in this file).
       - Do not touch the non-error branches.
  </action>
  <verify>
    <automated>cd "$PWD" && npm run build 2>&1 | tail -20</automated>
  </verify>
  <done>/admin/settings renders for an authenticated user with a masked key hint and a model field; "Einstellungen" link appears in the nav; "Speichern & testen" calls the action and shows a German result; document detail page shows the specific extractionErrorMessageDe(errorCode) with a settings link for credit/auth; `npm run build` succeeds.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → settings Server Action | Operator submits API key + model (untrusted form input) |
| app → Anthropic API | Outbound call with the configured key |
| app → SQLite (app_setting) | Plaintext secret stored at rest |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-wou-01 | Information Disclosure | Settings page rendering the stored key | mitigate | Server never passes the raw key to the client; only `maskKey()` hint ("…<last4>") is rendered. Key field is `type="password"`. |
| T-wou-02 | Information Disclosure | Logs leaking the key | mitigate | error-code.ts, settings/store.ts, and settings/actions.ts MUST NOT console.log/console.error the key value. Existing `[extraction] failed` log keeps logging the error object only (no key). |
| T-wou-03 | Information Disclosure | Key stored plaintext in SQLite | accept | Single-user internal tool; DB file is server-local and access-controlled. No encryption (note in SUMMARY). Documented, low-value beyond this operator. |
| T-wou-04 | Elevation of Privilege | Unauthenticated access to settings/save | mitigate | Page is inside the (app) layout (session-gated redirect to /login); saveAndTestSettingsAction re-checks `auth.api.getSession` and returns unauthenticated. |
| T-wou-05 | Tampering | Blank key overwriting a valid key | mitigate | Blank apiKey field is treated as "keep existing" — setSetting for the key is only called when the submitted value is non-empty. |
| T-wou-06 | Denial of Service | Validation call burning quota / cost | accept | Single operator, manual button press, max_tokens: 1 ping. Negligible cost; no rate-limit guard needed for one user. |
</threat_model>

<verification>
- `npm run test:run` — full vitest suite passes (error-code.test.ts new; actions.test.ts updated with a credit case; cost/schema unchanged).
- `npm run build` — production build succeeds (catches the ErrorCopy missing-key TS error if any union member was missed).
- `npx tsc --noEmit` — no type errors across new settings modules.
- Manual (operator, post-deploy): open Einstellungen, save a model only (key blank) → key hint unchanged; enter a bad key → "API-Schlüssel ungültig"; with the real out-of-credit key → "Kein Anthropic-Guthaben …"; trigger an extraction failure and confirm the document page shows the specific reason + settings link.
</verification>

<success_criteria>
- A) Settings page at /admin/settings (nav-linked) configures Anthropic key + Claude model at runtime; "Speichern & testen" runs a real validation call and returns a specific German status; blank key keeps the existing key; the full key is never rendered; a key/model change takes effect on the next extraction with NO server restart (call-time resolution, no module-level client cache).
- B) A shared classifier (classifyAnthropicError / extractionErrorMessageDe) maps SDK errors to auth/credit/rate_limited/model_unavailable/too_large/unknown, is unit-tested, and is reused by BOTH the settings test and the extraction catch; the document detail page shows the specific reason instead of "Analyse fehlgeschlagen", with a settings link for credit/auth.
- `npm run build` passes and the existing vitest suite still passes.
- The schema change is applied via `drizzle-kit push` locally; SUMMARY notes the server applies it via update.sh and that the key is stored plaintext (accepted for this single-user tool).
</success_criteria>

<output>
After completion, create `.planning/quick/260626-wou-einstellungs-seite-anthropic-api-key-mod/260626-wou-SUMMARY.md`.

In the SUMMARY, explicitly record:
- The schema change requires `drizzle-kit push` (done locally); the production server applies it via update.sh (push, ignores conflicts) — no generated migration committed, matching project convention.
- SECURITY: the Anthropic API key is stored plaintext in SQLite — accepted for this single-user internal tool, not encrypted; the key is never rendered in full and never logged.
- claude.ts now resolves key+model at call time (per-call Anthropic client) so a UI key change applies without a restart.
</output>
