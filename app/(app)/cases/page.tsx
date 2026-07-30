import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { caseDocument } from "@/db/schema";
import { listCasesForUser } from "@/lib/cases/queries";
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

export const metadata = { title: "Cases — DDFT" };

function formatDe(ts: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(ts);
}

type CaseStatus = "open" | "ready_for_pdf" | "pdf_generated";

const STATUS_COPY: Record<
  CaseStatus,
  { label: string; variant: "warning" | "outline" | "secondary" }
> = {
  open: { label: "In Bearbeitung", variant: "warning" },
  ready_for_pdf: { label: "Bereit", variant: "outline" },
  pdf_generated: { label: "Laufliste created", variant: "secondary" },
};

export default async function CasesListPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const cases = await listCasesForUser(session.user.id, db);

  // Count documents per case (see plan Task 1.1 recommendation — second query
  // merged client-side, avoids altering Plan 02 queries).
  const counts = await db
    .select({
      caseId: caseDocument.caseId,
      count: sql<number>`count(*)`,
    })
    .from(caseDocument)
    .groupBy(caseDocument.caseId);
  const countMap = new Map(counts.map((c) => [c.caseId, Number(c.count)]));

  return (
    <main className="mx-auto w-full max-w-[1080px] px-6 pt-8">
      <nav className="mb-2 text-sm text-muted-foreground">
        <Link href="/" className="underline-offset-2 hover:underline">
          Overview
        </Link>
        {" / "}
        <span aria-current="page">Cases</span>
      </nav>

      <section className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold leading-tight">Cases</h1>
          <p className="text-base text-muted-foreground">
            Cases group one person's documents into a single Laufliste.
          </p>
        </div>
        <Link href="/cases/new" className={buttonVariants()}>
          Create new case
        </Link>
      </section>

      {cases.length === 0 ? (
        <Card>
          <CardContent>
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <p className="text-2xl font-semibold leading-tight">
                No cases yet
              </p>
              <p className="text-base text-muted-foreground">
                Create a case to group documents for one person
                together.
              </p>
              <Link href="/cases/new" className={buttonVariants()}>
                Create new case
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {cases.map((c) => {
                const status =
                  STATUS_COPY[c.status as CaseStatus] ?? STATUS_COPY.open;
                const docCount = countMap.get(c.id) ?? 0;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="max-w-[360px] truncate font-medium">
                      {c.personName}
                    </TableCell>
                    <TableCell>{docCount}</TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell>{formatDe(new Date(c.updatedAt))}</TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/cases/${c.id}`}
                        className={buttonVariants({
                          variant: "ghost",
                          size: "sm",
                        })}
                      >
                        Open
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </main>
  );
}
