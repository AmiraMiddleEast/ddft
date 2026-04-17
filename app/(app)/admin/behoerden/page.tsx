import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getAdminStats } from "@/lib/admin/queries";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Behörden — Angela" };

export default async function AdminBehoerdenPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const stats = await getAdminStats();

  const cards: Array<{
    label: string;
    value: number;
    href: string | null;
    hint: string;
  }> = [
    {
      label: "Bundesländer",
      value: stats.states,
      href: null,
      hint: "Fest seeded",
    },
    {
      label: "Dokumentenarten",
      value: stats.documentTypes,
      href: "/admin/behoerden/document-types",
      hint: "Bearbeiten / Hinzufügen",
    },
    {
      label: "Behörden",
      value: stats.authorities,
      href: "/admin/behoerden/authorities",
      hint: "Durchsuchen & bearbeiten",
    },
    {
      label: "Zur Überprüfung",
      value: stats.needsReview,
      href: `/admin/behoerden/authorities?needsReview=1`,
      hint: "Prüfen-Flag gesetzt",
    },
  ];

  return (
    <main className="mx-auto w-full max-w-[1080px] px-6 pt-8 pb-16">
      <nav className="mb-2 text-sm text-muted-foreground">
        <Link href="/" className="underline-offset-2 hover:underline">
          Übersicht
        </Link>
        {" / "}
        <span aria-current="page">Behörden</span>
      </nav>

      <section className="mb-6">
        <h1 className="text-2xl font-semibold leading-tight">Behörden</h1>
        <p className="mt-1 text-base text-muted-foreground">
          Dashboard für die Pflege der Behörden-Datenbank.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <p className="text-3xl font-semibold leading-tight">{c.value}</p>
              <p className="text-xs text-muted-foreground">{c.hint}</p>
              {c.href ? (
                <Link
                  href={c.href}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Öffnen
                </Link>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
