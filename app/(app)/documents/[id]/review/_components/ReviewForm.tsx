"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CorrectedFieldsSchema,
  type CorrectedFields,
} from "@/lib/validations/review";
import {
  approveAndResolve,
  chooseAmbiguousAuthority,
} from "@/lib/review/actions";
import type { ResolverResult } from "@/lib/behoerden/resolve";
import type { Confidence, FieldName } from "@/db/schema";

import { AuthorityResultPanel } from "./AuthorityResultPanel";
import { DiscardDialog } from "./DiscardDialog";
import { FieldRow } from "./FieldRow";

const FIELD_NAMES: readonly FieldName[] = [
  "dokumenten_typ",
  "ausstellende_behoerde",
  "ausstellungsort",
  "bundesland",
  "ausstellungsdatum",
  "voller_name",
] as const;

const BUNDESLAND_SENTINEL = "Unbekannt / Sonstiges";

type Original = Record<FieldName, { value: string; confidence: Confidence }>;

type Props = {
  documentId: string;
  original: Original;
  documentTypes: { id: string; displayName: string }[];
  states: { id: string; name: string }[];
};

function initialValues(original: Original): CorrectedFields {
  return {
    dokumenten_typ: original.dokumenten_typ.value,
    ausstellende_behoerde: original.ausstellende_behoerde.value,
    ausstellungsort: original.ausstellungsort.value,
    bundesland: original.bundesland.value,
    ausstellungsdatum: original.ausstellungsdatum.value,
    voller_name: original.voller_name.value,
  };
}

