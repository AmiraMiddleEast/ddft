"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createCaseAction } from "@/lib/cases/actions";
import { BUNDESLAND_OPTIONS } from "@/lib/bundesland";

type FieldErrors = {
  personName?: string;
  personBirthdate?: string;
  notes?: string;
  beruf?: string;
  wohnsitzBundesland?: string;
  arbeitsortBundesland?: string;
  nrwSubregion?: string;
};

/**
 * Phase 4 Plan 05 + Phase 6 — Create case form.
 *
 * Phase 6 additions: Beruf (Arzt/Zahnarzt), Wohnsitz-BL, Arbeitsort-BL + NRW
 * subregion. These inputs drive CoGS routing via `resolveCogs()` later.
 *
 * Plain native <select> elements (no shadcn Select) to keep the page simple;
 * shadcn Select could be swapped in later without changing the Server Action.
 */
export function CreateCaseForm() {
  const router = useRouter();
  const [personName, setPersonName] = React.useState("");
  const [personBirthdate, setPersonBirthdate] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [beruf, setBeruf] = React.useState<"" | "arzt" | "zahnarzt">("");
  const [wohnsitzBl, setWohnsitzBl] = React.useState("");
  const [arbeitsortBl, setArbeitsortBl] = React.useState("");
  const [nrwSubregion, setNrwSubregion] = React.useState<
    "" | "nordrhein" | "westfalen-lippe"
  >("");
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [pending, startTransition] = React.useTransition();

  const needsNrw = wohnsitzBl === "NW" || arbeitsortBl === "NW";

  function validateLocal(): FieldErrors {
    const next: FieldErrors = {};
    const trimmedName = personName.trim();
    if (trimmedName.length === 0) next.personName = "Pflichtfeld.";
    else if (trimmedName.length > 200)
      next.personName = "Eingabe ist zu lang.";
    if (personBirthdate && !/^\d{4}-\d{2}-\d{2}$/.test(personBirthdate))
      next.personBirthdate = "Bitte ein gültiges Datum eingeben.";
    if (notes.length > 2000) next.notes = "Eingabe ist zu lang.";
    if (!beruf) next.beruf = "Bitte Beruf auswählen.";
    if (!wohnsitzBl) next.wohnsitzBundesland = "Bitte Wohnsitz auswählen.";
    if (!arbeitsortBl)
      next.arbeitsortBundesland =
        "Bitte Arbeitsort auswählen (Bundesland oder 'im Ausland').";
    if (needsNrw && !nrwSubregion)
      next.nrwSubregion =
        "Bitte Nordrhein oder Westfalen-Lippe auswählen.";
    return next;
  }

  function focusFirstError(errs: FieldErrors) {
    const order: (keyof FieldErrors)[] = [
      "personName",
      "personBirthdate",
      "beruf",
      "wohnsitzBundesland",
      "arbeitsortBundesland",
      "nrwSubregion",
      "notes",
    ];
    for (const key of order) {
      if (errs[key]) {
        const el = document.getElementById(`case-field-${key}`);
        el?.focus();
        return;
      }
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const localErrors = validateLocal();
    setErrors(localErrors);
    if (Object.keys(localErrors).length > 0) {
      focusFirstError(localErrors);
      return;
    }

    startTransition(async () => {
      const result = await createCaseAction({
        personName: personName.trim(),
        personBirthdate: personBirthdate || undefined,
        notes: notes.trim() || undefined,
        beruf: beruf || undefined,
        wohnsitzBundesland: wohnsitzBl || undefined,
        arbeitsortBundesland: arbeitsortBl || undefined,
        nrwSubregion: needsNrw ? nrwSubregion || undefined : undefined,
      });

      if (result.ok) {
        toast.success("Fall angelegt.");
        router.push(`/cases/${result.data.caseId}`);
        return;
      }

      if (result.error === "VALIDATION") {
        const zodErrors =
          (result.details as {
            fieldErrors?: Record<string, string[]>;
          } | null)?.fieldErrors ?? {};
        const nextErrors: FieldErrors = {};
        (
          [
            "personName",
            "personBirthdate",
            "notes",
            "beruf",
            "wohnsitzBundesland",
            "arbeitsortBundesland",
            "nrwSubregion",
          ] as const
        ).forEach((k) => {
          const msg = zodErrors[k]?.[0];
          if (msg) nextErrors[k] = msg;
        });
        setErrors(nextErrors);
        focusFirstError(nextErrors);
        return;
      }

      toast.error(
        "Fall konnte nicht angelegt werden. Bitte erneut versuchen.",
      );
    });
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="case-field-personName">Name der Person</Label>
        <Input
          id="case-field-personName"
          name="personName"
          type="text"
          value={personName}
          onChange={(e) => setPersonName(e.target.value)}
          placeholder="Vor- und Nachname"
          maxLength={200}
          required
          aria-invalid={errors.personName ? true : undefined}
          aria-describedby={errors.personName ? "err-personName" : undefined}
          disabled={pending}
        />
        {errors.personName ? (
          <p id="err-personName" className="text-sm text-destructive">
            {errors.personName}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="case-field-personBirthdate">Geburtsdatum</Label>
        <Input
          id="case-field-personBirthdate"
          name="personBirthdate"
          type="date"
          value={personBirthdate}
          onChange={(e) => setPersonBirthdate(e.target.value)}
          aria-invalid={errors.personBirthdate ? true : undefined}
          disabled={pending}
        />
        {errors.personBirthdate ? (
          <p className="text-sm text-destructive">{errors.personBirthdate}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Optional</p>
        )}
      </div>

      {/* Phase 6: CoGS routing inputs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="case-field-beruf">Beruf</Label>
          <select
            id="case-field-beruf"
            value={beruf}
            onChange={(e) =>
              setBeruf(e.target.value as "" | "arzt" | "zahnarzt")
            }
            disabled={pending}
            className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-base shadow-xs"
          >
            <option value="">— auswählen —</option>
            <option value="arzt">Arzt / Ärztin</option>
            <option value="zahnarzt">Zahnarzt / Zahnärztin</option>
          </select>
          {errors.beruf ? (
            <p className="text-sm text-destructive">{errors.beruf}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="case-field-wohnsitzBundesland">Wohnsitz</Label>
          <select
            id="case-field-wohnsitzBundesland"
            value={wohnsitzBl}
            onChange={(e) => setWohnsitzBl(e.target.value)}
            disabled={pending}
            className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-base shadow-xs"
          >
            <option value="">— Bundesland auswählen —</option>
            {BUNDESLAND_OPTIONS.map((b) => (
              <option key={b.key} value={b.key}>
                {b.name}
              </option>
            ))}
          </select>
          {errors.wohnsitzBundesland ? (
            <p className="text-sm text-destructive">
              {errors.wohnsitzBundesland}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="case-field-arbeitsortBundesland">
            Arbeitsort (aktuell oder zuletzt)
          </Label>
          <select
            id="case-field-arbeitsortBundesland"
            value={arbeitsortBl}
            onChange={(e) => setArbeitsortBl(e.target.value)}
            disabled={pending}
            className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-base shadow-xs"
          >
            <option value="">— auswählen —</option>
            {BUNDESLAND_OPTIONS.map((b) => (
              <option key={b.key} value={b.key}>
                {b.name}
              </option>
            ))}
            <option value="AUSLAND">— im Ausland —</option>
          </select>
          {errors.arbeitsortBundesland ? (
            <p className="text-sm text-destructive">
              {errors.arbeitsortBundesland}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Maßgeblich für die Zuständigkeit des Certificate of Good Standing
            </p>
          )}
        </div>

        {needsNrw ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="case-field-nrwSubregion">NRW-Kammerbezirk</Label>
            <select
              id="case-field-nrwSubregion"
              value={nrwSubregion}
              onChange={(e) =>
                setNrwSubregion(
                  e.target.value as "" | "nordrhein" | "westfalen-lippe",
                )
              }
              disabled={pending}
              className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-base shadow-xs"
            >
              <option value="">— auswählen —</option>
              <option value="nordrhein">Nordrhein</option>
              <option value="westfalen-lippe">Westfalen-Lippe</option>
            </select>
            {errors.nrwSubregion ? (
              <p className="text-sm text-destructive">{errors.nrwSubregion}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="case-field-notes">Notizen</Label>
        <Textarea
          id="case-field-notes"
          name="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Interne Hinweise (optional)"
          maxLength={2000}
          aria-invalid={errors.notes ? true : undefined}
          disabled={pending}
        />
        {errors.notes ? (
          <p className="text-sm text-destructive">{errors.notes}</p>
        ) : null}
      </div>

      <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          href="/cases"
          className={buttonVariants({ variant: "ghost" })}
          aria-disabled={pending}
        >
          Abbrechen
        </Link>
        <Button type="submit" disabled={pending}>
          {pending ? "Wird angelegt …" : "Fall anlegen"}
        </Button>
      </div>
    </form>
  );
}
