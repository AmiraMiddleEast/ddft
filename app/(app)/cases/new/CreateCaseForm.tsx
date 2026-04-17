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

type FieldErrors = {
  personName?: string;
  personBirthdate?: string;
  notes?: string;
};

/**
 * Phase 4 Plan 05 — Create case form.
 *
 * Mirrors the Phase 3 Plan 05 ReviewForm pattern (CONTEXT D-17): plain
 * `useState` for values + `useTransition` for the Server Action call. Small
 * form, so react-hook-form is not introduced.
 */
export function CreateCaseForm() {
  const router = useRouter();
  const [personName, setPersonName] = React.useState("");
  const [personBirthdate, setPersonBirthdate] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [pending, startTransition] = React.useTransition();

  function validateLocal(): FieldErrors {
    const next: FieldErrors = {};
    const trimmedName = personName.trim();
    if (trimmedName.length === 0) {
      next.personName = "Pflichtfeld.";
    } else if (trimmedName.length > 200) {
      next.personName = "Eingabe ist zu lang.";
    }
    if (personBirthdate && !/^\d{4}-\d{2}-\d{2}$/.test(personBirthdate)) {
      next.personBirthdate = "Bitte ein gültiges Datum eingeben.";
    }
    if (notes.length > 2000) {
      next.notes = "Eingabe ist zu lang.";
    }
    return next;
  }

  function focusFirstError(errs: FieldErrors) {
    const order: (keyof FieldErrors)[] = [
      "personName",
      "personBirthdate",
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
      });

      if (result.ok) {
        toast.success("Fall angelegt.");
        router.push(`/cases/${result.data.caseId}`);
        return;
      }

      if (result.error === "VALIDATION") {
        // Map Zod flattened errors back onto fields.
        const zodErrors =
          (result.details as {
            fieldErrors?: Record<string, string[]>;
          } | null)?.fieldErrors ?? {};
        const nextErrors: FieldErrors = {};
        if (zodErrors.personName?.[0]) {
          nextErrors.personName = zodErrors.personName[0];
        }
        if (zodErrors.personBirthdate?.[0]) {
          nextErrors.personBirthdate = zodErrors.personBirthdate[0];
        }
        if (zodErrors.notes?.[0]) {
          nextErrors.notes = zodErrors.notes[0];
        }
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
          aria-describedby={
            errors.personBirthdate ? "err-personBirthdate" : "help-birthdate"
          }
          disabled={pending}
        />
        {errors.personBirthdate ? (
          <p id="err-personBirthdate" className="text-sm text-destructive">
            {errors.personBirthdate}
          </p>
        ) : (
          <p id="help-birthdate" className="text-sm text-muted-foreground">
            Optional
          </p>
        )}
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
          aria-describedby={errors.notes ? "err-notes" : undefined}
          disabled={pending}
        />
        {errors.notes ? (
          <p id="err-notes" className="text-sm text-destructive">
            {errors.notes}
          </p>
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
