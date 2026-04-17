import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import {
  listAuthoritiesAdmin,
  listDocumentTypesAdmin,
  listStatesAdmin,
} from "@/lib/admin/queries";
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

import { AuthoritiesFilters } from "./AuthoritiesFilters";

export const metadata = { title: "Behörden bearbeiten — Angela" };

const PAGE_SIZE = 20;

type SearchParams = {
  q?: string;
  stateId?: string;
  docTypeId?: string;
  needsReview?: string;
  page?: string;
};

export default async function AuthoritiesAdminPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const needsReview =
    sp.needsReview === "1"
      ? true
      : sp.needsReview === "0"
        ? false
        : undefined;

  const [result, states, docTypes] = await Promise.all([
    listAuthoritiesAdmin({
      search: sp.q,
      stateId: sp.stateId || undefined,
      docTypeId: sp.docTypeId || undefined,
      needsReview,
      page,
      pageSize: PAGE_SIZE,
    }),
    listStatesAdmin(),
    listDocumentTypesAdmin(),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.totalCount / PAGE_SIZE));

  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 pt-8 pb-16">
      <nav className="mb-2 text-sm text-muted-foreground">
        <Link href="/admin/behoerden" className="underline-offset-2 hover:underline">
          Behörden
        </Link>
        {" / "}
        <span aria-current="page">Behörden bearbeiten</span>
      </nav>

      <section className="mb-6">
        <h1 className="text-2xl font-semibold leading-tight">
          Behörden bearbeiten
        </h1>
        <p className="mt-1 text-base text-muted-foreground">
          Suchen, filtern und einzelne Kontaktdaten aktualisieren.
        </p>
      </section>

      <Card className="mb-6">
        <CardContent className="flex flex-col gap-4">
          <AuthoritiesFilters states={states} docTypes={docTypes} />
        </CardContent>
      </Card>

      {result.items.length === 0 ? (
        <Card>
          <CardContent>
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <p className="text-2xl font-semibold leading-tight">
                Keine Treffer
              </p>
              <p className="text-base text-muted-foreground">
                Passen Sie die Filter an.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Bundesland</TableHead>
                <TableHead>Dokumentenart</TableHead>
                <TableHead>Regierungsbezirk</TableHead>
                <TableHead>Prüfen</TableHead>
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.items.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="max-w-[320px] truncate font-medium">
                    {a.name}
                  </TableCell>
                  <TableCell>{a.stateName}</TableCell>
                  <TableCell>{a.documentTypeName}</TableCell>
                  <TableCell>{a.regierungsbezirkName ?? "—"}</TableCell>
                  <TableCell>
                    {a.needsReview ? (
                      <Badge variant="warning">Prüfen</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/admin/behoerden/authorities/${a.id}/edit`}
                      className={buttonVariants({
                        variant: "ghost",
                        size: "sm",
                      })}
                    >
                      Bearbeiten
                    </Link>
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
  if (sp.stateId) params.set("stateId", sp.stateId);
  if (sp.docTypeId) params.set("docTypeId", sp.docTypeId);
  if (sp.needsReview) params.set("needsReview", sp.needsReview);
  params.set("page", String(page));
  return `/admin/behoerden/authorities?${params.toString()}`;
}
