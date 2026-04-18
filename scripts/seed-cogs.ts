/**
 * Seed cogs_kammer from two sources:
 * 1) data/good_standing_database.csv (baseline, 33 rows)
 * 2) .planning/cogs-research-results.json (gap fills + corrections, 21 rows)
 *
 * Merge: research JSON wins when present. Idempotent: upserts on id.
 * id format: "{bundesland_key_lower_with_underscores_to_dashes}-{beruf}"
 *   e.g. "by-arzt", "nw-nr-zahnarzt", "th-arzt"
 *
 * Run: npm run seed:cogs
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/db/client";
import { cogsKammer } from "@/db/schema";
import { sql } from "drizzle-orm";

type Row = {
  bundesland: string;
  bundesland_key: string;
  beruf: string;
  beruf_key: string;
  kammer_name: string;
  kammer_website: string;
  zustaendige_stelle: string;
  zustaendige_stelle_hinweis: string;
  direct_url_good_standing: string;
  antragsverfahren: string;
  erforderliche_dokumente: string;
  kosten: string;
  bearbeitungszeit: string;
  kontakt_email: string;
  kontakt_telefon: string;
  kontakt_adresse: string;
  fuehrungszeugnis_o_erforderlich: string;
  fuehrungszeugnis_o_empfaenger: string;
  besonderheiten: string;
  quellen: string;
  daten_vollstaendig: boolean | string;
};

function makeId(blKey: string, beruf: string): string {
  return `${blKey.toLowerCase().replace(/_/g, "-")}-${beruf.toLowerCase()}`;
}

function nilIfEmpty(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  if (!t || t === "nicht angegeben" || t === "nicht gefunden") return null;
  return t;
}

/**
 * Parse a CSV that uses `;` as delimiter and supports quoted fields that may
 * contain newlines and escaped quotes (`""`).
 */
function parseCsv(content: string): Row[] {
  // Strip BOM
  const text = content.replace(/^\ufeff/, "");
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ";") {
        record.push(field);
        field = "";
      } else if (c === "\n") {
        record.push(field);
        records.push(record);
        record = [];
        field = "";
      } else if (c === "\r") {
        // ignore — handled on \n
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  const [header, ...rest] = records;
  return rest
    .filter((r) => r.length >= header.length && r[0])
    .map((r) => {
      const obj: Record<string, string | boolean> = {};
      header.forEach((key, idx) => {
        const v = (r[idx] ?? "").trim();
        obj[key] =
          key === "daten_vollstaendig"
            ? v.toLowerCase() === "true"
            : v;
      });
      return obj as unknown as Row;
    });
}

async function loadCsv(filePath: string): Promise<Row[]> {
  const content = await readFile(filePath, "utf8");
  return parseCsv(content);
}

async function loadJson(filePath: string): Promise<Row[]> {
  const content = await readFile(filePath, "utf8");
  const parsed = JSON.parse(content) as { results: Row[] };
  return parsed.results;
}

