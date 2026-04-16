import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "node:path";
import * as schema from "./schema";

// Resolve DB path against process.cwd() so relative paths in DATABASE_URL
// always resolve to the project root regardless of caller context.
// See RESEARCH.md Pitfall P-04.
const dbPath = path.resolve(
  process.cwd(),
  process.env.DATABASE_URL ?? "data/angela.db"
);

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export type Db = typeof db;
