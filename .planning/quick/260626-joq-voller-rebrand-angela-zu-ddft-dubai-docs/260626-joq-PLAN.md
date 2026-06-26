---
phase: quick-260626-joq
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/(app)/layout.tsx
  - app/(auth)/login/page.tsx
  - app/layout.tsx
  - app/(app)/page.tsx
  - app/(app)/upload/page.tsx
  - app/(app)/history/page.tsx
  - app/(app)/cases/page.tsx
  - app/(app)/cases/new/page.tsx
  - app/(app)/cases/[id]/page.tsx
  - app/(app)/documents/[id]/page.tsx
  - app/(app)/documents/[id]/review/page.tsx
  - app/(app)/admin/behoerden/page.tsx
  - app/(app)/admin/behoerden/authorities/page.tsx
  - app/(app)/admin/behoerden/authorities/[id]/edit/page.tsx
  - app/(app)/admin/behoerden/document-types/page.tsx
  - app/(app)/admin/cogs/[id]/edit/page.tsx
  - package.json
  - app/globals.css
autonomous: true
requirements: [REBRAND]
must_haves:
  truths:
    - "Header shows the DDFT logo image plus the wordmark 'Dubai Docs Fast Track', linking to /"
    - "Login page shows the DDFT logo centered above the form"
    - "No user-facing 'Angela' string remains in any page title or the header"
    - "Browser/app theme uses DDFT brand colors (navy primary, cyan accent/ring) with readable contrast"
    - "npm run build passes and the vitest suite passes"
  artifacts:
    - path: "app/(app)/layout.tsx"
      provides: "Header with next/image DDFT logo + wordmark"
      contains: "ddft-logo.png"
    - path: "app/(auth)/login/page.tsx"
      provides: "Login page with centered DDFT logo + DDFT title"
      contains: "ddft-logo.png"
    - path: "app/globals.css"
      provides: "DDFT @theme palette (navy primary, cyan ring)"
    - path: "package.json"
      provides: "Package renamed to ddft"
  key_links:
    - from: "app/(app)/layout.tsx"
      to: "public/ddft-logo.png"
      via: "next/image import + src"
      pattern: "ddft-logo\\.png"
    - from: "app/globals.css"
      to: "shadcn token mappings"
      via: "@theme inline var(--primary) / var(--ring)"
      pattern: "--color-primary|--color-ring"
---

<objective>
Full rebrand of the app from "Angela" to "DDFT / Dubai Docs Fast Track": logo, wordmark, every page title, the package name, and the color theme.

Purpose: Replace the placeholder "Angela" identity with the real DDFT brand across all user-facing surfaces, aligning the web UI with the already-DDFT-branded Laufliste PDF (DDFT_COLORS in lib/laufliste/pdf/styles.ts).
Output: Rebranded header, login page, metadata titles, package name, and DDFT brand color theme. Build green, tests green.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

# Source of truth for brand hex values:
@lib/laufliste/pdf/styles.ts

# Files being edited (read before editing):
@app/(app)/layout.tsx
@app/(auth)/login/page.tsx
@app/layout.tsx
@app/globals.css

<interfaces>
<!-- Brand hex targets (from lib/laufliste/pdf/styles.ts DDFT_COLORS). Executor converts to OKLCH. -->
DDFT_COLORS = {
  cyan:     "#07B7EF",   // accent / focus ring
  navy:     "#08449B",   // primary (buttons, links)
  navyDark: "#081C3A",
  text:     "#111111",
  muted:    "#6B7280",
}

Logo asset (already present, verified): public/ddft-logo.png  (1311x... PNG, 64KB)
next/image with a LOCAL public/ asset needs NO next.config remotePatterns.

Verified: all 16 user-facing "Angela" title occurrences live in the 16 page files listed
in files_modified. The 3 occurrences in cases/[id]/page.tsx are at lines 71, 73, 74
(line 74 is a template literal: `${caseRow.personName} — Angela`).

