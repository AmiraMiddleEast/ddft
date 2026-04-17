"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { removeDocumentFromCaseAction } from "@/lib/cases/actions";

type Props = {
  caseId: string;
  caseDocumentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function RemoveDocumentDialog({
  caseId,
  caseDocumentId,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function onConfirm() {
    if (!caseDocumentId) return;
    startTransition(async () => {
      const result = await removeDocumentFromCaseAction({
        caseId,
        caseDocumentId,
      });
      if (result.ok) {
        toast.success("Dokument entfernt.");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(
          "Dokument konnte nicht entfernt werden. Bitte erneut versuchen.",
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dokument aus Fall entfernen?</DialogTitle>
          <DialogDescription>
            Das Dokument bleibt erhalten und kann einem anderen Fall zugeordnet
            werden.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Abbrechen
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={pending || !caseDocumentId}
          >
            Entfernen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
