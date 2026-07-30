import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  resolveAnthropicKey,
  resolveClaudeModel,
  maskKey,
  DEFAULT_CLAUDE_MODEL,
} from "@/lib/settings/store";
import { SettingsForm } from "./SettingsForm";

export const metadata = { title: "Einstellungen — DDFT" };

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  // SECURITY: resolve the raw key server-side ONLY to derive a masked hint.
  // The raw key is NEVER passed to the client.
  const key = await resolveAnthropicKey();
  const model = await resolveClaudeModel();
  const keyHint = maskKey(key);

  return (
    <main className="mx-auto w-full max-w-[900px] px-6 pt-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold leading-tight">Einstellungen</h1>
        <p className="mt-1 text-base text-muted-foreground">
          Configure the Anthropic API key and Claude model.
        </p>
      </header>
      <SettingsForm
        keyHint={keyHint}
        model={model}
        defaultModel={DEFAULT_CLAUDE_MODEL}
      />
    </main>
  );
}
