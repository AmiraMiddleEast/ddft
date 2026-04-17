---
phase: 03-review-authority-lookup
plan: 03
subsystem: behoerden-resolver
tags: [resolver, slug, fuzzy-match, drizzle, unit-tests, tdd, pure-function]

# Dependency graph
requires:
  - phase: 03-review-authority-lookup
    provides: "Plan 03-01 Drizzle schema (behoerdenState, behoerdenRegierungsbezirk, behoerdenDocumentType, behoerdenAuthority) + fastest-levenshtein dep"
provides:
  - "lib/behoerden/slug.ts: slugify(s) — deterministic German-aware slug normalizer (umlaut/eszett/soft-hyphen/NFKD)"
  - "lib/behoerden/city-to-regierungsbezirk.ts: CITY_TO_REGIERUNGSBEZIRK map (BY=47, BW=31, HE=22, NRW=41 cities; both umlaut + ASCII) + cityToRegierungsbezirk(city, stateSlug)"
  - "lib/behoerden/resolve.ts: resolveAuthority(input, db) — pure routing function returning discriminated union {matched, ambiguous, not_found}; fuzzy threshold min(2, floor(len/4))"
  - "lib/behoerden/queries.ts: listDocumentTypes() + listStates() — server-only dropdown loaders for Plan 05"
  - "__tests__/_fixtures/behoerden-mini.json: synthetic 3-state / 5-doctype / 7-authority fixture used by resolve.test.ts"

affects: [03-04 server action, 03-05 review page dropdowns, 03-06 integration tests]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure resolver (no auth/persistence/IO) — Server Action in Plan 04 will wrap with auth + document_review write"
    - "Discriminated-union return type keyed by `status` — exhaustive-match in callers, three reason codes under `not_found`"
    - "In-memory better-sqlite3 DDL + fixture JSON load in test beforeAll (no drizzle-kit push subprocess) — avoids parallel-test flakiness"
    - "Fuzzy threshold = min(FUZZY_MAX=2, floor(slug.length/4)) — Pitfall 6 guard keeps short inputs strict"
    - "Unknown RBz city → ambiguous (not not_found) — Pitfall 4 routing"

key-files:
  created:
    - "lib/behoerden/slug.ts"
    - "lib/behoerden/slug.test.ts"
    - "lib/behoerden/city-to-regierungsbezirk.ts"
    - "lib/behoerden/resolve.ts"
    - "lib/behoerden/resolve.test.ts"
    - "lib/behoerden/queries.ts"
    - "__tests__/_fixtures/behoerden-mini.json"
    - ".planning/phases/03-review-authority-lookup/deferred-items.md"
  modified: []

key-decisions:
  - "Test-DB uses raw sqlite.exec(DDL) rather than drizzle-kit push — hermetic, fast, no subprocess contention"
  - "City map includes BOTH umlaut escapes and ASCII transliterations under the same stateSlug — user-typed `Muenchen` or `München` both hit"
  - "Regierungsbezirk routing only when stateRow.hatRegierungsbezirke=true — states without RBz query for regierungsbezirk_id IS NULL"
  - "Fallback when filtered authority set empty but (state, doc) union non-empty → ambiguous with full list — operator picks"
  - "Resolver accepts db as second argument (not imported) so tests inject in-memory DB without vi.mock"
  - "Threshold uses slugified candidate length (not raw), matching research §D"

patterns-established:
  - "Pure library functions in lib/<domain>/ colocated with *.test.ts"
  - "Test fixtures under __tests__/_fixtures/ shared across plans"
  - "Discriminated union with explicit `status` discriminant + narrow-check helper pattern in tests"

requirements-completed: [LKUP-01, LKUP-02, LKUP-03, LKUP-04]

# Metrics
duration: 8min
completed: 2026-04-17
---

# Phase 3 Plan 3: Resolver Library Summary

Pure German-aware authority resolver (`slugify` + city→RBz map + `resolveAuthority` + dropdown loaders) with 22 behavior tests green over a synthetic SQLite fixture — the TDD core that Plan 04's Server Action will wrap.

## What Shipped

### `lib/behoerden/slug.ts`

`slugify(input): string` — the project's single German-aware normalizer. Handles:

