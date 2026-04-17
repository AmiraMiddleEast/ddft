"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { behoerdenAuthority, behoerdenDocumentType } from "@/db/schema";
import { slugify } from "@/lib/behoerden/slug";
import {
  AuthorityPatchSchema,
  DocumentTypeSchema,
} from "@/lib/validations/admin";

/**
 * Phase 5 Plan 04 — Behörden admin Server Actions.
 *
 * Single-user tool per CLAUDE.md — every authenticated user has admin
 * privileges. No role check needed beyond session presence (D-11/D-21).
 *
 * All actions return a discriminated union { ok, data } | { ok:false, error }.
 * Errors NEVER throw for user mistakes (matches Phase 3/4 conventions).
 */

type Ok<T> = { ok: true; data: T };
type Err<E extends string = string> = {
  ok: false;
  error: E;
  details?: unknown;
};
type ActionResult<T, E extends string = string> = Ok<T> | Err<E>;

function revalidateAdmin() {
  try {
    revalidatePath("/admin/behoerden");
    revalidatePath("/admin/behoerden/authorities");
    revalidatePath("/admin/behoerden/document-types");
  } catch {
    // No render context during tests — swallow.
  }
}

// ========================================================================
// updateAuthorityAction
// ========================================================================

export async function updateAuthorityAction(
  id: string,
  patch: unknown,
): Promise<
  ActionResult<
    { id: string },
    "UNAUTHORIZED" | "VALIDATION" | "NOT_FOUND" | "DB_ERROR"
  >
> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = AuthorityPatchSchema.safeParse(patch);
  if (!parsed.success) {
    return { ok: false, error: "VALIDATION", details: parsed.error.flatten() };
  }

  const [existing] = await db
    .select({ id: behoerdenAuthority.id })
    .from(behoerdenAuthority)
    .where(eq(behoerdenAuthority.id, id))
    .limit(1);
  if (!existing) return { ok: false, error: "NOT_FOUND" };

  const p = parsed.data;
  try {
    await db
      .update(behoerdenAuthority)
      .set({
        name: p.name,
        address: p.address,
        phone: p.phone ? p.phone : null,
        email: p.email ? p.email : null,
        website: p.website ? p.website : null,
        officeHours: p.officeHours ? p.officeHours : null,
        notes: p.notes ? p.notes : null,
        specialRules: p.specialRules ? p.specialRules : null,
        needsReview: p.needsReview ?? false,
      })
      .where(eq(behoerdenAuthority.id, id));
  } catch (err) {
    console.error("[updateAuthorityAction] update failed:", err);
    return { ok: false, error: "DB_ERROR" };
  }

  revalidateAdmin();
  return { ok: true, data: { id } };
}

// ========================================================================
// createDocumentTypeAction
// ========================================================================

export async function createDocumentTypeAction(
  input: unknown,
): Promise<
  ActionResult<
    { id: string; displayName: string },
    "UNAUTHORIZED" | "VALIDATION" | "DUPLICATE" | "DB_ERROR"
  >
> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = DocumentTypeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "VALIDATION", details: parsed.error.flatten() };
  }

  const id = slugify(parsed.data.displayName);
  if (!id) {
    return { ok: false, error: "VALIDATION" };
  }

  // Uniqueness pre-check (gives us a typed DUPLICATE error instead of catching
  // SQLITE_CONSTRAINT_PRIMARYKEY). Race window exists but a retry will see
  // the collision and return DUPLICATE as well.
  const [existing] = await db
    .select({ id: behoerdenDocumentType.id })
    .from(behoerdenDocumentType)
    .where(eq(behoerdenDocumentType.id, id))
    .limit(1);
  if (existing) return { ok: false, error: "DUPLICATE" };

  try {
    await db.insert(behoerdenDocumentType).values({
      id,
      displayName: parsed.data.displayName,
    });
  } catch (err) {
    // PK collision with a concurrent insert.
    const code = (err as { code?: string })?.code;
    if (code === "SQLITE_CONSTRAINT_PRIMARYKEY" || code === "SQLITE_CONSTRAINT_UNIQUE") {
      return { ok: false, error: "DUPLICATE" };
    }
    console.error("[createDocumentTypeAction] insert failed:", err);
    return { ok: false, error: "DB_ERROR" };
  }

  revalidateAdmin();
  return { ok: true, data: { id, displayName: parsed.data.displayName } };
}

// ========================================================================
// updateDocumentTypeAction
// ========================================================================

/**
 * Updates only the `displayName`. The slug (id) is stable — renaming it would
 * cascade to every authority row via FK, and we don't expose that at v1.
 */
export async function updateDocumentTypeAction(
  id: string,
  input: unknown,
): Promise<
  ActionResult<
    { id: string; displayName: string },
    "UNAUTHORIZED" | "VALIDATION" | "NOT_FOUND" | "DB_ERROR"
  >
> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = DocumentTypeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "VALIDATION", details: parsed.error.flatten() };
  }

  const [existing] = await db
    .select()
    .from(behoerdenDocumentType)
    .where(eq(behoerdenDocumentType.id, id))
    .limit(1);
  if (!existing) return { ok: false, error: "NOT_FOUND" };

  try {
    await db
      .update(behoerdenDocumentType)
      .set({ displayName: parsed.data.displayName })
      .where(eq(behoerdenDocumentType.id, id));
  } catch (err) {
    console.error("[updateDocumentTypeAction] update failed:", err);
    return { ok: false, error: "DB_ERROR" };
  }

  revalidateAdmin();
  return { ok: true, data: { id, displayName: parsed.data.displayName } };
}
