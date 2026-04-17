"use server";

import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import {
  document,
  extraction,
  extractionLog,
  FIELD_NAMES,
  type FieldName,
} from "@/db/schema";
import { extractFields } from "./claude";
import { computeCostEur } from "./cost";
import type { UploadErrorCode } from "@/lib/uploads/errors";

export type ExtractionActionResult =
  | { ok: true; documentId: string }
  | { ok: false; documentId: string; error: UploadErrorCode | "not_found" };

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runExtractionOnce(storagePath: string) {
  return await extractFields(storagePath);
}

async function runExtractionWithOneRetry(storagePath: string) {
  try {
    return await runExtractionOnce(storagePath);
  } catch (e: unknown) {
    const err = e as { status?: number; headers?: Record<string, string> };
    if (err?.status === 429) {
      const retryAfterSec = Number(err.headers?.["retry-after"] ?? "1");
      const ms = Math.min(Math.max(retryAfterSec, 0), 30) * 1000;
      if (ms > 0) await sleep(ms);
      return await runExtractionOnce(storagePath);
    }
    throw e;
  }
}

export async function extractDocumentAction(
  documentId: string,
): Promise<ExtractionActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { ok: false, documentId, error: "unauthenticated" };
  }

  const [doc] = await db
    .select()
    .from(document)
    .where(
      and(eq(document.id, documentId), eq(document.userId, session.user.id)),
    )
    .limit(1);
  if (!doc) return { ok: false, documentId, error: "not_found" };

  // If already done, no-op (idempotent).
  if (doc.extractionStatus === "done") return { ok: true, documentId };

  await db
    .update(document)
    .set({ extractionStatus: "extracting", errorCode: null })
    .where(eq(document.id, documentId));

  let result: Awaited<ReturnType<typeof extractFields>>;
  try {
    result = await runExtractionWithOneRetry(doc.storagePath);
  } catch (e: unknown) {
    const err = e as { status?: number };
    const code: UploadErrorCode =
      err?.status === 429 ? "rate_limited" : "unknown";
    await db
      .update(document)
      .set({ extractionStatus: "error", errorCode: code })
      .where(eq(document.id, documentId));
    return { ok: false, documentId, error: code };
  }

  // Persist in a single transaction: 6 extraction rows + 1 log + document status update.
  // better-sqlite3 transactions are synchronous — use .run() (sync) on each query
  // and keep the callback non-async (RESEARCH Pitfall: "Transaction function
  // cannot return a promise").
  try {
    db.transaction((tx) => {
      const now = Date.now();
      for (const name of FIELD_NAMES as readonly FieldName[]) {
        const f = result.parsed[name];
        tx.insert(extraction)
          .values({
            id: crypto.randomUUID(),
            documentId,
            fieldName: name,
            fieldValue: f.value, // null preserved (D-12)
            confidence: f.confidence,
            reasoning: f.reasoning,
          })
          .onConflictDoNothing({
            target: [extraction.documentId, extraction.fieldName],
          })
          .run();
      }
      tx.insert(extractionLog)
        .values({
          id: crypto.randomUUID(),
          documentId,
          inputTokens: result.usage.input_tokens,
          outputTokens: result.usage.output_tokens,
          costEur: computeCostEur(
            result.model,
            result.usage.input_tokens,
            result.usage.output_tokens,
          ),
          claudeModel: result.model,
        })
        .run();
      tx.update(document)
        .set({
          extractionStatus: "done",
          extractedAt: new Date(now),
          errorCode: null,
        })
        .where(eq(document.id, documentId))
        .run();
    });
  } catch {
    await db
      .update(document)
      .set({ extractionStatus: "error", errorCode: "unknown" })
      .where(eq(document.id, documentId));
    return { ok: false, documentId, error: "unknown" };
  }

  return { ok: true, documentId };
}
