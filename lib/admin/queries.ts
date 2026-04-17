import "server-only";
import { and, asc, desc, eq, like, sql } from "drizzle-orm";

import { db as defaultDb, type Db } from "@/db/client";
import {
  behoerdenAuthority,
  behoerdenDocumentType,
  behoerdenRegierungsbezirk,
  behoerdenState,
} from "@/db/schema";

/**
 * Phase 5 Plan 04 — Behörden admin read queries.
 *
 * Behörden data is shared reference data (not user-owned). These queries
 * perform NO ownership check — the caller (Server Component) is expected to
 * have already required a valid session.
 *
 * Deletion is intentionally not supported at v1 (CONTEXT D-15) — every query
 * here is read-only; see lib/admin/actions.ts for update + insert.
 */

// ========================================================================
// Dashboard stats
// ========================================================================

export async function getAdminStats(db: Db = defaultDb) {
  const [
    [states],
    [docTypes],
    [authorities],
    [needsReview],
    [regierungsbezirke],
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(behoerdenState),
    db
      .select({ count: sql<number>`count(*)` })
      .from(behoerdenDocumentType),
    db
      .select({ count: sql<number>`count(*)` })
      .from(behoerdenAuthority),
    db
      .select({ count: sql<number>`count(*)` })
      .from(behoerdenAuthority)
      .where(eq(behoerdenAuthority.needsReview, true)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(behoerdenRegierungsbezirk),
  ]);

  return {
    states: Number(states?.count ?? 0),
    documentTypes: Number(docTypes?.count ?? 0),
    authorities: Number(authorities?.count ?? 0),
    needsReview: Number(needsReview?.count ?? 0),
    regierungsbezirke: Number(regierungsbezirke?.count ?? 0),
  };
}

// ========================================================================
// Authority list + detail
// ========================================================================

export type AuthorityListOptions = {
  stateId?: string;
  docTypeId?: string;
  needsReview?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type AuthorityListRow = {
  id: string;
  name: string;
  address: string;
  stateId: string;
  stateName: string;
  documentTypeId: string;
  documentTypeName: string;
  regierungsbezirkName: string | null;
  needsReview: boolean;
};

const DEFAULT_PAGE_SIZE = 20;

export async function listAuthoritiesAdmin(
  opts: AuthorityListOptions = {},
  db: Db = defaultDb,
): Promise<{ items: AuthorityListRow[]; totalCount: number; page: number; pageSize: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.max(1, Math.min(100, opts.pageSize ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;

  const conditions = [] as ReturnType<typeof eq>[];
  if (opts.stateId) {
    conditions.push(eq(behoerdenAuthority.stateId, opts.stateId));
  }
  if (opts.docTypeId) {
    conditions.push(eq(behoerdenAuthority.documentTypeId, opts.docTypeId));
  }
  if (opts.needsReview !== undefined) {
    conditions.push(eq(behoerdenAuthority.needsReview, opts.needsReview));
  }
  if (opts.search && opts.search.trim().length > 0) {
    const q = `%${opts.search.trim().toLowerCase()}%`;
    conditions.push(like(sql`lower(${behoerdenAuthority.name})`, q));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, totalRows] = await Promise.all([
    db
      .select({
        id: behoerdenAuthority.id,
        name: behoerdenAuthority.name,
        address: behoerdenAuthority.address,
        stateId: behoerdenAuthority.stateId,
        stateName: behoerdenState.name,
        documentTypeId: behoerdenAuthority.documentTypeId,
        documentTypeName: behoerdenDocumentType.displayName,
        regierungsbezirkName: behoerdenRegierungsbezirk.name,
        needsReview: behoerdenAuthority.needsReview,
      })
      .from(behoerdenAuthority)
      .innerJoin(
        behoerdenState,
        eq(behoerdenState.id, behoerdenAuthority.stateId),
      )
      .innerJoin(
        behoerdenDocumentType,
        eq(behoerdenDocumentType.id, behoerdenAuthority.documentTypeId),
      )
      .leftJoin(
        behoerdenRegierungsbezirk,
        eq(behoerdenRegierungsbezirk.id, behoerdenAuthority.regierungsbezirkId),
      )
      .where(where)
      .orderBy(asc(behoerdenState.name), asc(behoerdenAuthority.name))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(behoerdenAuthority)
      .where(where),
  ]);

  return {
    items,
    totalCount: Number(totalRows[0]?.count ?? 0),
    page,
    pageSize,
  };
}

export async function getAuthorityByIdAdmin(
  id: string,
  db: Db = defaultDb,
) {
  const rows = await db
    .select()
    .from(behoerdenAuthority)
    .where(eq(behoerdenAuthority.id, id))
    .limit(1);
  return rows[0] ?? null;
}

// ========================================================================
// Document types
// ========================================================================

export async function listDocumentTypesAdmin(db: Db = defaultDb) {
  return db
    .select()
    .from(behoerdenDocumentType)
    .orderBy(asc(behoerdenDocumentType.displayName));
}

export async function getDocumentTypeById(id: string, db: Db = defaultDb) {
  const rows = await db
    .select()
    .from(behoerdenDocumentType)
    .where(eq(behoerdenDocumentType.id, id))
    .limit(1);
  return rows[0] ?? null;
}

// ========================================================================
// Supporting helpers for list filters
// ========================================================================

export async function listStatesAdmin(db: Db = defaultDb) {
  return db
    .select({ id: behoerdenState.id, name: behoerdenState.name })
    .from(behoerdenState)
    .orderBy(asc(behoerdenState.name));
}

export async function listRecentlyEditedAuthorities(
  limit = 5,
  db: Db = defaultDb,
) {
  // We don't have an updatedAt column on behoerdenAuthority; fall back to
  // "needs_review=true first, then alphabetical". The admin dashboard uses
  // this as a hint panel only.
  return db
    .select({
      id: behoerdenAuthority.id,
      name: behoerdenAuthority.name,
      stateId: behoerdenAuthority.stateId,
      needsReview: behoerdenAuthority.needsReview,
    })
    .from(behoerdenAuthority)
    .orderBy(desc(behoerdenAuthority.needsReview), asc(behoerdenAuthority.name))
    .limit(limit);
}
