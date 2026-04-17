---
phase: 04-laufliste-generation-cases
plan: 02
subsystem: cases-data-layer
tags: [cases, server-actions, queries, drizzle, sqlite, tdd, zod]

requires:
  - phase: 04-laufliste-generation-cases
    plan: 01
    provides: caseTable + caseDocument + laufliste Drizzle tables with D-02 uniqueIndex
  - phase: 03-review-authority-lookup
    provides: documentReview approvals + lookupStatus (consumed by listCaseDocuments + assignable filter)
  - phase: 02-document-upload-ai-extraction
    provides: document table + review_status enum (assignable gate)
  - phase: 01-foundation-authentication
    provides: auth.api.getSession + better-auth sessions (every action auth gate)

provides:
  - listCasesForUser(userId, db?) — owner-scoped listing ordered by updated_at DESC
  - getCaseForUser(caseId, userId, db?) — null-safe ownership-scoped fetch
  - listCaseDocuments(caseId, userId, db?) — joined position-ordered rows (case_document+document+documentReview)
  - listAssignableDocuments(userId, db?) — NOT EXISTS filter on case_document (approved + extracted + unowned cases excluded)
  - createCaseAction({ personName, personBirthdate?, notes? })
  - addDocumentsToCaseAction({ caseId, documentIds[] })
  - removeDocumentFromCaseAction({ caseId, caseDocumentId })
  - reorderCaseDocumentsAction({ caseId, caseDocumentId, direction })

affects:
  - 04-03-pdf-generation — will consume getCaseForUser + listCaseDocuments for PDF inputs
  - 04-04-add-docs-picker — will consume listAssignableDocuments + addDocumentsToCaseAction
  - 04-05-case-detail-ui — will consume all queries + all four actions
  - 04-06-download-history — will consume getCaseForUser for ownership gate

tech-stack:
  added: []
  patterns:
    - "Server Actions accept plain-object input (not FormData) — mirrors Phase 2 + Phase 3 convention"
    - "Discriminated-union return { ok:true, data } | { ok:false, error, details? } — never throw for user errors"
    - "Sync better-sqlite3 db.transaction(tx => ...) with .run()/.all() — async callback would throw 'cannot return a promise'"
    - "Three-step parking-sentinel swap (pos=-1) for reorder — stays correct if a compound UNIQUE(case_id, position) is ever added"
    - "Parking-sentinel renumber for remove — same reason"
    - "NOT EXISTS correlated subquery for listAssignableDocuments — avoids LEFT JOIN/IS NULL + compound-unique tension"
    - "Queries accept db as optional DI parameter — defaults to module client, tests pass fresh in-memory instance"

key-files:
  created:
    - "lib/cases/queries.ts (+157 lines — four owner-scoped reads)"
    - "lib/cases/queries.test.ts (+226 lines — 9 integration tests)"
    - "lib/cases/actions.ts (+401 lines — four Server Actions)"
    - "lib/cases/actions.test.ts (+342 lines — 12 integration tests)"
    - "lib/validations/case.ts (+55 lines — four Zod schemas)"
  modified: []

key-decisions:
  - "Document approval gate is BOTH document.reviewStatus='approved' AND existence of a documentReview row — belt-and-suspenders against a half-written state"
  - "Unique-violation catch maps to DOC_ALREADY_ASSIGNED with details.documentId so the UI can offer a 'move' affordance (04-04 picker)"
  - "Parking-sentinel (position=-1) used for BOTH reorder swap and contiguous renumber — single pattern, future-proof against a compound UNIQUE(case_id, position)"
  - "revalidatePath wrapped in try/catch — no Next render context during test runs, harmless swallow"

metrics:
  duration: 6min
  completed: 2026-04-17
  tasks: 2
  tests: 21
  commits: 2
---

# Phase 4 Plan 02: Cases Data Layer Summary

Built the data-access + mutation layer for cases: four owner-scoped queries and four Server Actions (create/add/remove/reorder) with Zod validation, ownership predicates, and transactional integrity. TDD red/green/refactor; 21 passing integration tests; tsc clean. DB-level D-02 unique constraint is enforced at SQLite and translated into a UI-usable `DOC_ALREADY_ASSIGNED` error with `details.documentId` so Plan 04-04 can offer a move flow.

## What Was Built

### Queries (`lib/cases/queries.ts`)

- **`listCasesForUser(userId, db?)`** — `SELECT ... WHERE user_id = ? ORDER BY updated_at DESC`. Empty array when the user has no cases.
- **`getCaseForUser(caseId, userId, db?)`** — Null on wrong owner. No 403 surface — IDs are unenumerable (T-04-07).
- **`listCaseDocuments(caseId, userId, db?)`** — Inner join `caseDocument × case × document` + left join `documentReview`, ordered by `position ASC`. Wrong-owner case returns `[]`.
- **`listAssignableDocuments(userId, db?)`** — `document` rows where extraction is done AND review is approved AND NOT EXISTS in `case_document`. Ordered by `uploadedAt DESC`. Implements D-04.

