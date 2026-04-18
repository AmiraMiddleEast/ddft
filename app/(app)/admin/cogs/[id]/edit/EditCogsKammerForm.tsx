"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { updateCogsKammerAction } from "@/lib/cogs/admin-actions";

type Row = {
  id: string;
  bundeslandName: string;
  beruf: string;
  kammerName: string | null;
  kammerWebsite: string | null;
  zustaendigeStelle: string;
  zustaendigeStelleHinweis: string | null;
  directUrlGoodStanding: string | null;
  antragsverfahren: string | null;
  erforderlicheDokumente: string | null;
  fuehrungszeugnisOErforderlich: string | null;
  fuehrungszeugnisOEmpfaenger: string;
  kontaktEmail: string | null;
  kontaktTelefon: string | null;
  kontaktAdresse: string | null;
  besonderheiten: string | null;
  datenVollstaendig: boolean;
};

export function EditCogsKammerForm({ row }: { row: Row }) {
  const router = useRouter();
  const [state, setState] = React.useState({
    kammerName: row.kammerName ?? "",
    kammerWebsite: row.kammerWebsite ?? "",
    zustaendigeStelle: row.zustaendigeStelle,
    zustaendigeStelleHinweis: row.zustaendigeStelleHinweis ?? "",
    directUrlGoodStanding: row.directUrlGoodStanding ?? "",
    antragsverfahren: row.antragsverfahren ?? "",
    erforderlicheDokumente: row.erforderlicheDokumente ?? "",
    fuehrungszeugnisOErforderlich: row.fuehrungszeugnisOErforderlich ?? "",
    fuehrungszeugnisOEmpfaenger: row.fuehrungszeugnisOEmpfaenger,
    kontaktEmail: row.kontaktEmail ?? "",
    kontaktTelefon: row.kontaktTelefon ?? "",
    kontaktAdresse: row.kontaktAdresse ?? "",
    besonderheiten: row.besonderheiten ?? "",
    datenVollstaendig: row.datenVollstaendig,
  });
  const [pending, startTransition] = React.useTransition();

  function set<K extends keyof typeof state>(k: K, v: (typeof state)[K]) {
    setState((s) => ({ ...s, [k]: v }));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateCogsKammerAction({
        id: row.id,
        ...state,
      });
      if (result.ok) {
        toast.success("Gespeichert.");
        router.push("/admin/cogs");
      } else {
        toast.error(
          `Speichern fehlgeschlagen (${result.error}).`,
        );
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <Section title="Kammer (Mitgliedschaftsverwaltung)">
        <TextField
          label="Kammer-Name"
          value={state.kammerName}
          onChange={(v) => set("kammerName", v)}
          disabled={pending}
        />
        <TextField
          label="Kammer-Website"
          value={state.kammerWebsite}
          onChange={(v) => set("kammerWebsite", v)}
          disabled={pending}
        />
      </Section>

      <Section title="Zuständige Stelle für das Certificate of Good Standing">
        <TextField
          label="Zuständige Stelle *"
          value={state.zustaendigeStelle}
          onChange={(v) => set("zustaendigeStelle", v)}
          required
          disabled={pending}
        />
        <TextareaField
          label="Hinweis zur zuständigen Stelle"
          value={state.zustaendigeStelleHinweis}
          onChange={(v) => set("zustaendigeStelleHinweis", v)}
          disabled={pending}
        />
        <TextField
          label="Direktlink zum Antragsformular / zur Info-Seite"
          value={state.directUrlGoodStanding}
          onChange={(v) => set("directUrlGoodStanding", v)}
          disabled={pending}
        />
        <TextareaField
          label="Antragsverfahren"
          value={state.antragsverfahren}
          onChange={(v) => set("antragsverfahren", v)}
          disabled={pending}
          rows={4}
        />
        <TextareaField
          label="Erforderliche Dokumente (mit | getrennt)"
          value={state.erforderlicheDokumente}
          onChange={(v) => set("erforderlicheDokumente", v)}
          disabled={pending}
          rows={3}
        />
      </Section>

      <Section title="Führungszeugnis Belegart O">
        <TextField
          label="Erforderlich?"
          value={state.fuehrungszeugnisOErforderlich}
          onChange={(v) => set("fuehrungszeugnisOErforderlich", v)}
          disabled={pending}
          placeholder="z.B. 'Ja, Belegart O'"
        />
        <TextField
          label="Empfängerbehörde (Name + Anschrift) *"
          value={state.fuehrungszeugnisOEmpfaenger}
          onChange={(v) => set("fuehrungszeugnisOEmpfaenger", v)}
          required
          disabled={pending}
          placeholder="z.B. 'Ärztekammer Berlin, Friedrichstraße 16, 10969 Berlin'"
        />
      </Section>

      <Section title="Kontakt">
        <TextField
          label="E-Mail"
          value={state.kontaktEmail}
          onChange={(v) => set("kontaktEmail", v)}
          disabled={pending}
        />
        <TextField
          label="Telefon"
          value={state.kontaktTelefon}
          onChange={(v) => set("kontaktTelefon", v)}
          disabled={pending}
        />
        <TextareaField
          label="Anschrift"
          value={state.kontaktAdresse}
          onChange={(v) => set("kontaktAdresse", v)}
          disabled={pending}
          rows={2}
        />
      </Section>

      <Section title="Sonstiges">
        <TextareaField
          label="Besonderheiten"
          value={state.besonderheiten}
          onChange={(v) => set("besonderheiten", v)}
          disabled={pending}
          rows={3}
        />
        <label className="flex items-center gap-2">
          <Checkbox
            checked={state.datenVollstaendig}
            onCheckedChange={(v) => set("datenVollstaendig", Boolean(v))}
            disabled={pending}
          />
          <span className="text-sm">
            Daten vollständig recherchiert — das Verfahren kann vollständig auf
            dem Laufzettel ausgegeben werden.
          </span>
        </label>
      </Section>

      <div className="mt-4 flex items-center justify-end gap-3">
        <a href="/admin/cogs" className="text-sm underline">
          Abbrechen
        </a>
        <Button type="submit" disabled={pending}>
          {pending ? "Wird gespeichert …" : "Speichern"}
        </Button>
      </div>
    </form>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-3 rounded-md border p-4">
      <legend className="px-2 text-sm font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

function TextField({
  label,
  value,
  onChange,
  required,
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
      />
    </div>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  disabled,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  rows?: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={rows ?? 2}
      />
    </div>
  );
}
