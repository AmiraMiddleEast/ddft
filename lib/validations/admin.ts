import { z } from "zod";

/**
 * Phase 5 Plan 04 — Zod schemas for Behörden admin mutations.
 *
 * All optional string fields allow empty string → persisted as NULL so the
 * UI can clear a field by submitting an empty input.
 *
 * Length caps are defensive — the DB itself has no length limits (TEXT) but
 * the UI and storage paths aren't designed for unbounded strings.
 */

export const AuthorityPatchSchema = z.object({
  name: z.string().trim().min(1, "Name darf nicht leer sein.").max(300),
  address: z.string().trim().min(1, "Adresse darf nicht leer sein.").max(500),
  phone: z.string().trim().max(100).optional().nullable().or(z.literal("")),
  email: z
    .string()
    .trim()
    .max(200)
    .refine(
      (v) => !v || /.+@.+\..+/.test(v),
      "Bitte eine gültige E-Mail-Adresse angeben.",
    )
    .optional()
    .nullable()
    .or(z.literal("")),
  website: z.string().trim().max(500).optional().nullable().or(z.literal("")),
  officeHours: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .or(z.literal("")),
  notes: z.string().trim().max(2000).optional().nullable().or(z.literal("")),
  specialRules: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .or(z.literal("")),
  needsReview: z.boolean().optional().default(false),
});

export type AuthorityPatch = z.infer<typeof AuthorityPatchSchema>;

/**
 * Schema for creating a brand-new authority. Extends the patch (contact fields)
 * with the identity fields: which Bundesland + Dokumentenart it belongs to, and
 * an optional Regierungsbezirk. Empty string on the optional RB → NULL.
 */
export const AuthorityCreateSchema = AuthorityPatchSchema.extend({
  stateId: z.string().trim().min(1, "Bitte ein Bundesland wählen."),
  documentTypeId: z.string().trim().min(1, "Bitte eine Dokumentenart wählen."),
  regierungsbezirkId: z
    .string()
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),
});

export type AuthorityCreateInput = z.infer<typeof AuthorityCreateSchema>;

export const DocumentTypeSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Bitte einen Anzeigenamen angeben.")
    .max(100, "Anzeigename ist zu lang (max. 100 Zeichen)."),
});

export type DocumentTypeInput = z.infer<typeof DocumentTypeSchema>;
