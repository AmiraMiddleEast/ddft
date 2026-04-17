"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { reanalyzeDocumentAction } from "@/lib/extraction/reanalyze";

export function ReanalyzeButton({ documentId }: { documentId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleClick = () => {
    startTransition(async () => {
      const res = await reanalyzeDocumentAction(documentId);
      if (res.ok) {
        toast.success("Neu analysiert.");
        router.refresh();
      } else {
        toast.error("Erneute Analyse fehlgeschlagen.");
      }
    });
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleClick}
      disabled={isPending}
    >
      {isPending ? "Wird analysiert …" : "Neu analysieren"}
    </Button>
  );
}
