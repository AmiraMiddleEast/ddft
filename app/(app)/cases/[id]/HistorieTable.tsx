import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";

/**
 * Phase 4 Plan 06 Task 2 — Historie table (D-16).
 *
 * Server-rendered (no client state required — just a table with anchor links
 * back to the download Route Handler). `page.tsx` passes prior Lauflisten
 * (i.e. `lauflisten.slice(1)` — everything except the latest, which the
 * Laufliste card above already shows).
 *
 * Empty state: always render the section — UI-SPEC requires the Historie
 * card to be present on every case detail page regardless of state.
 */

export type HistorieRow = {
  id: string;
  generatedAt: Date | string | number;
  documentCount: number;
  fileSize: number;
};

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

export function HistorieTable({
  caseId,
  lauflisten,
}: {
  caseId: string;
  lauflisten: HistorieRow[];
}) {
  if (lauflisten.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Noch keine früheren Lauflisten vorhanden.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Erstellt am</TableHead>
          <TableHead>Dokumente</TableHead>
          <TableHead>Größe</TableHead>
          <TableHead className="text-right">Aktion</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lauflisten.map((l) => (
          <TableRow key={l.id}>
            <TableCell className="font-medium">
              {formatDateTimeDe(new Date(l.generatedAt))}
            </TableCell>
            <TableCell>{l.documentCount}</TableCell>
            <TableCell>{formatBytes(l.fileSize)}</TableCell>
            <TableCell className="text-right">
              <a
                href={`/api/cases/${caseId}/laufliste/${l.id}/download`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Herunterladen
              </a>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
