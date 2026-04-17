import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { auth } from "@/lib/auth";
import { listRecentDocumentsForUser } from "@/lib/documents/queries";

export const metadata = { title: "Übersicht — Angela" };

function formatDe(ts: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(ts);
}

const STATUS_COPY = {
  pending: { label: "In Warteschlange", variant: "secondary" as const },
  extracting: { label: "Wird analysiert", variant: "secondary" as const },
  done: { label: "Fertig", variant: "outline" as const },
  error: { label: "Fehler", variant: "destructive" as const },
} as const;

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const docs = await listRecentDocumentsForUser(session.user.id, 5);

  return (
    <main className="mx-auto w-full max-w-[960px] px-6 pt-8">
      <section className="mb-12 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold leading-tight">Übersicht</h1>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href="/cases"
            className={buttonVariants({ variant: "outline" })}
          >
            Fälle
          </Link>
          <Link href="/upload" className={buttonVariants()}>
            Dokumente hochladen
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-semibold leading-tight">
          Zuletzt hochgeladen
        </h2>
        <Card>
          <CardContent>
            {docs.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-12 text-center">
                <p className="text-2xl font-semibold leading-tight">
                  Noch keine Dokumente
                </p>
                <p className="text-base text-muted-foreground">
                  Laden Sie Ihr erstes Dokument hoch, um mit der Analyse zu
                  beginnen.
                </p>
                <Link href="/upload" className={buttonVariants()}>
                  Dokumente hochladen
                </Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dateiname</TableHead>
                    <TableHead>Hochgeladen</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docs.map((d) => {
                    const s = STATUS_COPY[d.extractionStatus];
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="max-w-[320px] truncate">
                          {d.filename}
                        </TableCell>
                        <TableCell>
                          {formatDe(new Date(d.uploadedAt))}
                        </TableCell>
                        <TableCell>
                          <Badge variant={s.variant}>{s.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            href={`/documents/${d.id}`}
                            className={buttonVariants({
                              variant: "ghost",
                              size: "sm",
                            })}
                          >
                            Öffnen
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
