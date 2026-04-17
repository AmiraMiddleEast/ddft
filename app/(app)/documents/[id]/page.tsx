import { notFound } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { Card, CardContent } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import {
  getDocumentForUser,
  getExtractionsForDocument,
} from "@/lib/documents/queries";
import { PdfPreview } from "./_components/PdfPreview";
import { ExtractionTable } from "./_components/ExtractionTable";
import { ReviewLinkButton } from "./_components/ReviewLinkButton";

export const metadata = { title: "Dokument — Angela" };

function formatDe(ts: Date) {
  // dd.MM.yyyy HH:mm — use Intl to match UI-SPEC German formatting.
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(ts);
}

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();

  const doc = await getDocumentForUser(id, session.user.id);
  if (!doc) notFound();

  const pending =
    doc.extractionStatus === "pending" || doc.extractionStatus === "extracting";
  const rows = pending ? [] : await getExtractionsForDocument(id, session.user.id);

  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 pt-8">
      <nav className="mb-2 text-sm text-muted-foreground">
        <Link href="/" className="underline-offset-2 hover:underline">
          Übersicht
        </Link>
        {" / "}
        <span>Dokument</span>
      </nav>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold leading-tight">Dokument</h1>
        <p className="mt-1 text-base text-muted-foreground">
          {doc.filename} · Hochgeladen am {formatDe(new Date(doc.uploadedAt))}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_minmax(400px,480px)] lg:gap-8">
        <section aria-labelledby="section-pdf">
          <h2
            id="section-pdf"
            className="mb-4 text-2xl font-semibold leading-tight"
          >
            Originaldokument
          </h2>
          <Card className="p-0">
            <PdfPreview id={doc.id} filename={doc.filename} />
          </Card>
        </section>
        <section aria-labelledby="section-fields">
          <h2
            id="section-fields"
            className="mb-4 text-2xl font-semibold leading-tight"
          >
            Extrahierte Felder
          </h2>
          <Card>
            <CardContent className="flex flex-col gap-4">
              {doc.extractionStatus === "error" ? (
                <div role="alert" className="flex flex-col gap-2">
                  <p className="text-base font-semibold">
                    Analyse fehlgeschlagen
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Die Analyse konnte nicht abgeschlossen werden. Bitte erneut
                    versuchen.
                  </p>
                </div>
              ) : (
                <>
                  {pending ? (
                    <p className="text-sm text-muted-foreground">
                      Analyse läuft …
                    </p>
                  ) : null}
                  <ExtractionTable rows={rows} pending={pending} />
                  <div className="flex justify-end">
                    <ReviewLinkButton
                      documentId={doc.id}
                      status={doc.extractionStatus}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
