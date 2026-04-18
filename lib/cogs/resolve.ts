/**
 * CoGS routing resolver.
 *
 * Rule (from the Handbuch + user decision):
 *   Default: Bundesland, in dem der Arzt aktuell oder zuletzt in Deutschland
 *   seinen Beruf ausgeübt hat (= Arbeitsort-BL).
 *   Fallback: Wohnsitz-BL (used when currently abroad, i.e. arbeitsortBundesland is null).
 *
 * NRW special case: two Kammer-regions (Nordrhein / Westfalen-Lippe) — caller
 * must supply nrwSubregion when the effective BL is NW.
 */
import { db } from "@/db/client";
import { cogsKammer } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export type CogsRoutingInput = {
  beruf: "arzt" | "zahnarzt";
  arbeitsortBundesland: string | null; // BL key (e.g. "BY", "NW") or null if abroad
  wohnsitzBundesland: string; // BL key (required, fallback)
  nrwSubregion: "nordrhein" | "westfalen-lippe" | null;
};

export type CogsKammerRow = typeof cogsKammer.$inferSelect;

export type CogsRoutingResult =
  | {
      ok: true;
      cogsKammer: CogsKammerRow;
      routing: {
        used: "arbeitsort" | "wohnsitz";
        bundeslandKey: string; // the effective key used for lookup
        appliedNrwSubregion: "nordrhein" | "westfalen-lippe" | null;
      };
    }
  | {
      ok: false;
      reason: "not_found" | "nrw_subregion_missing";
      details?: string;
    };

export function determineEffectiveBl(
  input: CogsRoutingInput,
): { key: string; used: "arbeitsort" | "wohnsitz" } {
  if (input.arbeitsortBundesland && input.arbeitsortBundesland.length > 0) {
    return { key: input.arbeitsortBundesland, used: "arbeitsort" };
  }
  return { key: input.wohnsitzBundesland, used: "wohnsitz" };
}

/**
 * Compute the lookup key with NRW subregion expansion.
 * Returns the key format used in cogs_kammer.bundesland_key:
 *   - for NRW: "NW_NR" or "NW_WL"
 *   - for others: the raw BL key (BW, BY, BE, BB, HB, HH, HE, MV, NI, RP, SL, SN, ST, SH, TH)
 */
export function computeLookupKey(
  effectiveBl: string,
  nrwSubregion: "nordrhein" | "westfalen-lippe" | null,
): { ok: true; key: string } | { ok: false; reason: "nrw_subregion_missing" } {
  if (effectiveBl === "NW") {
    if (!nrwSubregion) return { ok: false, reason: "nrw_subregion_missing" };
    return {
      ok: true,
      key: nrwSubregion === "nordrhein" ? "NW_NR" : "NW_WL",
    };
  }
  return { ok: true, key: effectiveBl };
}

/**
 * Resolve the CoGS Kammer row for a given doctor case.
 * Pure logic is split out for unit testing — queries the DB here.
 */
export async function resolveCogs(
  input: CogsRoutingInput,
): Promise<CogsRoutingResult> {
  const effective = determineEffectiveBl(input);
  const keyResult = computeLookupKey(effective.key, input.nrwSubregion);
  if (!keyResult.ok) {
    return {
      ok: false,
      reason: "nrw_subregion_missing",
      details:
        "Das Bundesland NRW erfordert eine Auswahl zwischen Nordrhein und Westfalen-Lippe.",
    };
  }

  const [row] = await db
    .select()
    .from(cogsKammer)
    .where(
      and(
        eq(cogsKammer.bundeslandKey, keyResult.key),
        eq(cogsKammer.beruf, input.beruf),
      ),
    )
    .limit(1);

  if (!row) {
    return {
      ok: false,
      reason: "not_found",
      details: `Keine CoGS-Kammer-Zeile für bundeslandKey=${keyResult.key} beruf=${input.beruf} gefunden.`,
    };
  }

  return {
    ok: true,
    cogsKammer: row,
    routing: {
      used: effective.used,
      bundeslandKey: keyResult.key,
      appliedNrwSubregion:
        effective.key === "NW" ? input.nrwSubregion : null,
    },
  };
}
