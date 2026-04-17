"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DiscardDialogProps = {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Minimal accessible confirmation dialog for the "Verwerfen" (discard edits)
 * action. No AlertDialog primitive is vendored in this phase (CONTEXT D-17 —
 * only `select` is added for Phase 3), so we build a small dialog over a
 * backdrop with focus trapping via auto-focus on the confirm button.
 */
export function DiscardDialog({
  open,
  onConfirm,
  onCancel,
}: DiscardDialogProps) {
  const confirmRef = React.useRef<HTMLButtonElement>(null);
  const headingId = React.useId();
  const descId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    // Focus the confirm button when the dialog opens.
    const frame = window.requestAnimationFrame(() => {
      confirmRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center",
        "bg-black/40 p-4",
      )}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-describedby={descId}
        className="w-full max-w-md rounded-xl border bg-card p-6 text-card-foreground shadow-lg"
      >
        <h2
          id={headingId}
          className="text-lg font-semibold leading-tight"
        >
          Änderungen verwerfen?
        </h2>
        <p id={descId} className="mt-2 text-sm text-muted-foreground">
          Ihre Anpassungen an den extrahierten Daten werden entfernt.
        </p>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            Abbrechen
          </Button>
          <Button
            ref={confirmRef}
            type="button"
            variant="destructive"
            onClick={onConfirm}
          >
            Verwerfen
          </Button>
        </div>
      </div>
    </div>
  );
}
