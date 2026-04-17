import { z } from "zod";

/**
 * Zod schema for the 6 corrected document fields used by the Plan 05 review
 * UI and the Plan 04 approveAndResolve Server Action.
 *
 * The field names MUST match db/schema.ts FIELD_NAMES exactly:
 *   dokumenten_typ, ausstellende_behoerde, ausstellungsort, bundesland,
 *   ausstellungsdatum, voller_name.
 *
 * Length caps come from research §Pattern 3 (200 / 300 / 200 / 100 / 300).
 * `bundesland` is NOT restricted to the 16-state enum here — the UI Select
 * constrains it client-side; server-side the resolver handles unknown states
 * gracefully via the `unknown_state` result.
 * `dokumenten_typ` is NOT a slug enum — the resolver does fuzzy matching.
 * `ausstellungsdatum` accepts an ISO date (yyyy-MM-dd) OR empty string (the
 * field may legitimately be blank when Claude could not extract it).
 */
export const CorrectedFieldsSchema = z.object({
  dokumenten_typ: z
    .string()
    .min(1, "Bitte einen Dokumenttyp auswählen.")
    .max(200),
  ausstellende_behoerde: z.string().max(300),
  ausstellungsort: z
    .string()
    .min(1, "Bitte einen Ausstellungsort angeben.")
    .max(200),
  bundesland: z.string().min(1, "Bitte ein Bundesland auswählen.").max(100),
  ausstellungsdatum: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, {
      message: "Bitte ein gültiges Datum eingeben.",
    })
    .or(z.literal("")),
  voller_name: z.string().max(300),
});

export type CorrectedFields = z.infer<typeof CorrectedFieldsSchema>;

/**
 * Top-level schema for the approveAndResolve Server Action input.
 */
export const ApproveSchema = z.object({
  documentId: z.string().min(1),
  corrected: CorrectedFieldsSchema,
});

export type ApproveInput = z.infer<typeof ApproveSchema>;

/**
 * Schema for the chooseAmbiguousAuthority Server Action — used when an
 * ambiguous approval result surfaces multiple candidates and the operator
 * picks one via the UI's "Diese Behörde übernehmen" CTA.
 */
export const ChooseAuthoritySchema = z.object({
  documentId: z.string().min(1),
  authorityId: z.string().min(1),
});

export type ChooseAuthorityInput = z.infer<typeof ChooseAuthoritySchema>;
