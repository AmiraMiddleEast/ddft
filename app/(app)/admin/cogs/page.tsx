import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { cogsKammer } from "@/db/schema";
import { asc } from "drizzle-orm";
import { buttonVariants } from "@/components/ui/button";

export const metadata = {
  title: "Certificate of Good Standing — Verwaltung",
};

export default async function CogsAdminPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const rows = await db
    .select()
    .from(cogsKammer)
    .orderBy(asc(cogsKammer.bundeslandName), asc(cogsKammer.beruf));

  const total = rows.length;
  const complete = rows.filter((r) => r.datenVollstaendig).length;

  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 pt-8">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold leading-tight">
          Certificate of Good Standing — Verwaltung
        </h1>
        <p className="mt-2 text-base leading-normal text-muted-foreground">
          Verfahren, Kontaktdaten und Empfängeradressen für das CoGS je
          Bundesland × Beruf. {complete} von {total} Einträgen vollständig.
        </p>
      </header>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2 font-semibold">Bundesland</th>
              <th className="px-3 py-2 font-semibold">Beruf</th>
              <th className="px-3 py-2 font-semibold">Zuständige Stelle</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">{r.bundeslandName}</td>
                <td className="px-3 py-2">
                  {r.beruf === "arzt" ? "Arzt" : "Zahnarzt"}
                </td>
                <td className="px-3 py-2">{r.zustaendigeStelle}</td>
                <td className="px-3 py-2">
                  {r.datenVollstaendig ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                      vollständig
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                      Lücken
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/admin/cogs/${r.id}/edit`}
                    className={buttonVariants({
                      variant: "ghost",
                      size: "sm",
                    })}
                  >
                    Bearbeiten →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
