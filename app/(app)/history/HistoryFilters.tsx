"use client";

import { useEffect, useState } from "react";
import { useQueryState } from "nuqs";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

/**
 * Phase 5 Plan 02 Task 2 — client filters for /history.
 *
 * URL-state-first (nuqs). Fields:
 *   q     → text search on personName
 *   from  → ISO yyyy-MM-dd (generatedAt lower bound)
 *   to    → ISO yyyy-MM-dd (generatedAt upper bound)
 *   page  → paginated offset (reset to 1 on filter change)
 *
 * Search is debounced 300ms so every keystroke doesn't round-trip to the
 * server. Date fields commit immediately on change.
 */
export function HistoryFilters() {
  const [q, setQ] = useQueryState("q", { defaultValue: "" });
  const [from, setFrom] = useQueryState("from", { defaultValue: "" });
  const [to, setTo] = useQueryState("to", { defaultValue: "" });
  const [, setPage] = useQueryState("page", { defaultValue: "" });

  // Local draft for debounced search — avoids spamming URL / server.
  const [qDraft, setQDraft] = useState(q);

  useEffect(() => {
    // Keep local draft in sync when URL changes outside this component
    // (e.g. Zurücksetzen click).
    setQDraft(q);
  }, [q]);

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
    void setFrom(null);
    void setTo(null);
    void setPage(null);
    setQDraft("");
  };

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:gap-6">
      <div className="flex min-w-[240px] flex-1 flex-col gap-1.5">
        <Label htmlFor="history-q">Suchen</Label>
        <Input
          id="history-q"
          type="search"
          placeholder="Personenname"
          value={qDraft}
          onChange={(e) => setQDraft(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="history-from">Zeitraum von</Label>
        <Input
          id="history-from"
          type="date"
          value={from}
          onChange={(e) => {
            void setFrom(e.target.value || null);
            void setPage(null);
          }}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="history-to">Zeitraum bis</Label>
        <Input
          id="history-to"
          type="date"
          value={to}
          onChange={(e) => {
            void setTo(e.target.value || null);
            void setPage(null);
          }}
        />
      </div>
      <Button type="button" variant="outline" onClick={reset}>
        Zurücksetzen
      </Button>
    </div>
  );
}
