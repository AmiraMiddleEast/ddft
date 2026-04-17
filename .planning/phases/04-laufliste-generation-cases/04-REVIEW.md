---
phase: 04-laufliste-generation-cases
status: issues_found
files_reviewed: 18
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
reviewed_at: 2026-04-17
reviewer: claude-opus-4 (executor inline)
---

# Phase 4 — Code Review Report

Reviewed all Phase 4 source files introduced across plans 04-01 through 04-06. Checks applied: auth bypasses, SQL safety (parameterization / ownership predicates), Server Action ownership gates, PDF filename injection (CRLF / quote smuggling in Content-Disposition), concurrent Laufliste generation race, storage path traversal, missing error handling.

## Files Reviewed

1. `lib/cases/actions.ts`
2. `lib/cases/queries.ts`
3. `lib/validations/case.ts`
4. `lib/laufliste/actions.ts`
5. `lib/laufliste/queries.ts`
6. `lib/laufliste/build-input.ts`
7. `lib/laufliste/storage.ts`
8. `lib/laufliste/slug.ts`
9. `lib/laufliste/pdf/render.ts`
10. `lib/laufliste/pdf/Document.tsx`
11. `lib/laufliste/pdf/sections.tsx`
12. `lib/laufliste/endbeglaubigung.ts`
13. `lib/laufliste/embassy.ts`
14. `app/api/cases/[id]/laufliste/[lauflisteId]/download/route.ts`
15. `app/(app)/cases/page.tsx`
16. `app/(app)/cases/new/CreateCaseForm.tsx`
17. `app/(app)/cases/[id]/page.tsx`
18. `app/(app)/cases/[id]/CaseDetailClient.tsx`
19. `app/(app)/cases/[id]/DocumentsTable.tsx`
20. `app/(app)/cases/[id]/AddDocumentsSheet.tsx`

## Findings

### [WARNING] R-04-01 — Download route lacks path-containment check

**File:** `app/api/cases/[id]/laufliste/[lauflisteId]/download/route.ts` (lines 52-54)

**Observation:**
```ts
const abs = path.isAbsolute(row.pdfStoragePath)
  ? row.pdfStoragePath
  : path.resolve(process.cwd(), row.pdfStoragePath);
// ... readFile(abs) ...
```

`row.pdfStoragePath` comes from the `laufliste.pdf_storage_path` column, which is written by `writeLauflisteToDisk` as `path.relative(cwd, path.join(LAUFLISTEN_DIR, …))`. In normal operation this is always inside `data/lauflisten/`. However:

- If the DB were ever polluted (backup restore, admin SQL, future migration bug, or a Phase 5 import path) with a value like `../../etc/passwd`, this route would dutifully `readFile` that path and stream it back to the owning user.
- Threat model T-04-25 is mitigated because paths are currently server-generated — but the mitigation lives one layer away (storage writer), not at the read-side boundary.

**Severity:** warning — defense-in-depth gap. Not exploitable today because the only code path that writes `pdfStoragePath` is `writeLauflisteToDisk` with a server-generated UUID caseId. Becomes exploitable if future code ever writes the column from untrusted input (admin import, bulk restore, migration).

**Proposed fix:** Add a containment check after path resolution; 410 if escape detected.

### [INFO] R-04-02 — Storage writer does not defend its own boundary

**File:** `lib/laufliste/storage.ts` (line 34)

**Observation:**
```ts
const abs = path.join(LAUFLISTEN_DIR, `${caseId}-${ts}.pdf`);
```

`caseId` comes from `generateLauflisteAction(caseId)` where the argument is user-supplied (Server Action input). If `caseId = "../foo"`, `path.join` would resolve outside `LAUFLISTEN_DIR`.

**Why not exploitable:** before reaching `writeLauflisteToDisk`, `generateLauflisteAction` calls `buildLauflisteInput(caseId, userId, db)`, which runs a SQL `WHERE caseTable.id = caseId AND caseTable.userId = userId` lookup. A caseId of `../foo` would fail that lookup (no matching row) and return `NOT_FOUND` before storage is reached.

**Severity:** info — redundant guard. The SQL equality predicate already blocks this; adding a basename/length assertion inside the storage writer would be pure defense-in-depth.

**Proposed fix:** Optional — assert `caseId` contains only `[a-zA-Z0-9-]` or is a valid UUID inside the storage helper.

### [INFO] R-04-03 — `isUniqueViolation` catches non-unique SQLite constraints too

**File:** `lib/cases/actions.ts` (lines 44-52)

**Observation:**
```ts
function isUniqueViolation(err: unknown): boolean {
  ...
  return (
    code === "SQLITE_CONSTRAINT_UNIQUE" ||
    code === "SQLITE_CONSTRAINT_PRIMARYKEY" ||
    code === "SQLITE_CONSTRAINT"          // ← umbrella code
  );
}
```

The bare `SQLITE_CONSTRAINT` umbrella code also fires for FK, CHECK, NOT NULL violations. `addDocumentsToCaseAction` would then map any of those to `DOC_ALREADY_ASSIGNED` with a misleading `details.documentId`. In current schema (one compound unique on `case_document.document_id`), the only realistic constraint failures during an insert are unique + FK. An FK failure would be surprising and deserve its own branch.

**Severity:** info — observability concern. Would surface as a confusing error in a rare failure mode.

**Proposed fix:** Drop the umbrella `SQLITE_CONSTRAINT` code from the guard; keep `SQLITE_CONSTRAINT_UNIQUE` and `SQLITE_CONSTRAINT_PRIMARYKEY` only.

## Items Checked — No Finding

| Check | Result |
| ----- | ------ |
| Auth bypass in any Server Action | Every action has `auth.api.getSession` short-circuit |
| SQL injection | All queries use Drizzle parameterized builders; no raw SQL with user input |
| Cross-user data leak via queries | All queries take explicit `userId` + ownership predicate; zero-leak policy (null/[] on wrong owner) enforced |
| CRLF/quote injection in Content-Disposition | UTF-8 name strips via `/[^\p{L}\p{N} .\-]/gu`; ASCII name is slug-only `[a-z0-9-]`; both wrapped in `encodeURIComponent` for `filename*=` |
| Concurrent Laufliste generation race | Two concurrent calls produce two laufliste rows with distinct timestamps + distinct files — intentional per D-14 immutability; case.status flip is idempotent |
| Missing validation on Server Action inputs | All four cases actions + generateLauflisteAction validated; Zod before any DB read |
| ID-swap leak in download route | `getLauflisteForDownload` joins on (lauflisteId AND caseId AND userId) — covered by route.test.ts |
| Cache-Control for private PDFs | `private, no-store` set on every 200 response (T-04-27) |
| Filename slug handles umlauts | `slugifyPersonName` expands ß→ss, ä→ae, ö→oe, ü→ue; round-trip verified in integration test |
| ownership check ordering | Session → Zod → ownership predicate → mutation (no DB reads before auth) |

## Recommendation

Proceed with Phase 4 exit gate. The one warning is defense-in-depth and not exploitable today; both info items are observability nits. All apply to correctness under future changes — worth fixing but not phase-blocking.
