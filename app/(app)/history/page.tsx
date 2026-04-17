import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { listLauflistenHistoryForUser } from "@/lib/history/queries";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { HistoryFilters } from "./HistoryFilters";

export const metadata = { title: "Historie — Angela" };

const PAGE_SIZE = 20;

function formatDateTimeDe(ts: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(ts);
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function parseDate(input: string | undefined): Date | undefined {
  if (!input) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return undefined;
  const d = new Date(`${input}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function endOfDay(input: string | undefined): Date | undefined {
  if (!input) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return undefined;
  const d = new Date(`${input}T23:59:59.999Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

type SearchParams = {
  q?: string;
  from?: string;
  to?: string;
  page?: string;
};

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const sp = await searchParams;
  const search = (sp.q ?? "").trim();
  const from = sp.from ?? "";
  const to = sp.to ?? "";
  const pageParam = parseInt(sp.page ?? "1", 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const result = await listLauflistenHistoryForUser(
    session.user.id,
    {
      search,
      dateFrom: parseDate(from),
      dateTo: endOfDay(to),
      page,
      pageSize: PAGE_SIZE,
    },
    db,
  );

  const totalPages = Math.max(1, Math.ceil(result.totalCount / PAGE_SIZE));

  return (
    <main className="mx-auto w-full max-w-[1080px] px-6 pt-8 pb-16">
      <nav className="mb-2 text-sm text-muted-foreground">
        <Link href="/" className="underline-offset-2 hover:underline">
          Übersicht
        </Link>
        {" / "}
        <span aria-current="page">Historie</span>
      </nav>

      <section className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-semibold leading-tight">Historie</h1>
        <p className="text-base text-muted-foreground">
          Alle bisher erstellten Lauflisten — durchsuchbar nach Person und
          Zeitraum.
        </p>
      </section>

      <Card className="mb-6">
        <CardContent className="flex flex-col gap-4">
          <HistoryFilters />
        </CardContent>
      </Card>

      {result.items.length === 0 ? (
        <Card>
          <CardContent>
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <p className="text-2xl font-semibold leading-tight">
                Keine Einträge gefunden
              </p>
              <p className="text-base text-muted-foreground">
                Passen Sie die Filter an oder erstellen Sie zuerst eine
                Laufliste.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Erstellt</TableHead>
                <TableHead>Person</TableHead>
                <TableHead>Dokumente</TableHead>
                <TableHead>Größe</TableHead>
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.items.map((r) => (
                <TableRow key={r.lauflisteId}>
                  <TableCell>
                    {formatDateTimeDe(new Date(r.generatedAt))}
                  </TableCell>
                  <TableCell className="max-w-[360px] truncate font-medium">
                    {r.personName}
                  </TableCell>
                  <TableCell>{r.documentCount}</TableCell>
                  <TableCell>{formatBytes(r.fileSize)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <a
                        href={`/api/cases/${r.caseId}/laufliste/${r.lauflisteId}/download`}
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                        })}
                      >
                        Herunterladen
                      </a>
                      <Link
                        href={`/cases/${r.caseId}`}
                        className={buttonVariants({
                          variant: "ghost",
                          size: "sm",
                        })}
                      >
                        Zum Fall
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {totalPages > 1 ? (
        <nav
          aria-label="Seitennavigation"
          className="mt-4 flex items-center justify-between text-sm"
        >
          <span className="text-muted-foreground">
            Seite {page} von {totalPages} · {result.totalCount} Einträge
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={buildHref(sp, page - 1)}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Vorherige
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link
                href={buildHref(sp, page + 1)}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Nächste
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </main>
  );
}

function buildHref(sp: SearchParams, page: number): string {
  const params = new URLSearchParams();
  if (sp.q) params.set("q", sp.q);
  if (sp.from) params.set("from", sp.from);
  if (sp.to) params.set("to", sp.to);
  params.set("page", String(page));
  return `/history?${params.toString()}`;
}
