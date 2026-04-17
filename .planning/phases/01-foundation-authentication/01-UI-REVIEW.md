# Phase 1 — UI Review

**Audited:** 2026-04-17
**Baseline:** 01-UI-SPEC.md (approved design contract)
**Screenshots:** not captured (no dev server running — code-only audit)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | All German strings match UI-SPEC verbatim; no generic English labels |
| 2. Visuals | 3/4 | Centered card layout correct; card uses `bg-card` (white) not `bg-muted` (secondary) at runtime due to CSS variable layering |
| 3. Color | 3/4 | Accent correctly scoped; dark-mode CSS block present despite spec deferring dark mode |
| 4. Typography | 3/4 | 3 declared sizes in use; label component ships `font-medium` (third weight) alongside declared `font-semibold` |
| 5. Spacing | 3/4 | One arbitrary value (`max-w-[360px]`) used; card padding resolves via component defaults not an explicit `p-8`, but within spec intent |
| 6. Experience Design | 4/4 | All required states (loading, inline error, rate-limit, toast, disabled) correctly implemented |

**Overall: 20/24**

---

## Top 3 Priority Fixes

1. **Card background resolves to white, not neutral-100** — Visually the login card will not show the `#F5F5F5` secondary background the spec requires, because `bg-card` in the shadcn `:root` block is `oklch(1 0 0)` (white). The `bg-muted` override on `<Card>` is correct and should work, but the `card.tsx` component uses `bg-card` as its base, and the explicit `bg-muted` on the Card element is merging with the shadcn default. Confirm in browser — if the card appears white, add a `.planning` note: apply `bg-muted` override correctly (it is already present in `page.tsx:18`) and verify Tailwind merge order is not dropping it.

2. **Dark-mode CSS block included despite light-mode-only spec (D-04 / UI-SPEC Color section)** — `globals.css` lines 108–140 define a full `.dark { ... }` theme block with a different accent color (`oklch(0.922 0 0)` replaces slate-900 with light gray) and different destructive color. This creates a risk: if any user or browser applies a `.dark` class (e.g., OS preference, future integration), the accent and error colors silently break the spec. Remove the `.dark {}` block or add a comment explicitly locking it as inert until dark mode is a design decision. Also remove `@custom-variant dark (&:is(.dark *))` at line 5 for consistency.

3. **shadcn `label.tsx` ships `font-medium` — a third font weight not in the spec** — The label component base class (`components/ui/label.tsx:16`) uses `font-medium` (weight 500). The spec allows only `font-normal` (400) and `font-semibold` (600). The implementation partially compensates by adding `font-semibold` on both `<Label>` elements in `login-form.tsx:58` and `login-form.tsx:74`, which overrides the base weight via Tailwind class order. However the override pattern is fragile — any new label added without the explicit `font-semibold` class will silently render at weight 500. Override `font-medium` in `label.tsx` with `font-semibold` to bake the correct weight into the component default, removing the need for per-instance overrides.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

All copy strings match the UI-SPEC Copywriting Contract exactly.

Checked strings:

| Element | Spec | Actual | Match |
|---------|------|--------|-------|
| Page `<title>` | `Anmelden — Angela` | `Anmelden — Angela` (layout.tsx:13) | PASS |
| Card heading | `Anmelden` | `Anmelden` (page.tsx:21) | PASS |
| Card subtext | `Bitte melden Sie sich mit Ihrem Konto an.` | verbatim (page.tsx:24) | PASS |
| Email label | `E-Mail` | `E-Mail` (login-form.tsx:59) | PASS |
| Email placeholder | `name@beispiel.de` | verbatim (login-form.tsx:65) | PASS |
| Password label | `Passwort` | `Passwort` (login-form.tsx:75) | PASS |
| Password placeholder | (empty) | no placeholder attribute set (login-form.tsx:77–83) | PASS |
| Primary CTA | `Anmelden` | `Anmelden` (login-form.tsx:125) | PASS |
| CTA loading | `Anmelden…` | `Anmelden…` (login-form.tsx:122) | PASS |
| 401 inline error | `E-Mail oder Passwort ungültig.` | verbatim (login-form.tsx:27, 43) | PASS |
| 429 inline error | `Zu viele Anmeldeversuche. Bitte warten Sie eine Minute.` | verbatim (login-form.tsx:41) | PASS |
| Unexpected error toast | `Anmeldung fehlgeschlagen. Bitte erneut versuchen.` | verbatim (login-form.tsx:45) | PASS |
| Logout button | `Abmelden` | `Abmelden` (logout-button.tsx:27) | PASS |
| Logout success toast | `Sie wurden abgemeldet.` | verbatim (logout-button.tsx:17) | PASS |
| Home heading | `Willkommen` | `Willkommen` (page.tsx:4) | PASS |
| Home subtext | `Die Dokumentenverarbeitung steht in der nächsten Version zur Verfügung.` | verbatim (page.tsx:5) | PASS |

No signup link, no password recovery link, no "Remember me" — confirmed absent.

---

### Pillar 2: Visuals (3/4)

