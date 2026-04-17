---
phase: 05-history-reupload-admin
status: issues_found
files_reviewed: 19
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
reviewed_at: 2026-04-17
reviewer: claude-opus-4 (executor inline)
---

# Phase 5 — Code Review Report

Reviewed all Phase 5 source files introduced across plans 05-01 through 05-05. Checks
applied: auth bypasses on every admin Server Action, path traversal on version file
serving, Zod validation coverage, ownership gates on re-upload and re-analyze,
cross-user isolation in history queries, SQL safety, open-redirect / CRLF on nav,
DB transaction atomicity for version archival.

## Files Reviewed

1. `db/schema.ts` (documentVersion + document.version additions)
2. `lib/history/queries.ts`
3. `lib/uploads/replace.ts`
4. `lib/extraction/reanalyze.ts`
5. `lib/admin/queries.ts`
6. `lib/admin/actions.ts`
7. `lib/validations/admin.ts`
8. `app/(app)/history/page.tsx`
9. `app/(app)/history/HistoryFilters.tsx`
10. `app/(app)/admin/behoerden/page.tsx`
11. `app/(app)/admin/behoerden/authorities/page.tsx`
12. `app/(app)/admin/behoerden/authorities/AuthoritiesFilters.tsx`
13. `app/(app)/admin/behoerden/authorities/[id]/edit/page.tsx`
14. `app/(app)/admin/behoerden/authorities/[id]/edit/EditAuthorityForm.tsx`
15. `app/(app)/admin/behoerden/document-types/page.tsx`
16. `app/(app)/admin/behoerden/document-types/DocumentTypesClient.tsx`
17. `app/(app)/documents/[id]/_components/ReplaceScanDialog.tsx`
18. `app/(app)/documents/[id]/_components/ReanalyzeButton.tsx`
19. `app/(app)/layout.tsx` (nav link additions)

## Findings

### [WARNING] R-05-01 — Existing PDF serve route still lacks path-containment check

**File:** `app/api/documents/[id]/pdf/route.ts` (lines 21-27)

**Observation:**

```ts
const abs = path.isAbsolute(doc.storagePath)
  ? doc.storagePath
  : path.resolve(process.cwd(), doc.storagePath);
// ... readFile(abs) ...
```

This route was introduced in Phase 2 and is unchanged in Phase 5, but Phase 5 adds a
NEW code path that writes to `document.storagePath` — namely `replaceDocumentPdfAction`
in `lib/uploads/replace.ts`. The new writer follows the same server-generated pattern
(`path.join(UPLOADS_DIR, \`\${documentId}-v\${newVersion}.pdf\`)`), so today there is
no escape vector. But Phase 5 adds a second write site, and a future version-restore
admin action or bulk import would be another one. The read-side of this route has no
containment guard — same finding as Phase 4's R-04-01 download route.

**Severity:** warning — defense-in-depth gap. Not exploitable today because every
writer is server-generated; becomes exploitable if future code ever writes the column
from untrusted input.

**Proposed fix:** After resolving `abs`, assert `abs.startsWith(path.resolve(UPLOADS_DIR) + path.sep)`
or equivalent; respond 410 if the check fails. Mirror the hardening already applied
to the Laufliste download route.

### [INFO] R-05-02 — `replaceDocumentPdfAction` writes bytes BEFORE the DB transaction

**File:** `lib/uploads/replace.ts` (lines 78-115)

**Observation:** The action writes the new file to disk (`fs.writeFile(absPath, bytes)`)
and THEN attempts the archive+bump transaction. If the process is killed between
the write and the transaction, an orphan file is left in `data/uploads/`. The action
has a best-effort `fs.unlink` in the catch branch for synchronous DB failures
(handled correctly), but not for a crash/kill between the two awaits.

