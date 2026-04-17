"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { generateLauflisteAction } from "@/lib/laufliste/actions";

import { RegenerateDialog } from "./RegenerateDialog";

type Props = {
  caseId: string;
  canGenerate: boolean;
  isEmpty: boolean;
  hasUnreviewed: boolean;
  latestLauflisteId: string | null;
};

/**
 * Wraps the generate + download CTAs so the Server Action call lives on the
 * client side. page.tsx does the blocker analysis and feeds us ready-made
 * flags. Regenerate flow opens a confirmation dialog first.
 */
export function CaseDetailClient({
  caseId,
  canGenerate,
  isEmpty,
  hasUnreviewed,
  latestLauflisteId,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [confirmRegenerate, setConfirmRegenerate] = React.useState(false);

  const hasLatest = latestLauflisteId !== null;
  const primaryLabel = hasLatest ? "Erneut generieren" : "Laufliste generieren";
  const tooltip = isEmpty
    ? "Bitte mindestens ein Dokument hinzufügen."
    : hasUnreviewed
      ? "Alle Dokumente müssen geprüft sein."
      : undefined;

  function runGenerate() {
    startTransition(async () => {
      const result = await generateLauflisteAction(caseId);
      if (result.ok) {
        toast.success("Laufliste erstellt.");
        router.refresh();
      } else {
        toast.error(
          "Laufliste konnte nicht erzeugt werden. Bitte erneut versuchen.",
        );
      }
    });
  }

  function onPrimaryClick() {
    if (!canGenerate) return;
    if (hasLatest) {
      setConfirmRegenerate(true);
    } else {
      runGenerate();
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          onClick={onPrimaryClick}
          disabled={!canGenerate || pending}
          title={tooltip}
        >
          {pending ? (
            <>
              <Loader2Icon className="animate-spin" aria-hidden />
              Laufliste wird erstellt …
            </>
          ) : (
            primaryLabel
          )}
        </Button>
        {hasLatest ? (
          <a
            href={`/api/cases/${caseId}/laufliste/${latestLauflisteId}/download`}
            className={buttonVariants({ variant: "outline" })}
          >
            Herunterladen
          </a>
        ) : null}
      </div>

      <RegenerateDialog
        open={confirmRegenerate}
        onOpenChange={setConfirmRegenerate}
        onConfirm={() => {
          setConfirmRegenerate(false);
          runGenerate();
        }}
      />
    </>
  );
}
