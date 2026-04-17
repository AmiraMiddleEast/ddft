/**
 * Phase 4 Plan 03 — Filesystem storage for generated Laufliste PDFs.
 *
 * Mirrors `lib/uploads/storage.ts` VERBATIM (same pattern, same
 * `path.relative(process.cwd(), abs)` return contract).
 *
 * Files are immutable: regenerating a Laufliste creates a new file with a
 * fresh timestamp suffix (CONTEXT D-14).
 */

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

export const LAUFLISTEN_DIR = path.resolve(
  process.cwd(),
  "data",
  "lauflisten",
);

/**
 * Writes PDF bytes to `data/lauflisten/{caseId}-{timestamp}.pdf` and returns
 * a repo-relative path suitable for storage in the `laufliste.pdf_storage_path`
 * column.
 *
 * Threat T-04-10: `caseId` must be a server-generated UUID (crypto.randomUUID),
 * NOT user-controlled — otherwise path-separator injection is possible.
 */
export async function writeLauflisteToDisk(
  caseId: string,
  bytes: Uint8Array,
): Promise<string> {
  await mkdir(LAUFLISTEN_DIR, { recursive: true });
  const ts = Date.now();
  const abs = path.join(LAUFLISTEN_DIR, `${caseId}-${ts}.pdf`);
  await writeFile(abs, bytes);
  return path.relative(process.cwd(), abs);
}
