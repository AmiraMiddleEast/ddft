import Link from "next/link";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import {
  getCaseForUser,
  listCaseDocuments,
  listAssignableDocuments,
} from "@/lib/cases/queries";
import { listLauflistenForCase } from "@/lib/laufliste/queries";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import { DocumentsTable } from "./DocumentsTable";
import { CaseDetailClient } from "./CaseDetailClient";
import { AddDocumentsSheet } from "./AddDocumentsSheet";

function formatDateDe(ts: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(ts);
}

function formatDateTimeDe(ts: Date) {
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

function formatBirthdate(value: string | null | undefined): string | null {
  if (!value) return null;
  // Values are stored as "yyyy-MM-dd" (see CreateCaseSchema regex).
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return value;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

type CaseStatus = "open" | "ready_for_pdf" | "pdf_generated";

const STATUS_COPY: Record<
  CaseStatus,
  { label: string; variant: "warning" | "outline" | "secondary" }
> = {
  open: { label: "In Bearbeitung", variant: "warning" },
  ready_for_pdf: { label: "Bereit", variant: "outline" },
  pdf_generated: { label: "Laufliste erstellt", variant: "secondary" },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { title: "Fall — Angela" };
  const caseRow = await getCaseForUser(id, session.user.id, db);
  if (!caseRow) return { title: "Fall — Angela" };
  return { title: `${caseRow.personName} — Angela` };
}

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const caseRow = await getCaseForUser(id, session.user.id, db);
  if (!caseRow) notFound();

  const [docs, lauflisten, assignableDocs] = await Promise.all([
    listCaseDocuments(id, session.user.id, db),
    listLauflistenForCase(id, session.user.id, db),
    listAssignableDocuments(session.user.id, db),
  ]);

  const isEmpty = docs.length === 0;
  const hasUnreviewed = docs.some((d) => d.reviewStatus !== "approved");
  const canGenerate = !isEmpty && !hasUnreviewed;
  const latestLaufliste = lauflisten[0] ?? null;
  const historie = lauflisten.slice(1);

  const status = STATUS_COPY[caseRow.status as CaseStatus] ?? STATUS_COPY.open;
  const birthdate = formatBirthdate(caseRow.personBirthdate);

  return (
    <main className="mx-auto w-full max-w-[1080px] px-6 pt-8 pb-16">
      <nav className="mb-2 text-sm text-muted-foreground">
        <Link href="/" className="underline-offset-2 hover:underline">
          Übersicht
        </Link>
        {" / "}
        <Link href="/cases" className="underline-offset-2 hover:underline">
          Fälle
        </Link>
        {" / "}
        <span aria-current="page">{caseRow.personName}</span>
      </nav>

      <div className="flex flex-col gap-8">
        {/* Person header card */}
        <Card>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
              <h1 className="text-2xl font-semibold leading-tight">
                {caseRow.personName}
              </h1>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Erstellt am {formatDateDe(new Date(caseRow.createdAt))}
              {docs.length > 0 ? ` · ${docs.length} Dokumente` : null}
            </p>
            <dl className="grid grid-cols-[128px_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="font-semibold">Geburtsdatum</dt>
              <dd className={birthdate ? "" : "text-muted-foreground"}>
                {birthdate ?? "— nicht hinterlegt"}
              </dd>
              <dt className="font-semibold">Notizen</dt>
              <dd
                className={
                  caseRow.notes
                    ? "whitespace-pre-wrap"
                    : "text-muted-foreground"
                }
              >
                {caseRow.notes ?? "— nicht hinterlegt"}
              </dd>
            </dl>
          </CardContent>
        </Card>

        {/* Blocker banners */}
        {isEmpty ? (
          <div
            role="status"
            className="rounded-md border border-transparent bg-[--color-warning]/20 p-4 text-sm font-medium text-foreground"
          >
            Bitte mindestens ein Dokument hinzufügen.
          </div>
        ) : hasUnreviewed ? (
          <div
            role="status"
            className="rounded-md border border-transparent bg-[--color-warning]/20 p-4 text-sm font-medium text-foreground"
          >
            Mindestens ein Dokument ist noch nicht geprüft.
          </div>
        ) : null}

        {/* Documents card */}
        <Card>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-semibold leading-tight">
                  Dokumente
                </h2>
                <p className="text-sm text-muted-foreground">
                  Reihenfolge in der Laufliste — mit den Pfeilen anpassen.
                </p>
              </div>
              <AddDocumentsSheet
                caseId={id}
                assignableDocs={assignableDocs}
                triggerLabel="Dokumente hinzufügen"
              />
            </div>
            <DocumentsTable
              caseId={id}
              docs={docs}
              assignableDocs={assignableDocs}
            />
          </CardContent>
        </Card>

        {/* Laufliste card */}
        <Card>
          <CardContent className="flex flex-col gap-4">
            <h2 className="text-2xl font-semibold leading-tight">Laufliste</h2>
            {latestLaufliste ? (
              <p className="text-sm text-muted-foreground">
                Zuletzt erstellt am{" "}
                {formatDateTimeDe(new Date(latestLaufliste.generatedAt))} ·{" "}
                {latestLaufliste.documentCount} Dokumente ·{" "}
                {formatBytes(latestLaufliste.fileSize)}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Noch keine Laufliste erstellt.
              </p>
            )}
            <CaseDetailClient
              caseId={id}
              canGenerate={canGenerate}
              isEmpty={isEmpty}
              hasUnreviewed={hasUnreviewed}
              latestLauflisteId={latestLaufliste?.id ?? null}
            />
          </CardContent>
        </Card>

        {/* Historie card */}
        <Card>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-semibold leading-tight">Historie</h2>
              <p className="text-sm text-muted-foreground">
                Frühere Lauflisten dieses Falls.
              </p>
            </div>
            {historie.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Noch keine früheren Lauflisten vorhanden.
              </p>
            ) : (
              <ul className="divide-y">
                {historie.map((l) => (
                  <li
                    key={l.id}
                    className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex flex-col gap-0.5 text-sm">
                      <span className="font-medium">
                        Erstellt am{" "}
                        {formatDateTimeDe(new Date(l.generatedAt))}
                      </span>
                      <span className="text-muted-foreground">
                        {l.documentCount} Dokumente ·{" "}
                        {formatBytes(l.fileSize)}
                      </span>
                    </div>
                    <a
                      href={`/api/cases/${id}/laufliste/${l.id}/download`}
                      className="text-sm font-medium underline-offset-2 hover:underline"
                    >
                      Herunterladen
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
