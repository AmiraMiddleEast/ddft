import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email({ message: "E-Mail-Adresse ungültig." }),
  password: z
    .string()
    .min(12, { message: "Passwort muss mindestens 12 Zeichen haben." }),
});

export type LoginInput = z.infer<typeof loginSchema>;
