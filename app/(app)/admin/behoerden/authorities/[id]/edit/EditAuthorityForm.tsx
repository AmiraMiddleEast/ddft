"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { updateAuthorityAction } from "@/lib/admin/actions";

type Authority = {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  officeHours: string | null;
  notes: string | null;
  specialRules: string | null;
  needsReview: boolean;
};

export function EditAuthorityForm({ authority }: { authority: Authority }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: authority.name,
    address: authority.address,
    phone: authority.phone ?? "",
    email: authority.email ?? "",
    website: authority.website ?? "",
    officeHours: authority.officeHours ?? "",
    notes: authority.notes ?? "",
    specialRules: authority.specialRules ?? "",
    needsReview: authority.needsReview,
  });

  const bind =
    <K extends keyof typeof form>(key: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value } as typeof form));
    };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await updateAuthorityAction(authority.id, form);
      if (res.ok) {
        toast.success("Gespeichert.");
        router.push("/admin/behoerden/authorities");
        router.refresh();
      } else {
        setError(
          res.error === "VALIDATION"
            ? "Bitte Pflichtfelder ausfüllen."
            : res.error === "UNAUTHORIZED"
              ? "Bitte erneut anmelden."
              : res.error === "NOT_FOUND"
                ? "Behörde nicht gefunden."
                : "Speichern fehlgeschlagen.",
        );
        toast.error("Speichern fehlgeschlagen.");
      }
    });
  };

  return (
    <Card>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={form.name} onChange={bind("name")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="address">Adresse</Label>
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
            <span>Zur Überprüfung markieren</span>
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
              Zurück
            </Link>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Wird gespeichert …" : "Speichern"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
