"use client";

import { useCallback, useState, useTransition } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { replaceDocumentPdfAction } from "@/lib/uploads/replace";
import { MAX_FILE_BYTES } from "@/lib/validations/upload";

const ERROR_COPY: Record<string, string> = {
  unauthenticated: "Please sign in again.",
  not_found: "Document not found.",
  no_file: "Select a file.",
  file_too_large: "File is too large (max. 10 MB).",
  invalid_pdf: "The file is not a valid PDF.",
  encrypted_pdf: "Encrypted PDFs cannot be uploaded.",
  db_error: "Upload failed.",
  rate_limited: "Too many requests. Please try again later.",
  unknown: "Upload failed.",
};

export function ReplaceScanDialog({ documentId }: { documentId: string }) {
  const [open, setOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const onDrop = useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      setError(null);
      if (rejected.length > 0) {
        const code = rejected[0].errors[0]?.code;
        if (code === "file-too-large") setError(ERROR_COPY.file_too_large);
        else if (code === "file-invalid-type") setError(ERROR_COPY.invalid_pdf);
        else setError(ERROR_COPY.unknown);
        return;
      }
      if (accepted.length > 0) {
        setPendingFile(accepted[0]);
      }
    },
    [],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxSize: MAX_FILE_BYTES,
    maxFiles: 1,
    multiple: false,
  });

  const handleSubmit = () => {
    if (!pendingFile) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("file", pendingFile);
      const res = await replaceDocumentPdfAction(documentId, fd);
      if (res.ok) {
        toast.success("New scan uploaded.");
        setOpen(false);
        setPendingFile(null);
        router.refresh();
      } else {
        const msg = ERROR_COPY[res.error] ?? ERROR_COPY.unknown;
        setError(msg);
        toast.error("Upload failed.");
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setPendingFile(null);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">Upload new scan</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload new scan</DialogTitle>
          <DialogDescription>
            Replaces the current PDF. The previous version is kept and stays
            available in the version history.
          </DialogDescription>
        </DialogHeader>
        <Card
          {...getRootProps()}
          className={cn(
            "cursor-pointer border-dashed",
            isDragActive && "border-primary",
          )}
          role="button"
          tabIndex={0}
          aria-label="Choose new PDF"
        >
          <CardContent className="flex min-h-[160px] flex-col items-center justify-center gap-2 py-6 text-center">
            <input {...getInputProps()} />
            <Upload className="size-6 text-muted-foreground" aria-hidden />
            {pendingFile ? (
              <p className="text-sm">
                <span className="font-medium">{pendingFile.name}</span> ·{" "}
                {(pendingFile.size / 1024).toFixed(0)} KB
              </p>
            ) : (
              <>
                <p className="text-base">
                  {isDragActive
                    ? "Drop to upload"
                    : "Drag a PDF here"}
                </p>
                <p className="text-sm text-muted-foreground">or</p>
                <Button type="button" size="sm">
                  Choose file
                </Button>
              </>
            )}
          </CardContent>
        </Card>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isPending}>
              Abbrechen
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!pendingFile || isPending}
          >
            {isPending ? "Uploading…" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