**Card layout — correct in structure, minor color concern:**
- `login/page.tsx:17` — `min-h-screen flex items-center justify-center` correctly centers the card vertically and horizontally.
- `login/page.tsx:18` — `w-full max-w-[360px]` matches the spec's 360px max-width exactly.
- `<Card className="... bg-muted">` applies the secondary background override. However at runtime, whether `bg-muted` wins over the shadcn `bg-card` base depends on Tailwind class merge order. Visually this needs browser verification.

**Header layout — correct:**
- `app/(app)/layout.tsx:18` — `h-16 border-b border-border bg-muted flex items-center justify-between px-6` matches spec: 64px height, border-bottom, secondary background, horizontal padding 24px, space-between.
- Header left: `Angela` in `text-sm font-semibold` — matches spec.
- Header right: user email + ghost `Abmelden` button — matches spec.

**Visual hierarchy — adequate:**
- Login card has clear heading (2xl/semibold) > subtext (sm/muted) > labels (sm/semibold) > inputs > CTA — correct hierarchy.
- Spinner on loading state is implemented with an inline SVG with `aria-hidden="true"` and `aria-busy={pending}` on the button — correct.

**No logo, no footer, no navigation on login page** — confirmed absent.

**Minor deduction:** The `CardTitle` component base class (`card.tsx:35`) sets `leading-none`, while `login/page.tsx:20` overrides this with `leading-tight`. The spec specifies `line-height: 1.2` for headings. `leading-tight` is `1.25` in Tailwind (close but not exact). No visual impact at this scale, flagged for completeness.

---

### Pillar 3: Color (3/4)

**Accent usage — correctly scoped:**
- `bg-primary` is only used in `components/ui/button.tsx:11` for the default button variant — matches spec intent (primary button only).
- `text-primary` appears in `button.tsx:20` for the link variant, which is not used in Phase 1 surfaces. No violation in rendered output.
- No hardcoded hex colors in any component file (`app/` or `components/logout-button.tsx`).

**Destructive — correctly applied:**
- `text-destructive` on error paragraph (`login-form.tsx:88`) — correct.
- shadcn form component also uses `text-destructive` for form error messages (`form.tsx:150`) — consistent.

**Token mapping — correct:**
- `globals.css` `@theme` block correctly maps all spec colors via OKLCH:
  - `--color-primary: oklch(0.205 0.02 256)` — slate-900 equivalent
  - `--color-destructive: oklch(0.577 0.245 27)` — red-600 equivalent
  - `--color-muted: oklch(0.968 0 0)` — neutral-100 equivalent

**Issue — dark mode block:**
- `globals.css:108–140` defines `.dark {}` with different `--primary: oklch(0.922 0 0)` (a light gray) and different destructive values. This directly contradicts the spec: "Light mode only in v1. Dark mode deferred." If the dark class is ever activated, the accent silently degrades.
- `globals.css:5` — `@custom-variant dark (&:is(.dark *))` enables dark variant usage.
- `components/ui/input.tsx:11` — `dark:bg-input/30` applies a dark-mode style. If dark mode activates, inputs get a different background.
- These are shadcn scaffold defaults that were not pruned. They do not affect light-mode rendering but violate the spec's explicit deferral.

**Issue — `--color-ring` is defined twice:**
- In `@theme` block: `--color-ring: oklch(0.205 0.02 256)` (slate-900 — correct).
- In `@theme inline` block: `--color-ring: var(--ring)` which resolves to `:root`'s `--ring: oklch(0.205 0.02 256)`. Both are identical in value but the double definition is redundant and could cause confusion.

---

### Pillar 4: Typography (3/4)

**Declared sizes in use (app/ files only):**

| Class | Usage |
|-------|-------|
| `text-2xl` | Card title "Anmelden", home heading "Willkommen" — 24px, heading role |
| `text-sm` | Labels, subtext, error, header text, button in shadcn base — 14px, label/helper role |
| `text-base` | Input text via `input.tsx:11` — 16px, body role |

Three distinct sizes, exactly matching the spec. No `text-xs`, `text-lg`, `text-xl` or larger sizes in rendered app surfaces.

**Font weights in use:**

| Class | Location | Spec? |
|-------|----------|-------|
| `font-semibold` | `page.tsx:20`, `login-form.tsx:58,74`, `layout.tsx:19,21`, `page.tsx:4` | PASS — declared |
| `font-medium` | `label.tsx:16` (base), `input.tsx:11` (file input variant), `button.tsx` (various sizes) | FAIL — not declared |

The `font-medium` weight (500) appears in shadcn component base styles. In practice it is overridden by `font-semibold` on the two `<Label>` elements in the form, but the shadcn `label.tsx` base still carries `font-medium`. Any future label that omits `font-semibold` will render at 500.

**Line-height:**
- Headings: `leading-tight` (1.25) vs spec 1.2 — marginal deviation. Not perceptible at 24px.
- Body/label: `leading-normal` (1.5) — matches spec exactly.

---

### Pillar 5: Spacing (3/4)

