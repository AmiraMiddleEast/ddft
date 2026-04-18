/**
 * Debug: stub server-only then run buildLauflisteInput for real case.
 */
// Polyfill server-only for this script.
import { Module } from "node:module";
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request: string, ...args: unknown[]) {
  if (request === "server-only") return originalResolve.call(this, "drizzle-orm", ...args as [unknown, unknown, unknown?]);
  return originalResolve.call(this, request, ...args as [unknown, unknown, unknown?]);
};

import { db } from "@/db/client";
import { caseTable } from "@/db/schema";
import { buildLauflisteInput } from "@/lib/laufliste/build-input";

async function main(): Promise<void> {
  const cases = await db.select().from(caseTable).limit(5);
  console.log("cases:", cases.length);
  for (const c of cases) {
    console.log(`\n=== ${c.id} ===`);
    console.log("case fields:", {
      beruf: c.beruf,
      wohnsitz: c.wohnsitzBundesland,
      arbeitsort: c.arbeitsortBundesland,
      nrw: c.nrwSubregion,
    });
    try {
      const input = await buildLauflisteInput(c.id, c.userId, db);
      if (!input) {
        console.log("  null");
        continue;
      }
      console.log("  cogs:", input.cogs ? "yes" : "no");
      console.log("  docs:", input.documents.length);
      // Serialize — any weird values (functions/Buffers) will show up
      const json = JSON.stringify(input, null, 2);
      console.log(json.slice(0, 3000));
      if (json.length > 3000) console.log("... (truncated)");
    } catch (e) {
      console.log("  ERR:", e);
    }
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
