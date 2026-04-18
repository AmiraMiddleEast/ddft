import "server-only";
import { and, asc, desc, eq, notExists } from "drizzle-orm";

import { db as defaultDb, type Db } from "@/db/client";
import {
  caseTable,
  caseDocument,
  document,
  documentReview,
} from "@/db/schema";

/**
 * Phase 4 Plan 02 — owner-scoped reads for the Cases feature.
 *
 * Every function takes an explicit `userId` and applies a WHERE predicate on
 * the case/user relationship. Wrong owner returns null or an empty array — we
 * never throw and we never respond with 403 so case IDs cannot be enumerated
 * (D-20, T-04-07).
 *
 * Each function accepts `db` as the last argument for test injection. In
 * production callers pass the module-level `db` from `@/db/client`; in tests
 * we pass a fresh in-memory instance seeded per spec.
 */

// ---- listCasesForUser --------------------------------------------------

/**
 * Returns every case owned by `userId`, newest first (updated_at DESC).
 */
export async function listCasesForUser(userId: string, db: Db = defaultDb) {
  return db
    .select()
    .from(caseTable)
    .where(eq(caseTable.userId, userId))
    .orderBy(desc(caseTable.updatedAt));
}

// ---- getCaseForUser ----------------------------------------------------

/**
 * Returns the case row or null if not found / wrong owner.
 * The ownership predicate is mandatory — callers must not skip it.
 */
export async function getCaseForUser(
  caseId: string,
  userId: string,
  db: Db = defaultDb,
) {
  const rows = await db
    .select()
    .from(caseTable)
    .where(and(eq(caseTable.id, caseId), eq(caseTable.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

// ---- listCaseDocuments -------------------------------------------------

export type CaseDocumentRow = {
  caseDocumentId: string;
  caseId: string;
  documentId: string;
  position: number;
  addedAt: Date;
  // document fields
  filename: string;
  extractionStatus: string;
  reviewStatus: string;
  uploadedAt: Date;
  // review fields (nullable when not yet reviewed)
  lookupStatus: string | null;
  resolvedAuthorityId: string | null;
};

/**
 * Returns position-ordered rows for a case, scoped to the caller.
 *
 * If caseId does not belong to `userId` we return [] — same zero-leak policy
 * as getCaseForUser.
 */
export async function listCaseDocuments(
  caseId: string,
  userId: string,
  db: Db = defaultDb,
): Promise<CaseDocumentRow[]> {
  return db
    .select({
      caseDocumentId: caseDocument.id,
      caseId: caseDocument.caseId,
      documentId: caseDocument.documentId,
      position: caseDocument.position,
      addedAt: caseDocument.addedAt,
      filename: document.filename,
      extractionStatus: document.extractionStatus,
      reviewStatus: document.reviewStatus,
      uploadedAt: document.uploadedAt,
      lookupStatus: documentReview.lookupStatus,
      resolvedAuthorityId: documentReview.resolvedAuthorityId,
    })
    .from(caseDocument)
    .innerJoin(caseTable, eq(caseDocument.caseId, caseTable.id))
    .innerJoin(document, eq(caseDocument.documentId, document.id))
    .leftJoin(documentReview, eq(documentReview.documentId, document.id))
    .where(and(eq(caseDocument.caseId, caseId), eq(caseTable.userId, userId)))
    .orderBy(asc(caseDocument.position));
}

// ---- listAssignableDocuments -------------------------------------------

/**
 * Returns documents that are eligible to be added to a case:
 *   - Owned by `userId`
 *   - extraction_status = 'done'
 *   - review_status     = 'approved'
 *   - NOT already assigned to any case (D-02)
 *
 * Ordered newest-uploaded first so the picker surfaces recent work.
 *
 * Implementation uses a correlated `NOT EXISTS` on case_document — preferred
 * over LEFT JOIN ... IS NULL because it stays correct under a compound
 * unique(case_id, document_id) index without sub-row duplication.
 */
export async function listAssignableDocuments(
  userId: string,
  db: Db = defaultDb,
) {
  return db
    .select({
      id: document.id,
      userId: document.userId,
      filename: document.filename,
      uploadedAt: document.uploadedAt,
      extractionStatus: document.extractionStatus,
      reviewStatus: document.reviewStatus,
    })
    .from(document)
    .where(
      and(
        eq(document.userId, userId),
        eq(document.extractionStatus, "done"),
        // Phase 6: manual review gate removed — auto-resolve happens after
        // extraction. Documents are assignable once extraction is done.
        notExists(
          db
            .select({ x: caseDocument.id })
            .from(caseDocument)
            .where(eq(caseDocument.documentId, document.id)),
        ),
      ),
    )
    .orderBy(desc(document.uploadedAt));
}

// Re-export type alias for tests / consumers.
export type AssignableDocument = Awaited<
  ReturnType<typeof listAssignableDocuments>
>[number];
