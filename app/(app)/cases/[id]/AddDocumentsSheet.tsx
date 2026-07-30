"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { addDocumentsToCaseAction } from "@/lib/cases/actions";
import type { AssignableDocument } from "@/lib/cases/queries";

type Props = {
  caseId: string;
  assignableDocs: AssignableDocument[];
  triggerLabel: string;
};

function formatDateDe(ts: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(ts);
}

export function AddDocumentsSheet({
  caseId,
  assignableDocs,
  triggerLabel,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [pending, startTransition] = React.useTransition();

  function toggle(docId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  }

  function reset() {
    setSelected(new Set());
  }

  function onSubmit() {
    if (selected.size === 0) return;
    const documentIds = [...selected];
    startTransition(async () => {
      const result = await addDocumentsToCaseAction({ caseId, documentIds });
      if (result.ok) {
        const n = result.data.inserted;
        toast.success(
          n === 1
            ? "Document added."
            : `${n} documents added.`,
        );
        reset();
        setOpen(false);
        router.refresh();
        return;
      }
      if (result.error === "DOC_ALREADY_ASSIGNED") {
        toast.error(
          "The document is already assigned to another case.",
        );
        router.refresh();
        return;
      }
      toast.error(
        "Could not add the documents. Please try again.",
      );
    });
  }

  const count = selected.size;
  const addLabel = count === 0 ? "Add" : `Add ${count}`;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <SheetTrigger
        className={buttonVariants()}
        aria-label={triggerLabel}
      >
        {triggerLabel}
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[480px] flex flex-col gap-0"
      >
        <SheetHeader className="gap-2 p-6 pb-4">
          <SheetTitle>Add documents</SheetTitle>
          <SheetDescription>
            Documents with a completed analysis that are not assigned to another case
            zugeordnet sind.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-2">
          {assignableDocs.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-12 text-center px-4">
              <p className="text-base text-muted-foreground">
                No documents available. Upload a document first.
              </p>
              <Link href="/upload" className={buttonVariants()}>
                Upload document
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Document</TableHead>
                  <TableHead>Documenttyp</TableHead>
                  <TableHead>Hochgeladen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignableDocs.map((d) => {
                  const checked = selected.has(d.id);
                  return (
                    <TableRow
                      key={d.id}
                      className={checked ? "bg-accent/10" : undefined}
                    >
                      <TableCell>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggle(d.id)}
                          aria-label={`${d.filename} select`}
                        />
                      </TableCell>
                      <TableCell
                        className="max-w-[220px] truncate cursor-pointer"
                        onClick={() => toggle(d.id)}
                      >
                        {d.filename}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        —
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateDe(new Date(d.uploadedAt))}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t bg-background p-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              reset();
              setOpen(false);
            }}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={count === 0 || pending}
          >
            {addLabel}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
