import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

export const UPLOADS_DIR = path.resolve(process.cwd(), "data", "uploads");

export async function writeUploadToDisk(
  id: string,
  bytes: Uint8Array,
): Promise<string> {
  await mkdir(UPLOADS_DIR, { recursive: true });
  const abs = path.join(UPLOADS_DIR, `${id}.pdf`);
  // Phase 2 D-06: originals are immutable; overwrite only ever happens if this is called twice
  // for the same id in the same request (shouldn't happen given dedup runs first).
  await writeFile(abs, bytes);
  // Return the relative path form used in DB (matches Phase 1 path convention).
  return path.relative(process.cwd(), abs);
}
