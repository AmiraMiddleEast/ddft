// @vitest-environment node
//
// Resolver behavior tests — uses a fresh in-memory SQLite DB seeded from
// __tests__/_fixtures/behoerden-mini.json (not angela.db). The resolver is
// a pure function; we pass the db handle as the second argument.

import { beforeAll, afterAll, describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import * as schema from "@/db/schema";
import {
  behoerdenAuthority,
  behoerdenDocumentType,
  behoerdenRegierungsbezirk,
  behoerdenState,
} from "@/db/schema";
import { resolveAuthority } from "./resolve";

type Db = BetterSQLite3Database<typeof schema>;
let sqlite: Database.Database;
let db: Db;

// Minimal CREATE TABLE DDL for just the four Behörden tables.
// We don't want to pull in drizzle-kit push because that would apply the
// entire project schema and require spinning up subprocesses.
const DDL = [
  `CREATE TABLE behoerden_state (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     hat_regierungsbezirke INTEGER NOT NULL DEFAULT 0,
     besonderheiten TEXT,
     created_at INTEGER NOT NULL DEFAULT 0
   );`,
  `CREATE TABLE behoerden_regierungsbezirk (
     id TEXT PRIMARY KEY,
     state_id TEXT NOT NULL REFERENCES behoerden_state(id) ON DELETE CASCADE,
     name TEXT NOT NULL,
     slug TEXT NOT NULL
   );`,
  `CREATE UNIQUE INDEX rbz_state_slug_uniq ON behoerden_regierungsbezirk(state_id, slug);`,
  `CREATE INDEX rbz_state_idx ON behoerden_regierungsbezirk(state_id);`,
  `CREATE TABLE behoerden_document_type (
     id TEXT PRIMARY KEY,
     display_name TEXT NOT NULL
   );`,
  `CREATE TABLE behoerden_authority (
     id TEXT PRIMARY KEY,
     state_id TEXT NOT NULL REFERENCES behoerden_state(id) ON DELETE CASCADE,
     regierungsbezirk_id TEXT REFERENCES behoerden_regierungsbezirk(id) ON DELETE SET NULL,
     document_type_id TEXT NOT NULL REFERENCES behoerden_document_type(id) ON DELETE CASCADE,
     name TEXT NOT NULL,
     address TEXT NOT NULL,
     phone TEXT,
     email TEXT,
     website TEXT,
     office_hours TEXT,
     notes TEXT,
     special_rules TEXT,
     needs_review INTEGER NOT NULL DEFAULT 0
   );`,
  `CREATE INDEX authority_lookup_idx ON behoerden_authority(state_id, document_type_id, regierungsbezirk_id);`,
  `CREATE INDEX authority_state_idx ON behoerden_authority(state_id);`,
];

beforeAll(() => {
  sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  for (const stmt of DDL) sqlite.exec(stmt);
  db = drizzle(sqlite, { schema });

  // Load fixture
  const fixture = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, "../../__tests__/_fixtures/behoerden-mini.json"),
      "utf8",
    ),
  ) as {
    states: { id: string; name: string; hat_regierungsbezirke: boolean; besonderheiten: string | null }[];
    regierungsbezirke: { id: string; state_id: string; name: string; slug: string }[];
    document_types: { id: string; display_name: string }[];
    authorities: {
      id: string;
      state_id: string;
      regierungsbezirk_id: string | null;
      document_type_id: string;
      name: string;
      address: string;
      phone: string | null;
      email: string | null;
      website: string | null;
      office_hours: string | null;
      notes: string | null;
      special_rules: string | null;
      needs_review: boolean;
    }[];
  };

  for (const s of fixture.states) {
    sqlite
      .prepare(
        "INSERT INTO behoerden_state (id, name, hat_regierungsbezirke, besonderheiten, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(
        s.id,
        s.name,
        s.hat_regierungsbezirke ? 1 : 0,
        s.besonderheiten,
        Date.now(),
      );
  }
  for (const r of fixture.regierungsbezirke) {
    sqlite
      .prepare(
        "INSERT INTO behoerden_regierungsbezirk (id, state_id, name, slug) VALUES (?, ?, ?, ?)",
      )
      .run(r.id, r.state_id, r.name, r.slug);
  }
  for (const d of fixture.document_types) {
    sqlite
      .prepare(
        "INSERT INTO behoerden_document_type (id, display_name) VALUES (?, ?)",
      )
      .run(d.id, d.display_name);
  }
  for (const a of fixture.authorities) {
    sqlite
      .prepare(
        `INSERT INTO behoerden_authority
         (id, state_id, regierungsbezirk_id, document_type_id, name, address, phone, email, website, office_hours, notes, special_rules, needs_review)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        a.id,
        a.state_id,
        a.regierungsbezirk_id,
        a.document_type_id,
        a.name,
        a.address,
        a.phone,
        a.email,
        a.website,
        a.office_hours,
        a.notes,
        a.special_rules,
        a.needs_review ? 1 : 0,
      );
  }
});

afterAll(() => {
  sqlite.close();
});

describe("resolveAuthority", () => {
  it("Test 1 (LKUP-01 matched): Approbationsurkunde + Bayern + Muenchen → matched Oberbayern", async () => {
    const r = await resolveAuthority(
      {
        dokumenten_typ: "Approbationsurkunde",
        bundesland: "Bayern",
        ausstellungsort: "M\u00fcnchen",
      },
      db,
    );
    expect(r.status).toBe("matched");
    if (r.status !== "matched") throw new Error("narrow");
    expect(r.authority.id).toBe("a1");
    expect(r.routing_path).toEqual(["Bayern", "Oberbayern", "Approbationsurkunde"]);
    expect(r.needs_review).toBe(false);
  });

  it("Test 2 (LKUP-02 RBz routing): Approbationsurkunde + Bayern + Augsburg → matched Schwaben, needs_review", async () => {
    const r = await resolveAuthority(
      {
        dokumenten_typ: "Approbationsurkunde",
        bundesland: "Bayern",
        ausstellungsort: "Augsburg",
      },
      db,
    );
    expect(r.status).toBe("matched");
    if (r.status !== "matched") throw new Error("narrow");
    expect(r.authority.id).toBe("a2");
    expect(r.needs_review).toBe(true);
  });

  it("Test 3 (Pitfall 4): RBz state + unknown city → ambiguous with both RBz candidates", async () => {
    const r = await resolveAuthority(
      {
        dokumenten_typ: "Approbationsurkunde",
        bundesland: "Bayern",
        ausstellungsort: "Kleinsdorf",
      },
      db,
    );
    expect(r.status).toBe("ambiguous");
    if (r.status !== "ambiguous") throw new Error("narrow");
    const ids = r.candidates.map((c) => c.id).sort();
    expect(ids).toEqual(["a1", "a2"]);
  });

  it("Test 4 (state without RBz): Geburtsurkunde + Berlin + Berlin → matched a4", async () => {
    const r = await resolveAuthority(
      {
        dokumenten_typ: "Geburtsurkunde",
        bundesland: "Berlin",
        ausstellungsort: "Berlin",
      },
      db,
    );
    expect(r.status).toBe("matched");
    if (r.status !== "matched") throw new Error("narrow");
    expect(r.authority.id).toBe("a4");
  });

  it("Test 5 (LKUP-03 Fuehrungszeugnis): special_rules contains 'Apostille'", async () => {
    const r = await resolveAuthority(
      {
        dokumenten_typ: "Fuehrungszeugnis",
        bundesland: "Berlin",
        ausstellungsort: "Berlin",
      },
      db,
    );
    expect(r.status).toBe("matched");
    if (r.status !== "matched") throw new Error("narrow");
    expect(r.special_rules).toMatch(/Apostille/);
  });

  it("Test 6 (LKUP-03 Reisepass): special_rules contains 'keine Legalisation'", async () => {
    const r = await resolveAuthority(
      {
        dokumenten_typ: "Reisepass",
        bundesland: "Hamburg",
        ausstellungsort: "Hamburg",
      },
      db,
    );
    expect(r.status).toBe("matched");
    if (r.status !== "matched") throw new Error("narrow");
    expect(r.special_rules).toMatch(/keine Legalisation/);
  });

  it("Test 7 (not_found unknown state): unknown bundesland", async () => {
    const r = await resolveAuthority(
      {
        dokumenten_typ: "Geburtsurkunde",
        bundesland: "Atlantis",
        ausstellungsort: "Nowhere",
      },
      db,
    );
    expect(r.status).toBe("not_found");
    if (r.status !== "not_found") throw new Error("narrow");
    expect(r.reason).toBe("unknown_state");
  });

  it("Test 8 (not_found unknown doc type, beyond fuzzy threshold)", async () => {
    const r = await resolveAuthority(
      {
        dokumenten_typ: "Zauberurkunde",
        bundesland: "Berlin",
        ausstellungsort: "Berlin",
      },
      db,
    );
    expect(r.status).toBe("not_found");
    if (r.status !== "not_found") throw new Error("narrow");
    expect(r.reason).toBe("unknown_doc_type");
  });

  it("Test 9 (fuzzy typo within threshold): 'Geburturkunde' matches 'geburtsurkunde'", async () => {
    const r = await resolveAuthority(
      {
        dokumenten_typ: "Geburturkunde",
        bundesland: "Berlin",
        ausstellungsort: "Berlin",
      },
      db,
    );
    expect(r.status).toBe("matched");
    if (r.status !== "matched") throw new Error("narrow");
    expect(r.authority.id).toBe("a4");
  });

  it("Test 10 (Pitfall 6): long-distance unknown type → not_found", async () => {
    const r = await resolveAuthority(
      {
        dokumenten_typ: "Wohnsitzbescheinigung",
        bundesland: "Berlin",
        ausstellungsort: "Berlin",
      },
      db,
    );
    expect(r.status).toBe("not_found");
    if (r.status !== "not_found") throw new Error("narrow");
    expect(r.reason).toBe("unknown_doc_type");
  });

  it("Test 11 (no authority for combination): known state + known doc_type but no row", async () => {
    // Berlin + Heiratsurkunde — fixture has no such authority
    const r = await resolveAuthority(
      {
        dokumenten_typ: "Heiratsurkunde",
        bundesland: "Berlin",
        ausstellungsort: "Berlin",
      },
      db,
    );
    expect(r.status).toBe("not_found");
    if (r.status !== "not_found") throw new Error("narrow");
    expect(r.reason).toBe("no_authority_for_combination");
  });
});
