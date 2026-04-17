"use client";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ERROR_COPY } from "./ErrorCopy";
import type { UploadErrorCode } from "@/lib/uploads/errors";

export type RowStatus =
  | "queued"
  | "uploading"
  | "extracting"
  | "done"
  | "error";

export type BatchRowData = {
  key: string;
  filename: string;
  status: RowStatus;
  documentId?: string;
  errorCode?: UploadErrorCode | "not_found";
};

const STATUS_COPY: Record<RowStatus, string> = {
  queued: "In Warteschlange",
  uploading: "Wird hochgeladen",
  extracting: "Wird analysiert",
  done: "Fertig",
  error: "Fehler",
};

export function BatchRow({
  row,
  onRetry,
  onRemove,
}: {
  row: BatchRowData;
  onRetry: (key: string) => void;
  onRemove: (key: string) => void;
}) {
  const variant =
    row.status === "error"
      ? "destructive"
      : row.status === "done"
        ? "outline"
        : "secondary";
  const showSpinner =
    row.status === "uploading" || row.status === "extracting";

  return (
    <li className="grid grid-cols-1 items-center gap-2 py-4 md:grid-cols-[1fr_auto_auto] md:gap-4">
      <span className="truncate text-base">{row.filename}</span>
      <span className="inline-flex items-center gap-2">
        <Badge variant={variant}>{STATUS_COPY[row.status]}</Badge>
        {showSpinner ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : null}
        {row.status === "error" && row.errorCode ? (
          <span className="text-sm text-destructive">
            {ERROR_COPY[row.errorCode]}
          </span>
        ) : null}
      </span>
      <span className="flex gap-2 justify-self-end">
        {row.status === "done" && row.documentId ? (
          <Link
            href={`/documents/${row.documentId}`}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            Ansehen
          </Link>
        ) : null}
        {row.status === "error" ? (
          <Button variant="ghost" size="sm" onClick={() => onRetry(row.key)}>
            Erneut versuchen
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={() => onRemove(row.key)}>
          Entfernen
        </Button>
      </span>
    </li>
  );
}
