import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { appSetting } from "@/db/schema";

/**
 * Quick 260626-wou: runtime settings store (key-value over app_setting).
 *
 * Plain server module (NOT "use server") — exposes resolution + masking helpers
 * used by claude.ts (call-time key/model), the settings page, and the settings
 * action.
 *
 * SECURITY: this module MUST NEVER console.log/console.error the key value.
 */

export const DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-6";

const KEY_ANTHROPIC = "anthropic_api_key";
const KEY_MODEL = "claude_model";

export async function getSetting(key: string): Promise<string | null> {
  const [row] = await db
    .select()
    .from(appSetting)
    .where(eq(appSetting.key, key))
    .limit(1);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(appSetting)
    .values({ key, value })
    .onConflictDoUpdate({ target: appSetting.key, set: { value } });
}

/**
 * Effective Anthropic key: DB setting → process.env fallback. Empty string is
 * treated as unset. Returns null when no key is configured anywhere.
 */
export async function resolveAnthropicKey(): Promise<string | null> {
  const fromDb = await getSetting(KEY_ANTHROPIC);
  if (fromDb && fromDb.length > 0) return fromDb;
  const fromEnv = process.env.ANTHROPIC_API_KEY;
  return fromEnv && fromEnv.length > 0 ? fromEnv : null;
}

/**
 * Effective Claude model: DB setting (non-empty) → DEFAULT_CLAUDE_MODEL.
 */
export async function resolveClaudeModel(): Promise<string> {
  const fromDb = await getSetting(KEY_MODEL);
  if (fromDb && fromDb.length > 0) return fromDb;
  return DEFAULT_CLAUDE_MODEL;
}

/**
 * Render-safe hint for the UI. NEVER returns the full key.
 */
export function maskKey(key: string | null): string {
  if (!key || key.length === 0) return "Kein Schlüssel gesetzt";
  const last4 = key.slice(-4);
  return `Gesetzt: sk-ant-…${last4}`;
}
