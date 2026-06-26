"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/lib/auth";
import {
  setSetting,
  resolveAnthropicKey,
  resolveClaudeModel,
} from "@/lib/settings/store";
import { classifyAnthropicError } from "@/lib/extraction/error-code";
import { SettingsSchema, type SettingsInput } from "@/lib/validations/settings";

/**
 * Quick 260626-wou: save runtime settings then run a real Anthropic validation
 * call ("Speichern & testen"). Returns a structured German status.
 *
 * SECURITY: the API key value is NEVER logged anywhere in this module.
 */
export type TestStatus =
  | "ok"
  | "auth"
  | "credit"
  | "model_unavailable"
  | "rate_limited"
  | "unknown"
  | "validation"
  | "unauthenticated"
  | "no_key";

export async function saveAndTestSettingsAction(
  input: SettingsInput,
): Promise<{ status: TestStatus; message: string; model?: string }> {
  // a. Auth gate.
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { status: "unauthenticated", message: "Nicht angemeldet." };
  }

  // b. Validate input.
  const parsed = SettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "validation", message: "Eingabe ungültig." };
  }

  // c. SAVE FIRST. Blank key = keep existing (never overwrite with empty).
  if (parsed.data.apiKey && parsed.data.apiKey.length > 0) {
    await setSetting("anthropic_api_key", parsed.data.apiKey);
  }
  await setSetting("claude_model", parsed.data.model);
  revalidatePath("/admin/settings");

  // d. Resolve effective values for the test call.
  const key = await resolveAnthropicKey();
  const model = await resolveClaudeModel();
  if (!key) {
    return { status: "no_key", message: "Kein Schlüssel gesetzt." };
  }

  // e. Real minimal validation call.
  try {
    const anthropic = new Anthropic({ apiKey: key });
    await anthropic.messages.create({
      model,
      max_tokens: 1,
      messages: [{ role: "user", content: "ping" }],
    });
    return {
      status: "ok",
      message: "✓ Schlüssel gültig, Guthaben vorhanden",
      model,
    };
  } catch (e) {
    const code = classifyAnthropicError(e);
    const message =
      code === "auth"
        ? "API-Schlüssel ungültig"
        : code === "credit"
          ? "Kein Anthropic-Guthaben — bitte unter console.anthropic.com aufladen"
          : code === "model_unavailable"
            ? `Modell nicht verfügbar: ${model}`
            : code === "rate_limited"
              ? "Rate-Limit erreicht — später erneut"
              : // "other" → surface the API message (never the key)
                ((e as { message?: string }).message ?? "Unbekannter Fehler");
    const status: TestStatus =
      code === "too_large" ? "unknown" : (code as TestStatus);
    return { status, message, model };
  }
}