export function ReviewForm({
  documentId,
  original,
  documentTypes,
  states,
}: Props) {
  const [values, setValues] = React.useState<CorrectedFields>(() =>
    initialValues(original),
  );
  const [errors, setErrors] = React.useState<
    Partial<Record<keyof CorrectedFields, string>>
  >({});
  const [pending, startTransition] = React.useTransition();
  const [result, setResult] = React.useState<ResolverResult | null>(null);
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);

  const isDirty = React.useCallback(
    (k: FieldName) => values[k] !== original[k].value,
    [values, original],
  );
  const anyDirty = FIELD_NAMES.some((k) => isDirty(k));

  // beforeunload warning on unsaved edits.
  React.useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (anyDirty) {
        e.preventDefault();
        e.returnValue = "Änderungen gehen verloren. Seite verlassen?";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [anyDirty]);

  function setField<K extends keyof CorrectedFields>(
    k: K,
    v: CorrectedFields[K],
  ) {
    setValues((prev) => ({ ...prev, [k]: v }));
    if (errors[k]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[k];
        return next;
      });
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = CorrectedFieldsSchema.safeParse(values);
    if (!parsed.success) {
      const next: Partial<Record<keyof CorrectedFields, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof CorrectedFields;
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      const firstKey = FIELD_NAMES.find((k) => next[k]);
      if (firstKey) {
        const el = document.getElementById(`field-${firstKey}`);
        if (el instanceof HTMLElement) el.focus();
      }
      return;
    }

    startTransition(async () => {
      try {
        const res = await approveAndResolve({
          documentId,
          corrected: parsed.data,
        });
        if (!res.ok) {
          toast.error(
            "Behörde konnte nicht ermittelt werden. Bitte erneut versuchen.",
          );
          return;
        }
        setResult(res.data);
        if (res.data.status === "matched") {
          toast.success("Zuständige Behörde ermittelt.");
        }
        window.setTimeout(() => {
          document
            .getElementById("authority-result")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 50);
      } catch {
        toast.error(
          "Behörde konnte nicht ermittelt werden. Bitte erneut versuchen.",
        );
      }
    });
  }

  function onDiscard() {
    setConfirmDiscard(false);
    setValues(initialValues(original));
    setErrors({});
    setResult(null);
  }

  async function onChooseAmbiguous(authorityId: string) {
    const res = await chooseAmbiguousAuthority({ documentId, authorityId });
    if (!res.ok) {
      toast.error(
        "Behörde konnte nicht ermittelt werden. Bitte erneut versuchen.",
      );
      return;
    }
    const chosen = res.data.authority;
    setResult({
      status: "matched",
      authority: chosen,
      routing_path: [],
      special_rules: chosen.specialRules,
      needs_review: chosen.needsReview,
    });
    toast.success("Zuständige Behörde ermittelt.");
  }

  function onAdjustInputs() {
    setResult(null);
    window.setTimeout(() => {
      const el = document.getElementById("field-dokumenten_typ");
      if (el instanceof HTMLElement) el.focus();
    }, 0);
  }

  // Pre-assemble Bundesland options (DB + sentinel).
  const bundeslandOptions = React.useMemo(
    () => [...states, { id: "__unknown", name: BUNDESLAND_SENTINEL }],
    [states],
  );

  return (
    <div className="py-2">
      <form onSubmit={onSubmit} className="grid gap-4">
        {/* Dokumenttyp */}
        <FieldRow
          label="Dokumenttyp"
          name="dokumenten_typ"
          originalValue={original.dokumenten_typ.value}
          confidence={original.dokumenten_typ.confidence}
          isDirty={isDirty("dokumenten_typ")}
          error={errors.dokumenten_typ}
        >
          <Select
            value={values.dokumenten_typ || undefined}
            onValueChange={(v) => setField("dokumenten_typ", v)}
          >
            <SelectTrigger
              id="field-dokumenten_typ"
              className="w-full"
              aria-invalid={errors.dokumenten_typ ? true : undefined}
            >
              <SelectValue placeholder="Dokumenttyp auswählen" />
            </SelectTrigger>
            <SelectContent>
              {documentTypes.map((dt) => (
                <SelectItem key={dt.id} value={dt.displayName}>
                  {dt.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>

        {/* Ausstellende Behörde */}
        <FieldRow
          label="Ausstellende Behörde"
          name="ausstellende_behoerde"
          originalValue={original.ausstellende_behoerde.value}
          confidence={original.ausstellende_behoerde.confidence}
          isDirty={isDirty("ausstellende_behoerde")}
          error={errors.ausstellende_behoerde}
        >
          <Input
            id="field-ausstellende_behoerde"
            type="text"
            value={values.ausstellende_behoerde}
            onChange={(e) =>
              setField("ausstellende_behoerde", e.target.value)
            }
            aria-invalid={
              errors.ausstellende_behoerde ? true : undefined
            }
            maxLength={300}
          />
        </FieldRow>

        {/* Ausstellungsort */}
        <FieldRow
          label="Ausstellungsort"
          name="ausstellungsort"
          originalValue={original.ausstellungsort.value}
          confidence={original.ausstellungsort.confidence}
          isDirty={isDirty("ausstellungsort")}
          error={errors.ausstellungsort}
        >
          <Input
            id="field-ausstellungsort"
            type="text"
            value={values.ausstellungsort}
            onChange={(e) => setField("ausstellungsort", e.target.value)}
            aria-invalid={errors.ausstellungsort ? true : undefined}
            maxLength={200}
          />
        </FieldRow>

        {/* Bundesland */}
        <FieldRow
          label="Bundesland"
          name="bundesland"
          originalValue={original.bundesland.value}
          confidence={original.bundesland.confidence}
          isDirty={isDirty("bundesland")}
          error={errors.bundesland}
        >
          <Select
            value={values.bundesland || undefined}
            onValueChange={(v) => setField("bundesland", v)}
          >
            <SelectTrigger
              id="field-bundesland"
              className="w-full"
              aria-invalid={errors.bundesland ? true : undefined}
            >
              <SelectValue placeholder="Bundesland auswählen" />
            </SelectTrigger>
            <SelectContent>
              {bundeslandOptions.map((s) => (
                <SelectItem key={s.id} value={s.name}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>

        {/* Ausstellungsdatum */}
        <FieldRow
          label="Ausstellungsdatum"
          name="ausstellungsdatum"
          originalValue={original.ausstellungsdatum.value}
          confidence={original.ausstellungsdatum.confidence}
          isDirty={isDirty("ausstellungsdatum")}
          error={errors.ausstellungsdatum}
        >
          <Input
            id="field-ausstellungsdatum"
            type="date"
            value={values.ausstellungsdatum}
            onChange={(e) => setField("ausstellungsdatum", e.target.value)}
            aria-invalid={errors.ausstellungsdatum ? true : undefined}
          />
        </FieldRow>

        {/* Voller Name */}
        <FieldRow
          label="Voller Name"
          name="voller_name"
          originalValue={original.voller_name.value}
          confidence={original.voller_name.confidence}
          isDirty={isDirty("voller_name")}
          error={errors.voller_name}
        >
          <Input
            id="field-voller_name"
            type="text"
            value={values.voller_name}
            onChange={(e) => setField("voller_name", e.target.value)}
            aria-invalid={errors.voller_name ? true : undefined}
            maxLength={300}
          />
        </FieldRow>

        <div className="mt-4 flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="ghost"
            disabled={!anyDirty}
            onClick={() => setConfirmDiscard(true)}
          >
            Verwerfen
          </Button>
          <Button type="submit" disabled={pending}>
            {pending
              ? "Behörde wird ermittelt …"
              : "Speichern & Behörde ermitteln"}
          </Button>
        </div>
      </form>

      {result ? (
        <div id="authority-result" className="mt-8">
          <AuthorityResultPanel
            result={result}
            onChooseAuthority={onChooseAmbiguous}
            onAdjustInputs={onAdjustInputs}
          />
        </div>
      ) : null}

      <DiscardDialog
        open={confirmDiscard}
        onConfirm={onDiscard}
        onCancel={() => setConfirmDiscard(false)}
      />
    </div>
  );
}
