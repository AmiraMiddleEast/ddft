import { z } from "zod";

/**
 * Zod schemas for Phase 4 Plan 02 Server Actions.
 *
 * person_name  — required, 1..200
 * birthdate    — optional ISO yyyy-MM-dd or empty
 * notes        — optional, max 2000
 * documentIds  — non-empty string array, each id 1..100 chars
 * caseId / caseDocumentId — opaque TEXT ids, non-empty
 *
 * All lengths come from 04-CONTEXT D-01 (case table columns) and defensive
 * guards against client-side length abuse.
 */

export const CreateCaseSchema = z.object({
  personName: z
    .string()
    .trim()
    .min(1, "Bitte den Namen der Person angeben.")
    .max(200, "Name zu lang (max. 200 Zeichen)."),
  personBirthdate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Bitte ein gültiges Datum eingeben.")
    .optional()
    .or(z.literal("")),
  notes: z.string().max(2000, "Notizen zu lang (max. 2000 Zeichen).").optional(),
});

export type CreateCaseInput = z.infer<typeof CreateCaseSchema>;

export const AddDocumentsToCaseSchema = z.object({
  caseId: z.string().min(1).max(100),
  documentIds: z
    .array(z.string().min(1).max(100))
    .min(1, "Mindestens ein Dokument auswählen.")
    .max(50, "Maximal 50 Dokumente pro Aktion."),
});

export type AddDocumentsToCaseInput = z.infer<typeof AddDocumentsToCaseSchema>;

export const RemoveDocumentFromCaseSchema = z.object({
  caseId: z.string().min(1).max(100),
  caseDocumentId: z.string().min(1).max(100),
});

export type RemoveDocumentFromCaseInput = z.infer<
  typeof RemoveDocumentFromCaseSchema
>;

export const ReorderCaseDocumentsSchema = z.object({
  caseId: z.string().min(1).max(100),
  caseDocumentId: z.string().min(1).max(100),
  direction: z.enum(["up", "down"]),
});

export type ReorderCaseDocumentsInput = z.infer<
  typeof ReorderCaseDocumentsSchema
>;
