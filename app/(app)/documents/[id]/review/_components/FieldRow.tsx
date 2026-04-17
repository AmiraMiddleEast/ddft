"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Confidence, FieldName } from "@/db/schema";

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: "Hoch",
  medium: "Mittel",
  low: "Niedrig",
};

const CONFIDENCE_VARIANT: Record<
  Confidence,
  "secondary" | "warning" | "destructive"
> = {
  high: "secondary",
  medium: "warning",
  low: "destructive",
};

type FieldRowProps = {
  label: string;
  name: FieldName;
  originalValue: string;
  confidence: Confidence;
  isDirty: boolean;
  error?: string;
  children: React.ReactNode;
};

/**
 * Form field row: label + confidence badge + control slot + dirty indicator +
 * inline error. The 2px accent left border on the control wrapper is the
 * field-edited visual (UI-SPEC §Field-Edited Indicator).
 */
export function FieldRow({
  label,
  name,
  originalValue,
  confidence,
  isDirty,
  error,
  children,
}: FieldRowProps) {
  const htmlFor = `field-${name}`;
  const captionText = originalValue
    ? `Ursprünglich: ${originalValue}`
    : "Ursprünglich: — nicht erkannt";

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={htmlFor}>{label}</Label>
        <Badge variant={CONFIDENCE_VARIANT[confidence]}>
          {CONFIDENCE_LABEL[confidence]}
        </Badge>
      </div>

      <div
        className={cn(
          "rounded-md",
          isDirty && "border-l-2 border-primary pl-2",
        )}
        title={
          isDirty ? "Geändert gegenüber der automatischen Analyse" : undefined
        }
      >
        {children}
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {isDirty ? (
        <p className="text-sm text-muted-foreground">{captionText}</p>
      ) : null}
    </div>
  );
}
