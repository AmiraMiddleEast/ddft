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

const BL_KEYS = [
  "BW",
  "BY",
  "BE",
  "BB",
  "HB",
  "HH",
  "HE",
  "MV",
  "NI",
  "NW",
  "RP",
  "SL",
  "SN",
  "ST",
  "SH",
  "TH",
] as const;

export const CreateCaseSchema = z
  .object({
    personName: z
      .string()
      .trim()
      .min(1, "Enter the person's name.")
      .max(200, "Name is too long (max. 200 characters)."),
    personBirthdate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.")
      .optional()
      .or(z.literal("")),
    notes: z
      .string()
      .max(2000, "Notes are too long (max. 2000 characters).")
      .optional(),
    beruf: z.enum(["arzt", "zahnarzt"], {
      message: "Select a profession (physician or dentist).",
    }),
    wohnsitzBundesland: z.enum(BL_KEYS, {
      message: "Select the federal state of residence.",
    }),
    arbeitsortBundesland: z
      .enum([...BL_KEYS, "AUSLAND"], {
        message: "Select the place of work (federal state or abroad).",
      }),
    nrwSubregion: z
      .enum(["nordrhein", "westfalen-lippe"])
      .optional()
      .or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    const hasNrw =
      data.wohnsitzBundesland === "NW" || data.arbeitsortBundesland === "NW";
    if (hasNrw && !data.nrwSubregion) {
      ctx.addIssue({
        code: "custom",
        path: ["nrwSubregion"],
        message:
          "For NRW, select Nordrhein or Westfalen-Lippe.",
      });
    }
  });

export type CreateCaseInput = z.infer<typeof CreateCaseSchema>;

export const AddDocumentsToCaseSchema = z.object({
  caseId: z.string().min(1).max(100),
  documentIds: z
    .array(z.string().min(1).max(100))
    .min(1, "Select at least one document.")
    .max(50, "At most 50 documents per action."),
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