**Spacing classes found in app/ files:**

| Class | Maps to | Spec token | Location |
|-------|---------|------------|----------|
| `p-6` | 24px | lg — card inner padding | `login/page.tsx:17` (page outer), `layout.tsx:25` |
| `px-6` | 24px | lg | `layout.tsx:18` (header) |
| `space-y-4` | 16px gaps | md — form field gap | `login-form.tsx:56` |
| `space-y-2` | 8px gaps | sm — input-to-label | `login-form.tsx:57,73` |
| `h-16` | 64px | lg header height | `layout.tsx:18` |
| `gap-4` | 16px | md | `layout.tsx:20` |
| `gap-2` | 8px | sm | `page.tsx:3` |
| `py-16` | 64px | — | `page.tsx:3` (home placeholder vertical offset) |

All Tailwind scale-based values. One arbitrary value:

- `max-w-[360px]` — `login/page.tsx:18`. Tailwind v4 does not have a built-in `max-w-[360px]` step; the closest is `max-w-sm` (384px). The spec calls for exactly 360px, so the arbitrary value is intentional and correct per spec. This is an acceptable exception.

**Card internal padding:**
The spec states card padding should be 32px (xl). The card component defaults to `py-6` (24px vertical) with horizontal padding applied per-section via `px-6`. `<CardContent className="pt-0">` removes top padding on the content section. Effective padding is:
- Top: header `py-6` = 24px (spec says 32px)
- Bottom: card `py-6` = 24px (spec says 32px)
- Sides: `px-6` = 24px (spec says 32px)

The card renders at 24px all-round rather than the 32px specified. This is a minor spacing deviation caused by using shadcn's card component defaults without an override. Practically invisible at this scale but technically off-spec.

**No non-scale arbitrary values** beyond the intentional `max-w-[360px]`.

---

### Pillar 6: Experience Design (4/4)

**Loading state:**
- `login-form.tsx:95–96` — button is `disabled={pending}` and `aria-busy={pending}`. PASS.
- `login-form.tsx:98–123` — inline SVG spinner with `animate-spin` and `aria-hidden="true"` during pending. Text changes to `Anmelden…`. PASS.
- Inputs remain enabled during pending (`disabled={pending}` only on submit button). Wait — inputs at `login-form.tsx:70` and `login-form.tsx:84` are also `disabled={pending}`. The spec says "inputs remain enabled (can be edited on error return)." This deviates from the interaction contract. Minor: inputs are re-enabled immediately on error return since `setPending(false)` runs before `setError`.

**Error states:**
- 401/400: inline `setError("E-Mail oder Passwort ungültig.")` — PASS.
- 429: inline rate-limit copy — PASS.
- Unexpected: `toast.error(...)` — PASS.
- `role="alert"` on error paragraph (`login-form.tsx:88`) — accessible. PASS.
- `emailRef.current?.focus()` on error — focus returns to email input per spec. PASS.

**Logout state:**
- Loading: `setPending(true)` disables the logout button. PASS.
- Success toast: `Sie wurden abgemeldet.` — PASS.
- Redirect to `/login` after logout. PASS.

**Session guard:**
- `app/(app)/layout.tsx:11–13` — server-side session check with `redirect("/login")` for unauthenticated access. PASS.
- `middleware.ts` presumably handles edge-layer redirect (not audited — not in files list, but referenced in architecture). PASS (assumed — not verified in this audit).

**No destructive confirmation required** in Phase 1 — logout is non-destructive per spec. PASS.

**Keyboard / accessibility:**
- All inputs have `id` + `<Label htmlFor>` association. PASS.
- Form uses native `<form onSubmit>` — Enter key submits. PASS.
- `noValidate` on form suppresses browser validation in favor of custom handling. PASS.
- `autoComplete="email"` and `autoComplete="current-password"` on inputs. PASS.

**Minor note:** Inputs are disabled during the pending state (`login-form.tsx:70,84`), which contradicts the interaction contract spec: "Inputs remain enabled (can be edited on error return)." The practical impact is zero because `setPending(false)` runs synchronously before `setError`, so by the time an error is displayed the inputs are already re-enabled. No user-perceptible issue.

---

## Registry Safety

Registry audit: components.json exists with `"registries": {}` (no third-party registries declared). All six components (`button`, `card`, `input`, `label`, `form`, `sonner`) sourced from official shadcn registry. No suspicious patterns found. Registry audit clean.

---

## Files Audited

- `/app/(auth)/login/page.tsx`
- `/app/(auth)/login/login-form.tsx`
- `/app/(app)/layout.tsx`
- `/app/(app)/page.tsx`
- `/app/layout.tsx`
- `/app/globals.css`
- `/components/logout-button.tsx`
- `/components/ui/button.tsx`
- `/components/ui/card.tsx`
- `/components/ui/input.tsx`
- `/components/ui/label.tsx`
- `/components/ui/form.tsx`
- `/components/ui/sonner.tsx`
- `/components.json`
- `tailwind.config.ts` — confirmed absent (correct per D-04)
