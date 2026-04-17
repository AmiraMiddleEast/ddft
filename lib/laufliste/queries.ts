import "server-only";
import { and, desc, eq } from "drizzle-orm";

import { db as defaultDb, type Db } from "@/db/client";
import { caseTable, caseDocument, document, laufliste } from "@/db/schema";
import { slugifyPersonName } from "./slug";

/**
 * Phase 4 Plan 04 Task 2 — ownership-scoped reads for the laufliste table.
 *
 * Same zero-leak policy as lib/cases/queries.ts: wrong owner returns
 * null / [] — never throw, never 403, never surface row existence.
 */

/** Count of case_document rows whose backing document is NOT yet approved. */
export async function countUnapprovedDocsInCase(
  caseId: string,
  db: Db = defaultDb,
): Promise<number> {
  const rows = await db
    .select({ reviewStatus: document.reviewStatus })
    .from(caseDocument)
    .innerJoin(document, eq(document.id, caseDocument.documentId))
    .where(eq(caseDocument.caseId, caseId));
  return rows.filter((r) => r.reviewStatus !== "approved").length;
}

/** All Lauflisten for a case, newest first, scoped to the owner. */
export async function listLauflistenForCase(
  caseId: string,
  userId: string,
  db: Db = defaultDb,
) {
  return db
    .select({
      id: laufliste.id,
      caseId: laufliste.caseId,
      pdfStoragePath: laufliste.pdfStoragePath,
      generatedAt: laufliste.generatedAt,
      documentCount: laufliste.documentCount,
      fileSize: laufliste.fileSize,
    })
    .from(laufliste)
    .innerJoin(caseTable, eq(caseTable.id, laufliste.caseId))
    .where(
      and(eq(laufliste.caseId, caseId), eq(caseTable.userId, userId)),
    )
    .orderBy(desc(laufliste.generatedAt));
}

export type LauflisteDownloadRow = {
  pdfStoragePath: string;
  personName: string;
  personSlug: string;
  generatedDate: string;
  generatedAt: Date;
};

/**
 * Single-row download descriptor: file path + Content-Disposition inputs.
 *
 * Returns null if the case/lauflisteId/userId triple does not all line up
 * (wrong owner, cross-case id, or non-existent). Critical to T-04-15 + D-21.
 */
export async function getLauflisteForDownload(
  caseId: string,
  lauflisteId: string,
  userId: string,
  db: Db = defaultDb,
): Promise<LauflisteDownloadRow | null> {
  const rows = await db
    .select({
      pdfStoragePath: laufliste.pdfStoragePath,
      generatedAt: laufliste.generatedAt,
      personName: caseTable.personName,
    })
    .from(laufliste)
    .innerJoin(caseTable, eq(caseTable.id, laufliste.caseId))
    .where(
      and(
        eq(laufliste.id, lauflisteId),
        eq(laufliste.caseId, caseId),
        eq(caseTable.userId, userId),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const d = row.generatedAt;
  const yyyy = String(d.getUTCFullYear());
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");

  return {
    pdfStoragePath: row.pdfStoragePath,
    personName: row.personName,
    personSlug: slugifyPersonName(row.personName),
    generatedDate: `${yyyy}-${mm}-${dd}`,
    generatedAt: d,
  };
}
