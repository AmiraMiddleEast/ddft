"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpIcon, ArrowDownIcon } from "lucide-react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  reorderCaseDocumentsAction,
} from "@/lib/cases/actions";
import type { CaseDocumentRow } from "@/lib/cases/queries";

import { RemoveDocumentDialog } from "./RemoveDocumentDialog";
import { AddDocumentsSheet } from "./AddDocumentsSheet";
import type { AssignableDocument } from "@/lib/cases/queries";

type Props = {
  caseId: string;
  docs: CaseDocumentRow[];
  assignableDocs: AssignableDocument[];
};

export function DocumentsTable({ caseId, docs, assignableDocs }: Props) {
  const router = useRouter();
  const [optimisticDocs, setOptimisticDocs] =
    React.useState<CaseDocumentRow[]>(docs);
  const [removing, setRemoving] = React.useState<null | {
    caseDocumentId: string;
    filename: string;
  }>(null);
  const [announce, setAnnounce] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  // Keep optimistic state in sync when props change (e.g. after router.refresh).
  React.useEffect(() => {
    setOptimisticDocs(docs);
  }, [docs]);

  function move(caseDocumentId: string, direction: "up" | "down") {
    const idx = optimisticDocs.findIndex(
      (d) => d.caseDocumentId === caseDocumentId,
    );
    if (idx === -1) return;
    const neighborIdx = direction === "up" ? idx - 1 : idx + 1;
    if (neighborIdx < 0 || neighborIdx >= optimisticDocs.length) return;

    const prev = optimisticDocs;
    const next = [...optimisticDocs];
    const [target] = next.splice(idx, 1);
    next.splice(neighborIdx, 0, target);
    setOptimisticDocs(next);
    setAnnounce(`Position ${neighborIdx + 1} von ${next.length}.`);

    startTransition(async () => {
      const result = await reorderCaseDocumentsAction({
        caseId,
        caseDocumentId,
        direction,
      });
      if (!result.ok) {
        setOptimisticDocs(prev);
        toast.error(
          "Reihenfolge konnte nicht gespeichert werden. Bitte erneut versuchen.",
        );
        return;
      }
      router.refresh();
    });
  }

  if (optimisticDocs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <p className="text-base text-muted-foreground">
          Noch keine Dokumente zugeordnet.
        </p>
        <AddDocumentsSheet
          caseId={caseId}
          assignableDocs={assignableDocs}
          triggerLabel="Dokumente hinzufügen"
        />
      </div>
    );
  }

  return (
    <>
      <div role="status" aria-live="polite" className="sr-only">
        {announce}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Dokument</TableHead>
            <TableHead>Dokumenttyp</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {optimisticDocs.map((d, i) => {
            const isFirst = i === 0;
            const isLast = i === optimisticDocs.length - 1;
            const approved = d.reviewStatus === "approved";
            return (
              <TableRow key={d.caseDocumentId}>
                <TableCell className="font-medium">{i + 1}</TableCell>
                <TableCell className="max-w-[320px] truncate">
                  {d.filename}
                </TableCell>
                <TableCell className="text-muted-foreground">—</TableCell>
                <TableCell>
                  {approved ? (
                    <Badge variant="outline">Geprüft</Badge>
                  ) : (
                    <Badge variant="warning">Noch nicht geprüft</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/documents/${d.documentId}`}
                      className={buttonVariants({
                        variant: "ghost",
                        size: "sm",
                      })}
                    >
                      Ansehen
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Nach oben"
                      title="Nach oben"
                      disabled={isFirst || pending}
                      onClick={() => move(d.caseDocumentId, "up")}
                    >
                      <ArrowUpIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Nach unten"
                      title="Nach unten"
                      disabled={isLast || pending}
                      onClick={() => move(d.caseDocumentId, "down")}
                    >
                      <ArrowDownIcon />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() =>
                        setRemoving({
                          caseDocumentId: d.caseDocumentId,
                          filename: d.filename,
                        })
                      }
                      disabled={pending}
                    >
                      Entfernen
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <RemoveDocumentDialog
        caseId={caseId}
        caseDocumentId={removing?.caseDocumentId ?? null}
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
      />
    </>
  );
}