**Severity:** info — this is a minor disk-hygiene issue. It never corrupts data or
exposes the wrong file (the `document.storagePath` column wasn't updated). The worst
case is a stray N-KB file named `{id}-v2.pdf`. The dedup upload path has the same
shape — this is not a Phase 5 regression.

**Proposed fix:** Optional — swap the order so the transaction runs first against a
pre-allocated filename (collision-free via `randomUUID` scheme), then writes bytes;
delete via admin cleanup if the post-tx write fails. Not worth the complexity at v1.

### [INFO] R-05-03 — Admin `listAuthoritiesAdmin` conditions array typed with `ReturnType<typeof eq>`

**File:** `lib/admin/queries.ts` (line 97)

**Observation:**

```ts
const conditions = [] as ReturnType<typeof eq>[];
```

The array holds both `eq(...)` and `like(...)` results — both resolve to the same
runtime `SQL` object, but `ReturnType<typeof eq>` is narrower than what's pushed.
Drizzle's combinator (`and(...conditions)`) accepts any SQL/Condition, so this
compiles and runs correctly; the type is just under-precise. Same pattern already
exists in Phase 2-4 code.

**Severity:** info — typing precision only. No behavioral impact.

**Proposed fix:** Type as `SQL[]` from `drizzle-orm`. Cosmetic.

## Items Checked — No Finding

| Check | Result |
| ----- | ------ |
| Auth on every admin Server Action | All three (`updateAuthorityAction`, `createDocumentTypeAction`, `updateDocumentTypeAction`) short-circuit on missing session BEFORE any DB read. Admin page.tsx components also gate on session. |
| Auth on `replaceDocumentPdfAction` + ownership | Session gate + `WHERE document.id = id AND document.userId = session.user.id` compound predicate; cross-user returns `not_found` (zero-leak). |
| Auth on `reanalyzeDocumentAction` + ownership | Same pattern as replace — session gate + compound predicate; reset transaction uses same predicate on UPDATE. |
| Zod validation on every Server Action input | `AuthorityPatchSchema`, `DocumentTypeSchema` applied via `safeParse`; `replaceDocumentPdfAction` validates file via `validatePdf` (magic bytes + encryption); `reanalyzeDocumentAction` takes only a documentId (validated by DB lookup). |
| Cross-user isolation in `listLauflistenHistoryForUser` | INNER JOIN `laufliste` ↔ `case` with `WHERE case.userId = userId`; umlaut-safe `LOWER()` LIKE. Verified in integration test (user B cannot see user A's rows). |
| SQL injection | All Drizzle parameterized builders; LIKE queries bind the query string as a parameter (not interpolated). |
| Version archive atomicity | `replaceDocumentPdfAction` uses `db.transaction((tx) => ...)` synchronously wrapping BOTH `insert documentVersion` (old row) AND `update document` (new row). Either both land or neither. Tested in `lib/uploads/replace.test.ts`. |
| Orphan file on DB failure (replace) | `try/catch` around transaction; `fs.unlink` in catch removes the newly-written file. |
| Stale extraction rows on reanalyze | `reanalyzeDocumentAction` wraps `delete extraction + update document` in one `db.transaction`; then delegates to `extractDocumentAction` which writes fresh rows. |
| Filename/slug injection in `document_version.storage_path` | Server-generated `{documentId}-v{newVersion}.pdf` where documentId is a DB-owned UUID and newVersion is arithmetic (`currentVersion + 1`). No user input reaches the filename. |
| Nav link injection / open-redirect | Both new `<Link href="/history">` and `<Link href="/admin/behoerden">` are static strings in the layout. |
| Discriminated-union error shapes | All new actions return `{ ok: true, ... } | { ok: false, error: '...' }` — matches Phase 2-4 convention; never throws for user errors. |
| Rate-limit / flooding on re-upload | File size cap enforced client-side (dropzone) AND server-side (validatePdf); PDF validation rejects before any disk write; SHA-256 isn't recomputed against prior version because version bump is intentional. No concern. |
| SQL constraint error mapping in admin | `createDocumentTypeAction` maps only `SQLITE_CONSTRAINT_PRIMARYKEY` + `SQLITE_CONSTRAINT_UNIQUE` to `DUPLICATE`; NOT the umbrella `SQLITE_CONSTRAINT` (avoids R-04-03 pitfall). |
| Admin page session gates | Every `app/(app)/admin/behoerden/*/page.tsx` calls `auth.api.getSession`; the outer `(app)/layout.tsx` is the first line of defense (Phase 1 D-12). |

## Recommendation

Proceed with Phase 5 exit gate. The one warning (R-05-01) is defense-in-depth that
mirrors the Phase 4 path-containment gap; it is not exploitable today because every
writer is server-generated, and fixing it is one `startsWith` assertion worth of
code. Both info items are typing/hygiene nits.

No critical findings. No fix-before-merge blockers. Phase 5 is shippable as-is;
R-05-01 can be addressed alongside the Phase 4 variant in a cross-cutting security
hardening pass.