function normalizeRow(r: Row): {
  id: string;
  bundeslandKey: string;
  bundeslandName: string;
  beruf: "arzt" | "zahnarzt";
  kammerName: string | null;
  kammerWebsite: string | null;
  zustaendigeStelle: string;
  zustaendigeStelleHinweis: string | null;
  directUrlGoodStanding: string | null;
  antragsverfahren: string | null;
  erforderlicheDokumente: string | null;
  fuehrungszeugnisOErforderlich: string | null;
  fuehrungszeugnisOEmpfaenger: string;
  kontaktEmail: string | null;
  kontaktTelefon: string | null;
  kontaktAdresse: string | null;
  besonderheiten: string | null;
  quellen: string | null;
  datenVollstaendig: boolean;
} {
  const beruf = (r.beruf_key?.toLowerCase() as "arzt" | "zahnarzt") ?? "arzt";
  const id = makeId(r.bundesland_key, beruf);
  const zustaendigeStelle =
    nilIfEmpty(r.zustaendige_stelle) ?? nilIfEmpty(r.kammer_name) ?? "unbekannt";
  // FZ-O Empfänger: if empty, fall back to the Kammer name as a reasonable default
  const fzoEmpf =
    nilIfEmpty(r.fuehrungszeugnis_o_empfaenger) ??
    nilIfEmpty(r.kammer_name) ??
    nilIfEmpty(r.zustaendige_stelle) ??
    "Bitte kontaktieren Sie Dubai Docs Fast Track";
  const vollstaendig =
    typeof r.daten_vollstaendig === "boolean"
      ? r.daten_vollstaendig
      : String(r.daten_vollstaendig).toLowerCase() === "true";
  return {
    id,
    bundeslandKey: r.bundesland_key,
    bundeslandName: r.bundesland,
    beruf,
    kammerName: nilIfEmpty(r.kammer_name),
    kammerWebsite: nilIfEmpty(r.kammer_website),
    zustaendigeStelle,
    zustaendigeStelleHinweis: nilIfEmpty(r.zustaendige_stelle_hinweis),
    directUrlGoodStanding: nilIfEmpty(r.direct_url_good_standing),
    antragsverfahren: nilIfEmpty(r.antragsverfahren),
    erforderlicheDokumente: nilIfEmpty(r.erforderliche_dokumente),
    fuehrungszeugnisOErforderlich: nilIfEmpty(r.fuehrungszeugnis_o_erforderlich),
    fuehrungszeugnisOEmpfaenger: fzoEmpf,
    kontaktEmail: nilIfEmpty(r.kontakt_email),
    kontaktTelefon: nilIfEmpty(r.kontakt_telefon),
    kontaktAdresse: nilIfEmpty(r.kontakt_adresse),
    besonderheiten: nilIfEmpty(r.besonderheiten),
    quellen: nilIfEmpty(r.quellen),
    datenVollstaendig: vollstaendig,
  };
}

async function main(): Promise<void> {
  const cwd = process.cwd();
  const csvPath = path.join(cwd, "data/good_standing_database.csv");
  const jsonPath = path.join(cwd, ".planning/cogs-research-results.json");

  console.log("[seed-cogs] loading baseline CSV…");
  const csvRows = await loadCsv(csvPath);
  console.log(`[seed-cogs]   → ${csvRows.length} rows from CSV`);

  console.log("[seed-cogs] loading research JSON…");
  const jsonRows = await loadJson(jsonPath);
  console.log(`[seed-cogs]   → ${jsonRows.length} rows from research JSON`);

  // Merge: start with CSV, let JSON override by id
  const merged = new Map<string, ReturnType<typeof normalizeRow>>();
  for (const r of csvRows) {
    const n = normalizeRow(r);
    merged.set(n.id, n);
  }
  for (const r of jsonRows) {
    const n = normalizeRow(r);
    merged.set(n.id, n); // research wins
  }

  const rows = Array.from(merged.values());
  console.log(`[seed-cogs] merged total: ${rows.length} unique rows`);

  // Upsert each row
  let inserted = 0;
  let updated = 0;
  for (const n of rows) {
    const existing = await db
      .select({ id: cogsKammer.id })
      .from(cogsKammer)
      .where(sql`${cogsKammer.id} = ${n.id}`)
      .limit(1);
    if (existing.length === 0) {
      await db.insert(cogsKammer).values({
        ...n,
        updatedBy: "seed",
      });
      inserted++;
    } else {
      await db
        .update(cogsKammer)
        .set({ ...n, updatedBy: "seed" })
        .where(sql`${cogsKammer.id} = ${n.id}`);
      updated++;
    }
  }
  console.log(
    `[seed-cogs] done. inserted=${inserted} updated=${updated} total=${rows.length}`,
  );

  // Verification: count per beruf
  const arzt = rows.filter((r) => r.beruf === "arzt").length;
  const zahn = rows.filter((r) => r.beruf === "zahnarzt").length;
  const complete = rows.filter((r) => r.datenVollstaendig).length;
  console.log(
    `[seed-cogs] summary: Ärzte=${arzt}, Zahnärzte=${zahn}, datenVollstaendig=${complete}/${rows.length}`,
  );
}

main().catch((e: unknown) => {
  console.error("[seed-cogs] FAILED:", e);
  process.exit(1);
});
