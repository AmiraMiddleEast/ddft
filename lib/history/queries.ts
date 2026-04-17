import "server-only";
import { and, desc, eq, gte, lte, like, sql } from "drizzle-orm";

import { db as defaultDb, type Db } from "@/db/client";
import { caseTable, laufliste } from "@/db/schema";

/**
 * Phase 5 Plan 02 — Lauflisten history queries (HIST-01/02/03).
 *
 * Returns a pageable list of Lauflisten across ALL cases for a given user.
 * Applies optional filters:
 *   - `search` → case-insensitive LIKE on `case.personName`
 *   - `dateFrom` / `dateTo` → inclusive bounds on `laufliste.generatedAt`
 *
 * ORDER BY `generatedAt DESC`. LIMIT/OFFSET paginated (default 20 per page).
 *
 * Ownership: we ALWAYS filter by `case.userId = userId` via the inner join
 * — same zero-leak policy as lib/laufliste/queries.ts. Wrong owner → empty.
 */

export type HistoryRow = {
  lauflisteId: string;
  caseId: string;
  personName: string;
  documentCount: number;
  fileSize: number;
  generatedAt: Date;
};

export type HistoryOptions = {
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  pageSize?: number;
};

export type HistoryPage = {
  items: HistoryRow[];
  totalCount: number;
  page: number;
  pageSize: number;
};

const DEFAULT_PAGE_SIZE = 20;

/**
 * Pageable owner-scoped history of Lauflisten.
 *
 * `search` is matched against `case.personName` with `LOWER(...) LIKE '%q%'`.
 * SQLite's default `LIKE` is case-insensitive for ASCII; we lowercase both
 * sides explicitly so German umlauts (ü/ä/ö/ß) match consistently.
 */
export async function listLauflistenHistoryForUser(
  userId: string,
  opts: HistoryOptions = {},
  db: Db = defaultDb,
): Promise<HistoryPage> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.max(1, Math.min(100, opts.pageSize ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;

  const conditions = [eq(caseTable.userId, userId)];

  if (opts.search && opts.search.trim().length > 0) {
    const q = `%${opts.search.trim().toLowerCase()}%`;
    conditions.push(like(sql`lower(${caseTable.personName})`, q));
  }
  if (opts.dateFrom) {
    conditions.push(gte(laufliste.generatedAt, opts.dateFrom));
  }
  if (opts.dateTo) {
    conditions.push(lte(laufliste.generatedAt, opts.dateTo));
  }

  const where = and(...conditions);

  const [items, totalRows] = await Promise.all([
    db
      .select({
        lauflisteId: laufliste.id,
        caseId: laufliste.caseId,
        personName: caseTable.personName,
        documentCount: laufliste.documentCount,
        fileSize: laufliste.fileSize,
        generatedAt: laufliste.generatedAt,
      })
      .from(laufliste)
      .innerJoin(caseTable, eq(caseTable.id, laufliste.caseId))
      .where(where)
      .orderBy(desc(laufliste.generatedAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(laufliste)
      .innerJoin(caseTable, eq(caseTable.id, laufliste.caseId))
      .where(where),
  ]);

  const totalCount = Number(totalRows[0]?.count ?? 0);
  return { items, totalCount, page, pageSize };
}
