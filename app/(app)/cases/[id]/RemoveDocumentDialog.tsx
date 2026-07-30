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
        toast.success("Document removed.");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(
          "Could not remove the document. Please try again.",
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove document from case?</DialogTitle>
          <DialogDescription>
            The document itself is kept and can be assigned to another case
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
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={pending || !caseDocumentId}
          >
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
