import { z } from "zod";

/**
 * Quick 260626-wou — Zod schema for the runtime settings form.
 *
 * A blank apiKey means "keep the existing key" — so it is optional / empty-allowed.
 * The model is required (free-text so new model IDs can be entered).
 */
export const SettingsSchema = z.object({
  // blank apiKey = keep existing → optional/empty allowed
  apiKey: z.string().trim().max(300).optional().or(z.literal("")),
  model: z.string().trim().min(1, "Modell darf nicht leer sein.").max(100),
});

export type SettingsInput = z.infer<typeof SettingsSchema>;
