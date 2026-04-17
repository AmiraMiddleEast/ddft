// Seed a realistic Phase 2 fixture (user + document + 6 extraction rows + 1 log)
// so the operator can open /documents/{id} during the human-verify checkpoint
// WITHOUT burning Claude tokens or triggering a real upload.
//
// Run:
//   npx tsx scripts/seed-extraction-fixture.ts
//
// NOTE: Plan 02-07 originally specified a `.mjs` file, but pure Node ESM could
// not import the `.ts` Drizzle modules cleanly (named-export resolution failure
// between mjs -> ts). The file is `.ts` and invoked via `tsx` — this matches
// the existing `scripts/seed-user.ts` convention. Documented in SUMMARY.
//
// Optional env vars:
//   SEED_EMAIL=seed@angela.local  (existing user to attach the document to)
//   SEED_SOURCE_PDF=transcript.pdf (relative to repo root; default: transcript.pdf)
//
// Notes:
//   * The script reuses an existing user if one with SEED_EMAIL already exists;
//     otherwise it inserts a bare user row. For real sign-in flows, seed a
//     password-backed user first via `npm run seed` (scripts/seed-user.ts).
//   * The source PDF is copied into data/uploads/{documentId}.pdf so the
//     /api/documents/[id]/pdf Route Handler can serve it.
//   * Re-running is safe: inserts use onConflictDoNothing, and the copied
//     file is simply overwritten.

import path from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { eq } from "drizzle-orm";

import { db } from "../db/client";
import {
  document,
  extraction,
  extractionLog,
  user,
  type Confidence,
  type FieldName,
} from "../db/schema";
import { computeCostEur } from "../lib/extraction/cost";

const SEED_EMAIL = process.env.SEED_EMAIL ?? "seed@angela.local";
const SEED_USER_ID = "seed-user";
const SEED_DOC_ID = "seed-doc-1";
const SOURCE_PDF = process.env.SEED_SOURCE_PDF ?? "transcript.pdf";

const FIELDS: ReadonlyArray<readonly [FieldName, string, Confidence, string]> =
  [
    ["dokumenten_typ", "Zeugnis", "high", "Title line 'Zeugnis'"],
    ["ausstellende_behoerde", "Universität Heidelberg", "high", "Institutional header"],
    ["ausstellungsort", "Heidelberg", "high", "City printed in header"],
    ["bundesland", "Baden-Württemberg", "medium", "Inferred from city"],
    ["ausstellungsdatum", "2021-06-30", "high", "Date stamped at bottom"],
    ["voller_name", "Max Mustermann", "high", "Name line"],
  ] as const;

async function main() {
  // 1) Ensure a user row exists. If SEED_EMAIL matches an existing user, reuse
  //    their id so the fixture is attributable to a sign-in-able account.
  const existing = await db
    .select()
    .from(user)
    .where(eq(user.email, SEED_EMAIL))
    .limit(1);

  let userId: string;
  if (existing.length > 0) {
    userId = existing[0].id;
    console.log(`[seed] Reusing existing user ${SEED_EMAIL} (id=${userId}).`);
  } else {
    userId = SEED_USER_ID;
    await db
      .insert(user)
      .values({
        id: userId,
        name: "Seed User",
        email: SEED_EMAIL,
        emailVerified: true,
      })
      .onConflictDoNothing();
    console.log(
      `[seed] Inserted placeholder user ${SEED_EMAIL} (id=${userId}). ` +
        `Use 'npm run seed' with SEED_EMAIL=${SEED_EMAIL} to attach a password.`,
    );
  }

  // 2) Copy the source PDF into data/uploads/{SEED_DOC_ID}.pdf so the Route
  //    Handler can serve it with a stable path.
  const srcAbs = path.resolve(process.cwd(), SOURCE_PDF);
  const pdfBytes = await readFile(srcAbs);
  const storagePath = `data/uploads/${SEED_DOC_ID}.pdf`;
  const dstAbs = path.resolve(process.cwd(), storagePath);
  await mkdir(path.dirname(dstAbs), { recursive: true });
  await writeFile(dstAbs, pdfBytes);
  console.log(
    `[seed] Copied ${SOURCE_PDF} → ${storagePath} (${pdfBytes.byteLength} bytes).`,
  );

  // 3) Insert document row. Use a deterministic fake sha256 so re-runs dedup.
  await db
    .insert(document)
    .values({
      id: SEED_DOC_ID,
      userId,
      filename: path.basename(SOURCE_PDF),
      size: pdfBytes.byteLength,
      sha256: `seed-fixture-${SEED_DOC_ID}`,
      mime: "application/pdf",
      storagePath,
      extractionStatus: "done",
      extractedAt: new Date(),
      errorCode: null,
    })
    .onConflictDoNothing();

  // 4) Insert 6 extraction rows with plausible German values.
  for (const [fieldName, fieldValue, confidence, reasoning] of FIELDS) {
    await db
      .insert(extraction)
      .values({
        id: `seed-ext-${fieldName}`,
        documentId: SEED_DOC_ID,
        fieldName,
        fieldValue,
        confidence,
        reasoning,
      })
      .onConflictDoNothing();
  }

  // 5) Insert one extraction_log row with computed cost.
  const INPUT_TOKENS = 5000;
  const OUTPUT_TOKENS = 400;
  const MODEL = "claude-sonnet-4-20250514";
  await db
    .insert(extractionLog)
    .values({
      id: "seed-log-1",
      documentId: SEED_DOC_ID,
      inputTokens: INPUT_TOKENS,
      outputTokens: OUTPUT_TOKENS,
      costEur: computeCostEur(MODEL, INPUT_TOKENS, OUTPUT_TOKENS),
      claudeModel: MODEL,
    })
    .onConflictDoNothing();

  console.log(
    `[seed] Done. Visit /documents/${SEED_DOC_ID} after signing in as ${SEED_EMAIL}.`,
  );
}

main().catch((err) => {
  console.error("[seed] FAILED:", err);
  process.exit(1);
});