DO NOT TOUCH (internal/dev refs, confirmed out of scope):
- DEPLOY.md, CLAUDE.md
- __tests__/_fixtures/test-db.ts ("angela-test-" tmp prefix)
- scripts/seed-extraction-fixture.ts (seed@angela.local default)
- data/angela.db filename + DATABASE_URL
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rebrand logo + wordmark in header and login page</name>
  <files>app/(app)/layout.tsx, app/(auth)/login/page.tsx</files>
  <action>
    HEADER — app/(app)/layout.tsx (~line 21-23):
    - Add `import Image from "next/image";` at top.
    - Replace the text "Angela" inside the existing `<Link href="/">` with: an `Image` for
      public/ddft-logo.png on the left PLUS the wordmark "Dubai Docs Fast Track" beside it.
      Use `<Image src="/ddft-logo.png" alt="Dubai Docs Fast Track" height={28} width={120}
      style={{ height: 28, width: "auto" }} priority />` (width is a placeholder to satisfy
      next/image; the inline style makes it auto). Wrap logo + wordmark in a flex row:
      `className="flex items-center gap-2"` on the Link; keep `href="/"`.
      Wordmark span: `className="text-sm font-semibold"`. Keep the surrounding nav untouched.
    - Optional subtle brand touch: leave header bg/border as-is (bg-muted/border-border) —
      the new theme tokens (Task 3) already restyle primary/links/rings globally. Do not add
      hardcoded hex here.

    LOGIN — app/(auth)/login/page.tsx:
    - Change `title: "Anmelden — Angela"` → `title: "Anmelden — DDFT"`.
    - Add `import Image from "next/image";`.
    - Add the DDFT logo centered ABOVE the Card, inside the existing `<main>` (which is a
      flex column-centered container — wrap content so the logo sits above the card). Render
      `<Image src="/ddft-logo.png" alt="Dubai Docs Fast Track" width={64} height={64}
      style={{ height: 64, width: "auto" }} className="mb-6" priority />`. Keep the Card and
      LoginForm unchanged otherwise. Adjust the `<main>` to `flex-col` if needed so the logo
      stacks above the card and both stay centered.
  </action>
  <verify>
    <automated>cd "$(git rev-parse --show-toplevel)" && grep -q "ddft-logo.png" "app/(app)/layout.tsx" && grep -q "Dubai Docs Fast Track" "app/(app)/layout.tsx" && grep -q "ddft-logo.png" "app/(auth)/login/page.tsx" && ! grep -q "Angela" "app/(app)/layout.tsx" && echo OK</automated>
  </verify>
  <done>Header renders the DDFT logo image + "Dubai Docs Fast Track" wordmark linking to /; no "Angela" text in the header. Login page shows centered logo above the form and title "Anmelden — DDFT".</done>
</task>

<task type="auto">
  <name>Task 2: Replace all page-title "Angela" → "DDFT" and rename package</name>
  <files>app/layout.tsx, app/(app)/page.tsx, app/(app)/upload/page.tsx, app/(app)/history/page.tsx, app/(app)/cases/page.tsx, app/(app)/cases/new/page.tsx, app/(app)/cases/[id]/page.tsx, app/(app)/documents/[id]/page.tsx, app/(app)/documents/[id]/review/page.tsx, app/(app)/admin/behoerden/page.tsx, app/(app)/admin/behoerden/authorities/page.tsx, app/(app)/admin/behoerden/authorities/[id]/edit/page.tsx, app/(app)/admin/behoerden/document-types/page.tsx, app/(app)/admin/cogs/[id]/edit/page.tsx, package.json</files>
  <action>
    ROOT METADATA — app/layout.tsx (~line 7): `title: "Angela"` → `title: "Dubai Docs Fast Track"`
    (this is the standalone root title, NOT a "— Angela" suffix; use the full wordmark here).

    SUFFIX TITLES — in every file below, replace the "— Angela" suffix with "— DDFT". Keep the
    German prefix text exactly as-is:
    - app/(app)/page.tsx:18                       "Übersicht — Angela"       → "Übersicht — DDFT"
    - app/(app)/upload/page.tsx:4                  "Dokumente hochladen — Angela" → "… — DDFT"
    - app/(app)/history/page.tsx:21               "Historie — Angela"        → "Historie — DDFT"
    - app/(app)/cases/page.tsx:22                 "Fälle — Angela"           → "Fälle — DDFT"
    - app/(app)/cases/new/page.tsx:10             "Neuen Fall anlegen — Angela" → "… — DDFT"
    - app/(app)/documents/[id]/page.tsx:16        "Dokument — Angela"        → "Dokument — DDFT"
    - app/(app)/documents/[id]/review/page.tsx:17 "Überprüfung — Angela"     → "Überprüfung — DDFT"
    - app/(app)/admin/behoerden/page.tsx:10       "Behörden — Angela"        → "Behörden — DDFT"
    - app/(app)/admin/behoerden/authorities/page.tsx:25 "Behörden bearbeiten — Angela" → "… — DDFT"
    - app/(app)/admin/behoerden/authorities/[id]/edit/page.tsx:10 "Behörde bearbeiten — Angela" → "… — DDFT"
    - app/(app)/admin/behoerden/document-types/page.tsx:10 "Dokumentenarten — Angela" → "… — DDFT"
    - app/(app)/admin/cogs/[id]/edit/page.tsx:9   "CoGS-Eintrag bearbeiten — Angela" → "… — DDFT"

    cases/[id]/page.tsx — THREE occurrences (generateMetadata):
    - line 71: `{ title: "Fall — Angela" }`  → `{ title: "Fall — DDFT" }`
    - line 73: `{ title: "Fall — Angela" }`  → `{ title: "Fall — DDFT" }`
    - line 74: `{ title: `${caseRow.personName} — Angela` }` → `{ title: `${caseRow.personName} — DDFT` }`

    PACKAGE — package.json line 2: `"name": "angela"` → `"name": "ddft"`. Do NOT change version
    or anything else.

    NOTE (login title already handled in Task 1 — do not redo it here).
  </action>
  <verify>
    <automated>cd "$(git rev-parse --show-toplevel)" && ! grep -rln "Angela" app/ && grep -q '"name": "ddft"' package.json && echo OK</automated>
  </verify>
  <done>No "Angela" string remains anywhere under app/. package.json name is "ddft". All page titles end in "— DDFT" (root title is full "Dubai Docs Fast Track").</done>
