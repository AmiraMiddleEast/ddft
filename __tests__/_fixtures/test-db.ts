import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";

/**
 * Create a fresh isolated SQLite DB for a single test file and apply the
 * project schema via drizzle-kit push. Returns the absolute DB file path and
 * a cleanup callback. Callers must set process.env.DATABASE_URL to dbFile
 * BEFORE dynamically importing @/lib/auth or @/db/client.
 *
 * See RESEARCH.md §Validation Architecture — Wave 0 Gaps.
 */
export function createTestDb() {
  const dir = mkdtempSync(path.join(tmpdir(), "angela-test-"));
  const dbFile = path.join(dir, "test.db");

  const projectRoot = path.resolve(__dirname, "../..");

  // Apply schema via drizzle-kit push using an overridden DATABASE_URL.
  // --force avoids the interactive prompt when the schema is fresh.
  execSync("npx drizzle-kit push --force", {
    env: { ...process.env, DATABASE_URL: dbFile },
    stdio: "pipe",
    cwd: projectRoot,
  });

  return {
    dbFile,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}