- `ä → ae`, `ö → oe`, `ü → ue`, `ß → ss` before Unicode NFKD (case matters — NFKD would decompose umlauts into base + combining accents that then get stripped, losing the German transliteration).
- Soft hyphen `U+00AD` stripped (common in German PDFs).
- Collapses runs of non-`[a-z0-9]` into a single `-`, then strips leading/trailing dashes.
- Idempotent: `slugify(slugify(x)) === slugify(x)`.
- 11 tests cover upper-case umlauts, soft hyphen, eszett, dash collapsing, trimming.

### `lib/behoerden/city-to-regierungsbezirk.ts`

Hardcoded `CITY_TO_REGIERUNGSBEZIRK: Record<stateSlug, Record<cityLower, rbzName>>` covering the four RBz-routed states:

| State | Cities | Notes |
|---|---|---|
| Bayern | 47 | 7 RBz (Ober/Nieder-Bayern, Oberpfalz, Ober/Mittel/Unterfranken, Schwaben) |
| Baden-Württemberg | 31 | 4 RBz (Stuttgart, Karlsruhe, Freiburg, Tübingen) |
| Hessen | 22 | 3 RBz (Darmstadt, Gießen, Kassel) |
| Nordrhein-Westfalen | 41 | 5 RBz (Düsseldorf, Köln, Münster, Detmold, Arnsberg) |

Both umlaut and ASCII spellings included (`münchen` and `muenchen` both map to `Oberbayern`). `cityToRegierungsbezirk(city, stateSlug)` trims + lowercases before lookup; returns `null` for unknown state or city.

### `lib/behoerden/resolve.ts`

`resolveAuthority(input: ResolverInput, db: ResolverDb): Promise<ResolverResult>` — pure routing function:

```ts
type ResolverResult =
  | { status: "matched"; authority: AuthorityRow; routing_path: string[];
      special_rules: string | null; needs_review: boolean }
  | { status: "ambiguous"; candidates: AuthorityRow[]; routing_path: string[] }
  | { status: "not_found";
      reason: "unknown_state" | "unknown_doc_type" | "no_authority_for_combination" }
```

Algorithm (matches research §Pattern 2):

1. Slugify `bundesland`; exact-match against `behoerden_state.id`. Miss → `not_found` / `unknown_state`.
2. Slugify `dokumenten_typ`; compute `distance()` against every `behoerden_document_type.id` via `fastest-levenshtein`; pick min. If `dist > min(FUZZY_MAX=2, floor(candidateSlug.length / 4))` → `not_found` / `unknown_doc_type` (Pitfall 6).
3. If state has RBz: look up city in `CITY_TO_REGIERUNGSBEZIRK`; join to `behoerden_regierungsbezirk` by `(state_id, slug)` to get `rbzId`. Unknown city → `rbzId = null` (triggers Pitfall 4 ambiguous branch).
4. Query authorities:
   - known `rbzId` → exact match on `regierungsbezirk_id`
   - state has RBz but city unknown → no RBz filter (all candidates returned, ambiguous)
   - state has no RBz → `regierungsbezirk_id IS NULL`
5. `authorities.length === 1` → `matched` (surface `special_rules` and `needs_review`). `> 1` → `ambiguous`. `=== 0` with state+doc existing anywhere → `ambiguous`. Otherwise → `not_found` / `no_authority_for_combination`.

Zero side effects: no writes, no external network, no console output, no auth. Tests pass a Drizzle DB handle as second argument.

### `lib/behoerden/resolve.test.ts`

11 behavior cases (one more than required) run over a fresh in-memory better-sqlite3 seeded from the mini fixture. Raw `sqlite.exec(DDL)` for the four Behörden tables — no `drizzle-kit push` subprocess, so tests are hermetic and fast (~600ms cold).

Coverage matrix:

| # | Input | Expected |
|---|---|---|
| 1 | Approbationsurkunde + Bayern + München | matched a1 (Oberbayern), routing_path=[Bayern, Oberbayern, Approbationsurkunde] |
| 2 | Approbationsurkunde + Bayern + Augsburg | matched a2 (Schwaben), needs_review=true |
| 3 | Approbationsurkunde + Bayern + Kleinsdorf (unknown city) | ambiguous [a1, a2] — Pitfall 4 |
| 4 | Geburtsurkunde + Berlin + Berlin | matched a4 (no RBz) |
| 5 | Fuehrungszeugnis + Berlin + Berlin | matched, special_rules contains "Apostille" |
| 6 | Reisepass + Hamburg + Hamburg | matched, special_rules contains "keine Legalisation" |
| 7 | Geburtsurkunde + Atlantis + Nowhere | not_found / unknown_state |
| 8 | Zauberurkunde + Berlin + Berlin | not_found / unknown_doc_type |
| 9 | Geburturkunde (1-char typo) + Berlin | matched (fuzzy within threshold) |
| 10 | Wohnsitzbescheinigung + Berlin | not_found / unknown_doc_type — Pitfall 6 false-positive guard |
| 11 | Heiratsurkunde + Berlin + Berlin | not_found / no_authority_for_combination |

