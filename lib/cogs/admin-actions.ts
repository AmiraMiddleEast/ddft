"use server";

import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { cogsKammer } from "@/db/schema";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const PatchSchema = z.object({
  id: z.string().min(1),
  kammerName: z.string().optional().or(z.literal("")),
  kammerWebsite: z.string().optional().or(z.literal("")),
  zustaendigeStelle: z.string().min(1, "Pflichtfeld"),
  zustaendigeStelleHinweis: z.string().optional().or(z.literal("")),
  directUrlGoodStanding: z.string().optional().or(z.literal("")),
  antragsverfahren: z.string().optional().or(z.literal("")),
  erforderlicheDokumente: z.string().optional().or(z.literal("")),
  fuehrungszeugnisOErforderlich: z.string().optional().or(z.literal("")),
  fuehrungszeugnisOEmpfaenger: z
    .string()
    .min(1, "Empfängerbehörde für Führungszeugnis O ist Pflicht."),
  kontaktEmail: z.string().optional().or(z.literal("")),
  kontaktTelefon: z.string().optional().or(z.literal("")),
  kontaktAdresse: z.string().optional().or(z.literal("")),
  besonderheiten: z.string().optional().or(z.literal("")),
  datenVollstaendig: z.boolean(),
});

export type UpdateCogsKammerInput = z.infer<typeof PatchSchema>;

export async function updateCogsKammerAction(
  input: UpdateCogsKammerInput,
): Promise<
  { ok: true } | { ok: false; error: string; details?: unknown }
> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: "unauthenticated" };

  const parsed = PatchSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "validation",
      details: parsed.error.flatten(),
    };
  }
  const p = parsed.data;

  try {
    await db
      .update(cogsKammer)
      .set({
        kammerName: p.kammerName || null,
        kammerWebsite: p.kammerWebsite || null,
        zustaendigeStelle: p.zustaendigeStelle,
        zustaendigeStelleHinweis: p.zustaendigeStelleHinweis || null,
        directUrlGoodStanding: p.directUrlGoodStanding || null,
        antragsverfahren: p.antragsverfahren || null,
        erforderlicheDokumente: p.erforderlicheDokumente || null,
        fuehrungszeugnisOErforderlich: p.fuehrungszeugnisOErforderlich || null,
        fuehrungszeugnisOEmpfaenger: p.fuehrungszeugnisOEmpfaenger,
        kontaktEmail: p.kontaktEmail || null,
        kontaktTelefon: p.kontaktTelefon || null,
        kontaktAdresse: p.kontaktAdresse || null,
        besonderheiten: p.besonderheiten || null,
        datenVollstaendig: p.datenVollstaendig,
        updatedBy: session.user.id,
      })
      .where(eq(cogsKammer.id, p.id));
  } catch (err) {
    console.error("[updateCogsKammerAction] failed:", err);
    return { ok: false, error: "db_error" };
  }

  revalidatePath("/admin/cogs");
  revalidatePath(`/admin/cogs/${p.id}/edit`);
  return { ok: true };
}
