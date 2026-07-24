import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email({ message: "Enter a valid email address." }),
  password: z
    .string()
    .min(12, { message: "Password must be at least 12 characters." }),
});

export type LoginInput = z.infer<typeof loginSchema>;
