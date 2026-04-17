"use client";

import { useEffect, useState } from "react";
import { useQueryState } from "nuqs";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Option = { id: string; name?: string; displayName?: string };

export function AuthoritiesFilters({
  states,
  docTypes,
}: {
  states: Array<{ id: string; name: string }>;
  docTypes: Array<{ id: string; displayName: string }>;
}) {
  const [q, setQ] = useQueryState("q", { defaultValue: "" });
  const [stateId, setStateId] = useQueryState("stateId", { defaultValue: "" });
  const [docTypeId, setDocTypeId] = useQueryState("docTypeId", {
    defaultValue: "",
  });
  const [needsReview, setNeedsReview] = useQueryState("needsReview", {
    defaultValue: "",
  });
  const [, setPage] = useQueryState("page", { defaultValue: "" });

  const [qDraft, setQDraft] = useState(q);
  useEffect(() => setQDraft(q), [q]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (qDraft === q) return;
      void setQ(qDraft || null);
      void setPage(null);
    }, 300);
    return () => clearTimeout(t);
  }, [qDraft, q, setQ, setPage]);

  const reset = () => {
    void setQ(null);
    void setStateId(null);
    void setDocTypeId(null);
    void setNeedsReview(null);
    void setPage(null);
    setQDraft("");
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_160px_200px_160px_auto] md:items-end">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="adm-q">Suchen</Label>
        <Input
          id="adm-q"
          type="search"
          placeholder="Name der Behörde"
          value={qDraft}
          onChange={(e) => setQDraft(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="adm-state">Bundesland</Label>
        <select
          id="adm-state"
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          value={stateId}
          onChange={(e) => {
            void setStateId(e.target.value || null);
            void setPage(null);
          }}
        >
          <option value="">Alle</option>
          {states.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="adm-type">Dokumentenart</Label>
        <select
          id="adm-type"
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          value={docTypeId}
          onChange={(e) => {
            void setDocTypeId(e.target.value || null);
            void setPage(null);
          }}
        >
          <option value="">Alle</option>
          {docTypes.map((d) => (
            <option key={d.id} value={d.id}>
              {d.displayName}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="adm-needs">Prüfen</Label>
        <select
          id="adm-needs"
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          value={needsReview}
          onChange={(e) => {
            void setNeedsReview(e.target.value || null);
            void setPage(null);
          }}
        >
          <option value="">Alle</option>
          <option value="1">Ja</option>
          <option value="0">Nein</option>
        </select>
      </div>
      <Button type="button" variant="outline" onClick={reset}>
        Zurücksetzen
      </Button>
    </div>
  );
}
