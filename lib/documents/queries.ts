import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { document, extraction, type FieldName } from "@/db/schema";

export async function getDocumentForUser(documentId: string, userId: string) {
  const [row] = await db
    .select()
    .from(document)
    .where(and(eq(document.id, documentId), eq(document.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function listRecentDocumentsForUser(userId: string, limit = 5) {
  return db
    .select()
    .from(document)
    .where(eq(document.userId, userId))
    .orderBy(desc(document.uploadedAt))
    .limit(limit);
}

export type ExtractionRow = {
  fieldName: FieldName;
  fieldValue: string | null;
  confidence: "high" | "medium" | "low";
  reasoning: string | null;
};

export async function getExtractionsForDocument(
  documentId: string,
  userId: string, // required — prevents accidental use without ownership verification
): Promise<ExtractionRow[]> {
  return db
    .select({
      fieldName: extraction.fieldName,
      fieldValue: extraction.fieldValue,
      confidence: extraction.confidence,
      reasoning: extraction.reasoning,
    })
    .from(extraction)
    .innerJoin(document, eq(extraction.documentId, document.id))
    .where(and(eq(extraction.documentId, documentId), eq(document.userId, userId)));
}
