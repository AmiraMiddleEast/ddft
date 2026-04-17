"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createDocumentTypeAction,
  updateDocumentTypeAction,
} from "@/lib/admin/actions";

type DocType = { id: string; displayName: string };

export function DocumentTypesClient({
  initialDocTypes,
}: {
  initialDocTypes: DocType[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<string>("");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setAddError(null);
    startTransition(async () => {
      const res = await createDocumentTypeAction({ displayName: newName.trim() });
      if (res.ok) {
        toast.success("Dokumentenart hinzugefügt.");
        setNewName("");
        router.refresh();
      } else {
        const msg =
          res.error === "DUPLICATE"
            ? "Ein Eintrag mit diesem Namen existiert bereits."
            : res.error === "VALIDATION"
              ? "Bitte einen gültigen Namen angeben."
              : res.error === "UNAUTHORIZED"
                ? "Bitte erneut anmelden."
                : "Fehler beim Speichern.";
        setAddError(msg);
        toast.error("Fehler beim Speichern.");
      }
    });
  };

  const handleUpdate = (id: string) => {
    if (!editDraft.trim()) return;
    startTransition(async () => {
      const res = await updateDocumentTypeAction(id, {
        displayName: editDraft.trim(),
      });
      if (res.ok) {
        toast.success("Gespeichert.");
        setEditingId(null);
        setEditDraft("");
        router.refresh();
      } else {
        toast.error("Fehler beim Speichern.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent>
          <form onSubmit={handleAdd} className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold leading-tight">
              Neue Dokumentenart
            </h2>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-doctype">Anzeigename</Label>
              <Input
                id="new-doctype"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="z.B. Arbeitszeugnis"
              />
            </div>
            {addError ? (
              <p role="alert" className="text-sm text-destructive">
                {addError}
              </p>
            ) : null}
            <div className="flex justify-end">
              <Button type="submit" disabled={isPending || !newName.trim()}>
                {isPending ? "Wird gespeichert …" : "Hinzufügen"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Anzeigename</TableHead>
              <TableHead>Slug (ID)</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialDocTypes.map((d) =>
              editingId === d.id ? (
                <TableRow key={d.id}>
                  <TableCell>
                    <Input
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      autoFocus
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{d.id}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingId(null);
                          setEditDraft("");
                        }}
                        disabled={isPending}
                      >
                        Abbrechen
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleUpdate(d.id)}
                        disabled={isPending || !editDraft.trim()}
                      >
                        Speichern
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.displayName}</TableCell>
                  <TableCell className="text-muted-foreground">{d.id}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingId(d.id);
                        setEditDraft(d.displayName);
                      }}
                    >
                      Bearbeiten
                    </Button>
                  </TableCell>
                </TableRow>
              ),
            )}
            {initialDocTypes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  Noch keine Dokumentenarten.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
