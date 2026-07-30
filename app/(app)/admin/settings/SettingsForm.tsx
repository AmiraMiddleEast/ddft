"use client";

import * as React from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { saveAndTestSettingsAction } from "@/lib/settings/actions";

export function SettingsForm({
  keyHint,
  model: initialModel,
  defaultModel,
}: {
  keyHint: string;
  model: string;
  defaultModel: string;
}) {
  const [apiKey, setApiKey] = React.useState("");
  const [model, setModel] = React.useState(initialModel);
  const [result, setResult] = React.useState<{
    status: string;
    message: string;
  } | null>(null);
  const [pending, startTransition] = React.useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveAndTestSettingsAction({ apiKey, model });
      setResult({ status: res.status, message: res.message });
      if (res.status === "ok") {
        toast.success(res.message);
        // Clear the password field so the masked hint stays the source of truth.
        setApiKey("");
      } else {
        toast.error(res.message);
      }
    });
  }

  const isOk = result?.status === "ok";

  return (
    <Card>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <Label htmlFor="apiKey">Anthropic API key</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={pending}
              placeholder="Leave empty = keep current key"
              autoComplete="off"
            />
            <p className="text-sm text-muted-foreground">Aktuell: {keyHint}</p>
            <p className="text-xs text-muted-foreground">
              The stored key is never shown in full.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="model">Claude-Modell</Label>
            <Input
              id="model"
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={pending}
            />
            <p className="text-xs text-muted-foreground">
              Default: {defaultModel}. Editable for new model IDs.
            </p>
          </div>

          <div className="flex items-center justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? "Wird getestet …" : "Speichern & testen"}
            </Button>
          </div>

          {result ? (
            <p
              role={isOk ? "status" : "alert"}
              className={
                isOk
                  ? "text-sm font-medium text-green-600"
                  : "text-sm font-medium text-destructive"
              }
            >
              {result.message}
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
