import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ExtractionStatus } from "@/db/schema";

/**
 * Enabled when the document's extraction is done; otherwise rendered as a
 * visually-disabled span (base-ui Button has no asChild, so we use
 * buttonVariants() on a Link for styled navigation — see Phase 2 STATE).
 */
export function ReviewLinkButton({
  documentId,
  status,
}: {
  documentId: string;
  status: ExtractionStatus;
}) {
  const enabled = status === "done";

  if (!enabled) {
    return (
      <span
        className={cn(
          buttonVariants({ variant: "default" }),
          "pointer-events-none opacity-50",
        )}
        aria-disabled="true"
        title="Verfügbar nach erfolgreicher Analyse."
      >
        Zur Überprüfung
      </span>
    );
  }

  return (
    <Link
      href={`/documents/${documentId}/review`}
      className={buttonVariants({ variant: "default" })}
    >
      Zur Überprüfung
    </Link>
  );
}
