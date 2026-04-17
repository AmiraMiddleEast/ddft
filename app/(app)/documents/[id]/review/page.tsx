import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import {
  getDocumentForUser,
  getExtractionsForDocument,
} from "@/lib/documents/queries";
import { listDocumentTypes, listStates } from "@/lib/behoerden/queries";
import { Card } from "@/components/ui/card";
import { FIELD_NAMES, type Confidence, type FieldName } from "@/db/schema";

import { PdfPreview } from "../_components/PdfPreview";
import { ReviewForm } from "./_components/ReviewForm";

export const metadata = { title: "Überprüfung — Angela" };

type Props = { params: Promise<{ id: string }> };

function formatDe(ts: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(ts);
}

export default async function ReviewPage({ params }: Props) {
  const { id } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const doc = await getDocumentForUser(id, session.user.id);
  if (!doc) notFound();

  // Only 'done' status may review; otherwise kick back to detail.
  if (doc.extractionStatus !== "done") {
    redirect(`/documents/${id}`);
  }

  const extractions = await getExtractionsForDocument(id, session.user.id);

  // Map extractions into { fieldName: { value, confidence } }
  const original: Record<FieldName, { value: string; confidence: Confidence }> =
    {
      dokumenten_typ: { value: "", confidence: "low" },
      ausstellende_behoerde: { value: "", confidence: "low" },
      ausstellungsort: { value: "", confidence: "low" },
      bundesland: { value: "", confidence: "low" },
      ausstellungsdatum: { value: "", confidence: "low" },
      voller_name: { value: "", confidence: "low" },
    };
  for (const e of extractions) {
    if ((FIELD_NAMES as readonly string[]).includes(e.fieldName)) {
      original[e.fieldName] = {
        value: e.fieldValue ?? "",
        confidence: e.confidence,
      };
    }
  }

  // Parallel data fetch for Select dropdowns
  const [docTypes, states] = await Promise.all([
    listDocumentTypes(),
    listStates(),
  ]);

  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 pt-8 pb-16">
      {/* Breadcrumb */}
      <nav className="mb-2 text-sm text-muted-foreground">
        <Link href="/" className="underline-offset-2 hover:underline">
          Übersicht
        </Link>
        {" / "}
        <Link
          href={`/documents/${id}`}
          className="underline-offset-2 hover:underline"
        >
          Dokument
        </Link>
        {" / "}
        <span aria-current="page">Überprüfung</span>
      </nav>

      <header className="mb-8">
        <h1 className="text-2xl font-semibold leading-tight">Überprüfung</h1>
        <p className="mt-1 text-base text-muted-foreground">
          {doc.filename} · Hochgeladen am {formatDe(new Date(doc.uploadedAt))}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_minmax(420px,520px)] lg:gap-8">
        <section aria-labelledby="section-pdf">
          <h2
            id="section-pdf"
            className="mb-4 text-2xl font-semibold leading-tight"
          >
            Originaldokument
          </h2>
          <Card className="p-0 overflow-hidden">
            <div className="min-h-[640px]">
              <PdfPreview id={doc.id} filename={doc.filename} />
            </div>
          </Card>
        </section>

        <section aria-labelledby="section-review">
          <h2
            id="section-review"
            className="mb-4 text-2xl font-semibold leading-tight"
          >
            Extrahierte Daten
          </h2>
          <Card className="px-6">
            <ReviewForm
              documentId={id}
              original={original}
              documentTypes={docTypes}
              states={states}
            />
          </Card>
        </section>
      </div>
    </main>
  );
}