</task>

<task type="auto">
  <name>Task 3: Apply DDFT color theme + verify build and tests</name>
  <files>app/globals.css</files>
  <action>
    Rebrand the @theme palette in app/globals.css from neutral-slate to DDFT brand colors,
    matching DDFT_COLORS (navy #08449B primary, cyan #07B7EF accent/ring). Keep backgrounds
    light/neutral — apply brand color only to primary actions, links, focus rings, accents.

    In the top `@theme { ... }` block (lines ~7-22):
    - `--color-primary`: navy #08449B → use OKLCH `oklch(0.45 0.17 258)` (verify visually
      it reads as the navy; nudge L within 0.42–0.48 / C 0.15–0.18 / H 255–262 to match).
    - `--color-primary-foreground`: keep `oklch(1 0 0)` (white) — white-on-navy passes WCAG AA.
    - `--color-ring`: cyan #07B7EF → `oklch(0.72 0.13 220)`.
    - Leave background/foreground/muted/border/input/destructive as the existing neutrals.

    CRITICAL — the shadcn token mappings further down use the BARE vars in `:root` (lines
    75-108), and `@theme inline` (lines 30-73) maps `--color-primary: var(--primary)` etc.
    So you MUST also update the matching bare vars in `:root` to the SAME OKLCH values:
    - `:root --primary` (line 82) → navy OKLCH (same value as --color-primary above)
    - `:root --primary-foreground` (line 83) → `oklch(1 0 0)`
    - `:root --ring` (line 93) → cyan OKLCH (same as --color-ring above)
    - Optionally set `:root --accent` / `--accent-foreground` to a subtle cyan-tinted pair if
      desired, but only if it keeps text contrast AA on accent backgrounds; otherwise leave neutral.
    Do NOT touch the `.dark` block or the `@theme inline` mappings (they reference vars, don't
    redefine colors). Do NOT remove any existing token — only change color VALUES.

    Then run the full verification (build + tests) as part of this task.
  </action>
  <verify>
    <automated>cd "$(git rev-parse --show-toplevel)" && npm run build && npx vitest run</automated>
  </verify>
  <done>app/globals.css uses DDFT navy primary + cyan ring in both the `@theme` block and the `:root` bare vars; shadcn token mappings still resolve; `npm run build` passes; full vitest suite passes (no copy assertion regressions — login-copy and home-copy tests do not assert on the "Angela" string, confirmed during planning, so they should pass unchanged; if any assertion DID reference "Angela" or the old wordmark, update it to the new brand string rather than weakening the test).</done>
</task>

</tasks>

<verification>
- `npm run build` exits 0.
- `npx vitest run` passes the full suite (login-copy.test.tsx, home-copy.test.tsx, and all others green).
- `grep -rln "Angela" app/` returns nothing.
- Header renders DDFT logo + "Dubai Docs Fast Track" wordmark; login page renders centered logo.
- Primary buttons/links/focus rings visibly use DDFT navy/cyan.
</verification>

<success_criteria>
- No user-facing "Angela" remains (header + all 16 title occurrences replaced).
- DDFT logo present in header (with wordmark) and on login page (centered, ~64px).
- package.json name = "ddft".
- Theme reflects DDFT brand (navy primary, cyan ring) with AA-readable contrast; backgrounds stay light.
- Build green, tests green.
- Out-of-scope internal refs (DEPLOY.md, data/angela.db, test fixtures, seed script, CLAUDE.md) untouched.
</success_criteria>

<output>
After completion, create `.planning/quick/260626-joq-voller-rebrand-angela-zu-ddft-dubai-docs/260626-joq-SUMMARY.md`
</output>
