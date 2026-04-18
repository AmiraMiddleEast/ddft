import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { cogsKammer } from "@/db/schema";
import { eq } from "drizzle-orm";
import { EditCogsKammerForm } from "./EditCogsKammerForm";

export const metadata = { title: "CoGS-Eintrag bearbeiten — Angela" };

export default async function EditCogsKammerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { id } = await params;
  const [row] = await db
    .select()
    .from(cogsKammer)
    .where(eq(cogsKammer.id, id))
    .limit(1);
  if (!row) notFound();

  return (
    <main className="mx-auto w-full max-w-[900px] px-6 pt-8">
      <header className="mb-6">
        <p className="text-sm text-muted-foreground">
          ← <a href="/admin/cogs" className="underline">Zurück zur Übersicht</a>
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight">
          {row.bundeslandName} · {row.beruf === "arzt" ? "Arzt" : "Zahnarzt"}
        </h1>
        <p className="mt-1 text-base text-muted-foreground">
          CoGS-Eintrag bearbeiten
        </p>
      </header>
      <EditCogsKammerForm row={row} />
    </main>
  );
}
