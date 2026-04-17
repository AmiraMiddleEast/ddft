import { and, eq, isNull } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { distance } from "fastest-levenshtein";

import * as schema from "@/db/schema";
import {
  behoerdenAuthority,
  behoerdenDocumentType,
  behoerdenRegierungsbezirk,
  behoerdenState,
} from "@/db/schema";

import { cityToRegierungsbezirk } from "./city-to-regierungsbezirk";
import { slugify } from "./slug";

export type ResolverInput = {
  dokumenten_typ: string;
  bundesland: string;
  ausstellungsort: string;
};

/**
 * The resolver returns the full authority row shape. We reuse Drizzle's
 * inferred type so the UI and Server Action don't need to re-declare it.
 */
export type AuthorityRow = typeof behoerdenAuthority.$inferSelect;

export type ResolverResult =
  | {
      status: "matched";
      authority: AuthorityRow;
      routing_path: string[];
      special_rules: string | null;
      needs_review: boolean;
    }
  | { status: "ambiguous"; candidates: AuthorityRow[]; routing_path: string[] }
  | {
      status: "not_found";
      reason: "unknown_state" | "unknown_doc_type" | "no_authority_for_combination";
    };

/**
 * Drizzle DB handle type. Widened so tests can pass an in-memory SQLite
 * instance with only the Behörden tables populated.
 */
export type ResolverDb = BetterSQLite3Database<typeof schema>;

const FUZZY_MAX = 2;

/**
 * Deterministic routing function:
 *   (dokumenten_typ, bundesland, ausstellungsort) -> authority | ambiguous | not_found
 *
 * Pure: no auth, no persistence, no logging, no external network. Server
 * Action in plan 04 wraps this with auth + ownership + DB write.
 */
export async function resolveAuthority(
  input: ResolverInput,
  db: ResolverDb,
): Promise<ResolverResult> {
  // ---- 1. State lookup by slugified name ----
  const stateSlug = slugify(input.bundesland);
  const stateRows = await db
    .select()
    .from(behoerdenState)
    .where(eq(behoerdenState.id, stateSlug));
  const stateRow = stateRows[0];
  if (!stateRow) {
    return { status: "not_found", reason: "unknown_state" };
  }

  // ---- 2. Document type fuzzy match ----
  // Threshold = min(FUZZY_MAX, floor(len/4)) — Pitfall 6 in research.
  const candidateSlug = slugify(input.dokumenten_typ);
  const allDocTypes = await db.select().from(behoerdenDocumentType);
  const scored = allDocTypes
    .map((d) => ({ d, dist: distance(candidateSlug, d.id) }))
    .sort((a, b) => a.dist - b.dist);
  const best = scored[0];
  const threshold = Math.min(FUZZY_MAX, Math.floor(candidateSlug.length / 4));
  if (!best || best.dist > threshold) {
    return { status: "not_found", reason: "unknown_doc_type" };
  }
  const docType = best.d;

  // ---- 3. Regierungsbezirk (only if state requires it) ----
  let rbzId: string | null = null;
  let rbzName: string | null = null;
  if (stateRow.hatRegierungsbezirke) {
    const looked = cityToRegierungsbezirk(input.ausstellungsort, stateRow.id);
    if (looked) {
      rbzName = looked;
      const rbzSlug = slugify(looked);
      const rbzRows = await db
        .select()
        .from(behoerdenRegierungsbezirk)
        .where(
          and(
            eq(behoerdenRegierungsbezirk.stateId, stateRow.id),
            eq(behoerdenRegierungsbezirk.slug, rbzSlug),
          ),
        );
      rbzId = rbzRows[0]?.id ?? null;
    }
  }

  // ---- 4. Authority query ----
  let authorities: AuthorityRow[];

  if (rbzId) {
    // We know the Regierungsbezirk — exact match.
    authorities = await db
      .select()
      .from(behoerdenAuthority)
      .where(
        and(
          eq(behoerdenAuthority.stateId, stateRow.id),
          eq(behoerdenAuthority.documentTypeId, docType.id),
          eq(behoerdenAuthority.regierungsbezirkId, rbzId),
        ),
      );
  } else if (stateRow.hatRegierungsbezirke) {
    // State requires RBz but city is unknown — Pitfall 4.
    // Return every authority for this state+doctype so the operator can
    // disambiguate by hand. This is the "ambiguous" path.
    authorities = await db
      .select()
      .from(behoerdenAuthority)
      .where(
        and(
          eq(behoerdenAuthority.stateId, stateRow.id),
          eq(behoerdenAuthority.documentTypeId, docType.id),
        ),
      );
  } else {
    // State doesn't use RBz — look for authorities with NULL regierungsbezirk.
    authorities = await db
      .select()
      .from(behoerdenAuthority)
      .where(
        and(
          eq(behoerdenAuthority.stateId, stateRow.id),
          eq(behoerdenAuthority.documentTypeId, docType.id),
          isNull(behoerdenAuthority.regierungsbezirkId),
        ),
      );
  }

  if (authorities.length === 0) {
    // Final fall-back: see if ANY authority matches (state+doc) regardless
    // of RBz filter. If still empty → no_authority_for_combination. If some
    // exist but we filtered them out → ambiguous.
    const anyMatch = await db
      .select()
      .from(behoerdenAuthority)
      .where(
        and(
          eq(behoerdenAuthority.stateId, stateRow.id),
          eq(behoerdenAuthority.documentTypeId, docType.id),
        ),
      );
    if (anyMatch.length === 0) {
      return { status: "not_found", reason: "no_authority_for_combination" };
    }
    return {
      status: "ambiguous",
      candidates: anyMatch,
      routing_path: [stateRow.name, docType.displayName],
    };
  }

  if (authorities.length === 1) {
    const a = authorities[0];
    const routing = [stateRow.name, rbzName, docType.displayName].filter(
      (x): x is string => !!x,
    );
    return {
      status: "matched",
      authority: a,
      routing_path: routing,
      special_rules: a.specialRules,
      needs_review: a.needsReview,
    };
  }

  // Multiple matches — ambiguous (covers RBz-required + unknown city case).
  return {
    status: "ambiguous",
    candidates: authorities,
    routing_path: [stateRow.name, docType.displayName],
  };
}
