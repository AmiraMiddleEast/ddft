"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { createAuthorityAction } from "@/lib/admin/actions";

type State = { id: string; name: string };
type DocType = { id: string; displayName: string };
type Regierungsbezirk = { id: string; stateId: string; name: string };

const SELECT_CLASS =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm";

export function NewAuthorityForm({
  states,
  docTypes,
  regierungsbezirke,
}: {
  states: State[];
  docTypes: DocType[];
  regierungsbezirke: Regierungsbezirk[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    stateId: "",
    documentTypeId: "",
    regierungsbezirkId: "",
    name: "",
    address: "",
    phone: "",
    email: "",
    website: "",
    officeHours: "",
    notes: "",
    specialRules: "",
    needsReview: false,
  });

  // Only Regierungsbezirke of the chosen Bundesland are selectable.
  const rbzForState = useMemo(
    () => regierungsbezirke.filter((r) => r.stateId === form.stateId),
    [regierungsbezirke, form.stateId],
  );

  const bind =
    <K extends keyof typeof form>(key: K) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value }) as typeof form);
    };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createAuthorityAction(form);
      if (res.ok) {
        toast.success("Authority created.");
        router.push("/admin/behoerden/authorities");
        router.refresh();
      } else {
        const msg =
          res.error === "VALIDATION"
            ? "Fill in federal state, document type, name and address."
            : res.error === "UNKNOWN_STATE"
              ? "Unbekanntes Bundesland."
              : res.error === "UNKNOWN_DOC_TYPE"
                ? "Unbekannte Dokumentenart."
                : res.error === "UNAUTHORIZED"
                  ? "Please sign in again."
                  : "Save failed.";
        setError(msg);
        toast.error("Save failed.");
      }
    });
  };

  return (
    <Card>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="stateId">Bundesland *</Label>
              <select
                id="stateId"
                className={SELECT_CLASS}
                value={form.stateId}
                onChange={(e) => {
                  // Reset RB when the state changes.
                  const stateId = e.target.value;
                  setForm((prev) => ({ ...prev, stateId, regierungsbezirkId: "" }));
                }}
              >
                <option value="">— select —</option>
                {states.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="documentTypeId">Dokumentenart *</Label>
              <select
                id="documentTypeId"
                className={SELECT_CLASS}
                value={form.documentTypeId}
                onChange={bind("documentTypeId")}
              >
                <option value="">— select —</option>
                {docTypes.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.displayName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {rbzForState.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="regierungsbezirkId">
                Regierungsbezirk (optional)
              </Label>
              <select
                id="regierungsbezirkId"
                className={SELECT_CLASS}
                value={form.regierungsbezirkId}
                onChange={bind("regierungsbezirkId")}
              >
                <option value="">— keiner —</option>
                {rbzForState.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" value={form.name} onChange={bind("name")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="address">Adresse *</Label>
            <Textarea
              id="address"
              value={form.address}
              onChange={bind("address")}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Telefon</Label>
              <Input id="phone" value={form.phone} onChange={bind("phone")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={bind("email")}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              type="url"
              value={form.website}
              onChange={bind("website")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="officeHours">Öffnungszeiten</Label>
            <Input
              id="officeHours"
              value={form.officeHours}
              onChange={bind("officeHours")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notizen</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={bind("notes")}
              rows={3}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="specialRules">Besondere Regeln</Label>
            <Textarea
              id="specialRules"
              value={form.specialRules}
              onChange={bind("specialRules")}
              rows={3}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.needsReview}
              onCheckedChange={(v) =>
                setForm((prev) => ({ ...prev, needsReview: v === true }))
              }
            />
            <span>Mark for review</span>
          </label>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Link
              href="/admin/behoerden/authorities"
              className={buttonVariants({ variant: "outline" })}
            >
              Abbrechen
            </Link>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating…" : "Create authority"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
