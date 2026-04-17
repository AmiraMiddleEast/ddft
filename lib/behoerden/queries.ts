import "server-only";
import { asc } from "drizzle-orm";

import { db } from "@/db/client";
import { behoerdenDocumentType, behoerdenState } from "@/db/schema";

/**
 * Dropdown loaders for the Plan 05 review UI.
 *
 * Behörden data is reference data — shared across all users, no ownership
 * check needed. Both helpers read from the global Behörden tables.
 */

/**
 * Returns all document types sorted by display name. The review-page
 * Select component renders these as options. The "Unbekannt / Sonstiges"
 * sentinel is NOT added here — the UI appends it client-side (D-09).
 */
export async function listDocumentTypes() {
  return db
    .select({
      id: behoerdenDocumentType.id,
      displayName: behoerdenDocumentType.displayName,
    })
    .from(behoerdenDocumentType)
    .orderBy(asc(behoerdenDocumentType.displayName));
}

/**
 * Returns all Bundesländer (states) sorted by name. The review-page
 * Select component renders these as options.
 */
export async function listStates() {
  return db
    .select({ id: behoerdenState.id, name: behoerdenState.name })
    .from(behoerdenState)
    .orderBy(asc(behoerdenState.name));
}
