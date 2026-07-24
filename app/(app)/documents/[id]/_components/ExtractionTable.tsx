import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { FIELD_NAMES, type FieldName } from "@/db/schema";
import type { ExtractionRow } from "@/lib/documents/queries";

const FIELD_LABEL: Record<FieldName, string> = {
  dokumenten_typ: "Document type",
  ausstellende_behoerde: "Issuing authority",
  ausstellungsort: "Place of issue",
  bundesland: "Federal state",
  ausstellungsdatum: "Date of issue",
  voller_name: "Full name",
};

const CONFIDENCE_LABEL = {
  high: "High",
  medium: "Medium",
  low: "Low",
} as const;
const CONFIDENCE_VARIANT = {
  high: "secondary",
  medium: "warning",
  low: "destructive",
} as const;

export function ExtractionTable({
  rows,
  pending,
}: {
  rows: ExtractionRow[];
  pending: boolean;
}) {
  const byName = new Map(rows.map((r) => [r.fieldName, r]));

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Feld</TableHead>
          <TableHead>Wert</TableHead>
          <TableHead className="text-right">Konfidenz</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {FIELD_NAMES.map((name) => {
          const r = byName.get(name);
          if (pending) {
            return (
              <TableRow key={name}>
                <TableCell className="text-sm font-semibold">
                  {FIELD_LABEL[name]}
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-40" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="ml-auto h-5 w-16" />
                </TableCell>
              </TableRow>
            );
          }
          const value = r?.fieldValue ?? null;
          const confidence = r?.confidence ?? "low";
          return (
            <TableRow key={name}>
              <TableCell className="text-sm font-semibold">
                {FIELD_LABEL[name]}
              </TableCell>
              <TableCell
                className={value === null ? "text-destructive" : undefined}
              >
                {value === null ? "— nicht erkannt" : value}
              </TableCell>
              <TableCell className="text-right">
                <Badge variant={CONFIDENCE_VARIANT[confidence]}>
                  {CONFIDENCE_LABEL[confidence]}
                </Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