### Server Actions (`lib/cases/actions.ts`)

All follow the same prelude:
1. `auth.api.getSession({ headers: await headers() })` → `UNAUTHORIZED` short-circuit.
2. Zod `safeParse` → `VALIDATION` short-circuit BEFORE any DB read.
3. Ownership predicate (`case.userId = session.user.id`) → `NOT_FOUND` on miss.
4. Mutations inside `db.transaction` (sync better-sqlite3 callback).
5. Discriminated-union return — never throws for user errors.
6. `revalidatePath('/cases')` + `/cases/[id]` after mutation.

- **`createCaseAction`** — `{ caseId }` on success. Rejects empty/whitespace `personName` via Zod `trim().min(1)`.
- **`addDocumentsToCaseAction`** — Reads current max position inside the tx, inserts at `max+1..+N`. Catches `SQLITE_CONSTRAINT_UNIQUE` from `case_document_doc_uniq` (D-02) and returns `{ ok:false, error:'DOC_ALREADY_ASSIGNED', details:{ documentId } }` after a post-failure lookup identifies the offending id. Touches `case.updated_at`.
- **`removeDocumentFromCaseAction`** — Deletes the row then renumbers remaining rows to `1..N` via a parking-sentinel (`position=-1`) dance so a future compound `UNIQUE(case_id, position)` can't trip on transient duplicates.
- **`reorderCaseDocumentsAction`** — Three-step swap inside the tx (Pitfall 4 from plan): park target at `-1`, move neighbor into target's slot, move target into neighbor's old slot. Edge no-op (first 'up' / last 'down') returns `{ ok:true, data:{ noop:true } }` without any writes.

### Zod Schemas (`lib/validations/case.ts`)

- `CreateCaseSchema` — `personName` 1..200 (trimmed), `personBirthdate` ISO `yyyy-MM-dd` or empty, `notes` max 2000.
- `AddDocumentsToCaseSchema` — non-empty array of 1..100-char ids, max 50 per call.
- `RemoveDocumentFromCaseSchema`, `ReorderCaseDocumentsSchema` — string-id + direction enum.

## Test Coverage

| File | Tests | Coverage |
|------|-------|----------|
| `lib/cases/queries.test.ts` | 9 | ownership scoping on all four queries + filter correctness |
| `lib/cases/actions.test.ts` | 12 | create VALIDATION/UNAUTHORIZED/happy-path; add positional sequencing + D-02 violation + FORBIDDEN (unowned/unapproved) + NOT_FOUND (unowned case); remove renumbers contiguously; reorder up/down/edge |
| **Total** | **21** | all pass |

D-02 unique violation is exercised end-to-end against an actual SQLite engine via `createTestDb()` + `drizzle-kit push` (not just an app-level pre-check).

## Deviations from Plan

None. Plan executed as written. Minor additions within planner's discretion:

- Added the documentReview-existence check alongside `document.reviewStatus = 'approved'`. The plan only mandated `review_status=approved`; I also asserted the corresponding `documentReview` row exists. Rationale: defence-in-depth against a half-written state (Rule 2 — correctness guard).
- Wrapped `revalidatePath` in try/catch. Without a Next render context (test runs) `revalidatePath` throws; swallowing keeps actions unit-testable without mocking `next/cache` from the caller side (we do mock it in tests regardless).

## Verification

- [x] `npx vitest run lib/cases` — 21/21 passing
- [x] `npx vitest run` — 149/149 total project tests passing (no regressions)
- [x] `npx tsc --noEmit` — zero errors
- [x] `auth.api.getSession` appears in every exported Server Action (5 occurrences)
- [x] `db.transaction` wraps all multi-row mutations (4 occurrences)

## Threat Mitigations (from plan threat_model)

| Threat | Mitigation in code |
|--------|--------------------|
| T-04-05 (S) — unauth caller | Every action starts with `auth.api.getSession` → `UNAUTHORIZED` return |
| T-04-06 (T) — tamper caseId | All mutations verify `caseTable.userId = session.user.id` before any write |
| T-04-07 (I) — enumerate cases | Wrong-owner queries return `null`/`[]`, never 403 |
| T-04-08 (E) — cross-case theft | DB-level `uniqueIndex` on `case_document.document_id` catches races + app-level `DOC_ALREADY_ASSIGNED` surface |
| T-04-09 (T) — tamper person_name | Zod `trim().max(200)`; no HTML stored/rendered in this plan |

## Self-Check: PASSED
- FOUND: lib/cases/queries.ts
- FOUND: lib/cases/queries.test.ts
- FOUND: lib/cases/actions.ts
- FOUND: lib/cases/actions.test.ts
- FOUND: lib/validations/case.ts
- FOUND: bce0dd5 (queries commit)
- FOUND: ea49ce0 (actions commit)