### `lib/behoerden/queries.ts`

Two `server-only` dropdown loaders:

- `listDocumentTypes()` — returns `{id, displayName}[]` sorted by `displayName`.
- `listStates()` — returns `{id, name}[]` sorted by `name`.

No ownership check (Behörden data is reference data, not user-owned).

### `__tests__/_fixtures/behoerden-mini.json`

Synthetic 3-state fixture: **Bayern** (RBz: Oberbayern, Schwaben), **Berlin**, **Hamburg**; 5 doc types; 7 authorities. Includes:

- Two Approbationsurkunde authorities in different Bayern RBz (enables ambiguous-multi test)
- Fuehrungszeugnis + Reisepass rows with non-null `special_rules`
- One `needs_review=true` row

## Verification

- `npx vitest run lib/behoerden` — **2 files, 22/22 tests green** (11 slug + 11 resolver).
- `npx tsc --noEmit` — **clean** (no errors).
- `npx vitest run --no-file-parallelism` — **18/18 files, 79/79 tests green**.

## Deviations from Plan

### Auto-fixed

**1. [Rule 3 - Blocking] Duplicate map keys in city-to-regierungsbezirk.ts**
- Found during: Task 4 (`tsc --noEmit` verify)
- Issue: `gütersloh` (raw umlaut) and `"g\u00fctersloh"` (escaped) parsed to the same object key, triggering `TS1117 An object literal cannot have multiple properties with the same name` for the Detmold and Arnsberg entries.
- Fix: dropped the raw-umlaut literal keys; kept the explicit `\u00fc`-escape form alongside the ASCII transliteration. Both umlaut spellings still work because the escape sequence decodes at lex time.
- Files modified: `lib/behoerden/city-to-regierungsbezirk.ts`
- Commit: `bac35e5`

**2. [Rule 3 - Blocking] Task 3 `<read_first>` referenced `__tests__/setup.ts` test-DB pattern — used in-memory DDL instead**
- Found during: Task 3 RED (designing beforeAll scaffold)
- Issue: `__tests__/_fixtures/test-db.ts::createTestDb()` spawns `npx drizzle-kit push` as a subprocess. Running that from a new unit test would add 2-5s cold start and compound the existing parallel-test timeouts (see deferred-items).
- Fix: `resolve.test.ts` creates `new Database(":memory:")` and applies 8 hand-written `CREATE TABLE/INDEX` statements covering only the four Behörden tables, then inserts fixture rows via parameterized `sqlite.prepare().run()`. Test runtime ~600ms cold.
- Files modified: `lib/behoerden/resolve.test.ts`
- Commit: `92371b6`

## Deferred Issues

### Parallel-test flakiness (pre-existing)

Full `npx vitest run` sees 4 files time out at `beforeAll` because of subprocess contention in `createTestDb()`. Running with `--no-file-parallelism` green across 18/18 files. Not caused by Plan 03-03 (reproducible on `main`). Logged to `.planning/phases/03-review-authority-lookup/deferred-items.md` with a suggested in-process DDL loader fix.

## Threat Flags

None. The only new runtime surface is the pure resolver, which:

- Accepts already-slugified identifiers — injection-safe (slugify strips non-`[a-z0-9-]`).
- Uses Drizzle's parameterized `eq()`/`isNull()` predicates throughout — no raw SQL concatenation.
- Has no network I/O, no logging, no filesystem access, no secrets.

The plan's existing `<threat_model>` mitigations (T-03-03-01 slugify sanitization, T-03-03-02 bounded Levenshtein, T-03-03-03 public reference data) are all honored by the implementation.

## Commits

- `5572098` feat(03-03): add slugify helper with umlaut/eszett/soft-hyphen handling
- `51d62fe` feat(03-03): add city-to-Regierungsbezirk map + resolver fixture
- `92371b6` feat(03-03): add pure resolveAuthority + 11 behavior tests
- `bac35e5` feat(03-03): add listDocumentTypes/listStates queries + dedup city map

## Self-Check: PASSED

All 8 declared files found on disk. All 4 declared commits found in git log.
