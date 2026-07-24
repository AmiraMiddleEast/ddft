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

export const metadata = { title: "Overview — DDFT" };

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
  pending: { label: "Queued", variant: "secondary" as const },
  extracting: { label: "Analyzing", variant: "secondary" as const },
  done: { label: "Done", variant: "outline" as const },
  error: { label: "Error", variant: "destructive" as const },
} as const;

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const docs = await listRecentDocumentsForUser(session.user.id, 5);

  return (
    <main className="mx-auto w-full max-w-[960px] px-6 pt-8">
      <section className="mb-12 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold leading-tight">Overview</h1>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href="/cases"
            className={buttonVariants({ variant: "outline" })}
          >
            Cases
          </Link>
          <Link href="/upload" className={buttonVariants()}>
            Upload documents
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-semibold leading-tight">
          Recently uploaded
        </h2>
        <Card>
          <CardContent>
            {docs.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-12 text-center">
                <p className="text-2xl font-semibold leading-tight">
                  No documents yet
                </p>
                <p className="text-base text-muted-foreground">
                  Upload your first document to start the analysis.
                </p>
                <Link href="/upload" className={buttonVariants()}>
                  Upload documents
                </Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File name</TableHead>
                    <TableHead>Uploaded</TableHead>
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
                            Open
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
