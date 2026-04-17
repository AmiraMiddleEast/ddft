"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import pLimit from "p-limit";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { uploadSingleDocumentAction } from "@/lib/uploads/actions";
import { extractDocumentAction } from "@/lib/extraction/actions";
import { MAX_FILE_BYTES, MAX_BATCH_FILES } from "@/lib/validations/upload";
import { BatchRow, type BatchRowData, type RowStatus } from "./BatchRow";
import { ERROR_COPY } from "./ErrorCopy";

const extractLimit = pLimit(3); // RESEARCH Pattern 3 concurrency=3

export function UploadClient() {
  const [rows, setRows] = useState<BatchRowData[]>([]);
  const [rejectMsg, setRejectMsg] = useState<string | null>(null);
  const inflightFiles = useRef<Map<string, File>>(new Map());

  // Track last-emitted batch-complete event to fire Sonner exactly once.
  const pendingCount = rows.filter(
    (r) =>
      r.status === "queued" ||
      r.status === "uploading" ||
      r.status === "extracting",
  ).length;
  const totalCount = rows.length;
  const errorCount = rows.filter((r) => r.status === "error").length;
  const lastBatchSignal = useRef<string>("");

  useEffect(() => {
    if (totalCount === 0) return;
    if (pendingCount > 0) return;
    const signal = `done:${totalCount}:${errorCount}`;
    if (lastBatchSignal.current === signal) return;
    lastBatchSignal.current = signal;
    if (errorCount === 0) {
      toast.success("Analyse abgeschlossen.");
    } else {
      toast.error(
        `Analyse abgeschlossen. ${errorCount} Datei(en) mit Fehler.`,
      );
    }
  }, [pendingCount, totalCount, errorCount]);

  const patch = useCallback((key: string, p: Partial<BatchRowData>) => {
    setRows((xs) => xs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  }, []);

  const runPipeline = useCallback(
    async (key: string, file: File) => {
      patch(key, { status: "uploading" });
      const fd = new FormData();
      fd.append("file", file);
      const up = await uploadSingleDocumentAction(null, fd);
      if (!up.ok) {
        patch(key, { status: "error", errorCode: up.error });
        return;
      }
      patch(key, { status: "extracting", documentId: up.documentId });
      const ex = await extractLimit(() => extractDocumentAction(up.documentId));
      if (ex.ok) {
        patch(key, { status: "done" });
      } else {
        patch(key, { status: "error", errorCode: ex.error });
      }
    },
    [patch],
  );

  const onDrop = useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      setRejectMsg(null);
      if (rejected.length > 0) {
        const first = rejected[0].errors[0]?.code;
        const msg =
          first === "file-too-large"
            ? ERROR_COPY.file_too_large
            : first === "file-invalid-type"
              ? ERROR_COPY.invalid_pdf
              : first === "too-many-files"
                ? ERROR_COPY.batch_limit
                : ERROR_COPY.unknown;
        setRejectMsg(msg);
        setTimeout(() => setRejectMsg(null), 5000);
      }
      if (accepted.length === 0) return;
      if (rows.length + accepted.length > MAX_BATCH_FILES) {
        setRejectMsg(ERROR_COPY.batch_limit);
        setTimeout(() => setRejectMsg(null), 5000);
        return;
      }
      const newRows: BatchRowData[] = accepted.map((f) => ({
        key: crypto.randomUUID(),
        filename: f.name,
        status: "queued" as RowStatus,
      }));
      setRows((xs) => [...xs, ...newRows]);
      // Reset batch signal so the completion toast will fire again
      // when this new batch finishes.
      lastBatchSignal.current = "";
      for (let i = 0; i < accepted.length; i++) {
        inflightFiles.current.set(newRows[i].key, accepted[i]);
        void runPipeline(newRows[i].key, accepted[i]);
      }
    },
    [rows.length, runPipeline],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxSize: MAX_FILE_BYTES,
    maxFiles: MAX_BATCH_FILES,
    multiple: true,
  });

  const onRetry = useCallback(
    (key: string) => {
      const f = inflightFiles.current.get(key);
      if (!f) return;
      // Reset batch signal so the toast will fire again when this retry completes.
      lastBatchSignal.current = "";
      void runPipeline(key, f);
    },
    [runPipeline],
  );

  const onRemove = useCallback((key: string) => {
    inflightFiles.current.delete(key);
    setRows((xs) => xs.filter((r) => r.key !== key));
  }, []);

  return (
    <section className="flex flex-col gap-6">
      <Card
        {...getRootProps()}
        className={cn(
          "cursor-pointer border-dashed",
          isDragActive && "border-primary",
        )}
        role="button"
        tabIndex={0}
        aria-label="Dateien hochladen — Drop-Zone"
      >
        <CardContent className="flex min-h-[192px] flex-col items-center justify-center gap-2 py-6">
          <input {...getInputProps()} />
          <Upload className="size-6 text-muted-foreground" aria-hidden />
          <p className="text-base">
            {isDragActive ? "Zum Hochladen loslassen" : "PDFs hierher ziehen"}
          </p>
          <p className="text-sm text-muted-foreground">oder</p>
          <Button type="button">Dateien auswählen</Button>
        </CardContent>
      </Card>
      {rejectMsg ? (
        <p role="alert" className="text-sm text-destructive">
          {rejectMsg}
        </p>
      ) : null}

      <Separator />

      <div>
        <h2 className="mb-4 text-2xl font-semibold leading-tight">
          Aktuelle Uploads
        </h2>
        {rows.length === 0 ? (
          <p className="text-base text-muted-foreground">
            Noch keine Dateien ausgewählt.
          </p>
        ) : (
          <Card>
            <CardContent>
              <ul role="list" className="divide-y">
                {rows.map((r) => (
                  <BatchRow
                    key={r.key}
                    row={r}
                    onRetry={onRetry}
                    onRemove={onRemove}
                  />
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}
