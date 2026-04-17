// scripts/parse-state-with-claude.ts
//
// Plan 03-02 Task 1: Convert a single state's raw German markdown from
// behoerden_db.json into a structured JSON object (state + regierungsbezirke
// + authorities) via Claude Sonnet 4. Zod-validated output.
//
// Usage is orchestrated by scripts/seed-behoerden.ts — this module does NOT
// read or write the filesystem and does NOT call Claude at import time.

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Prompt (research §B — verbatim, German instructions with <result> envelope).
// ---------------------------------------------------------------------------
export const STATE_PARSE_PROMPT = `Du bekommst einen Markdown-Text, der für EIN deutsches Bundesland die zuständigen Behörden für die Vorbeglaubigung von Dokumenten beschreibt. Extrahiere jeden Behörden-Eintrag als strukturiertes JSON.

**Ausgabeformat (nur JSON, keine Prosa):**

<result>
{
  "state_slug": "bayern",
  "state_name": "Bayern",
  "hat_regierungsbezirke": true,
  "besonderheiten": "…kurz…",
  "regierungsbezirke": ["Oberbayern", "Niederbayern", …],
  "authorities": [
    {
      "document_type_display": "Approbationsurkunde",
      "document_type_slug": "approbationsurkunde",
      "regierungsbezirk": null,
      "name": "Regierungspräsidium Stuttgart, Referat 95 …",
      "address": "Ruppmannstraße 21, 70565 Stuttgart",
      "phone": null,
      "email": null,
      "website": "https://rp.baden-wuerttemberg.de/…",
      "office_hours": null,
      "notes": "Antrag ausschließlich auf dem Postweg einreichen; Bearbeitung 5-6 Wochen.",
      "special_rules": null,
      "needs_review": false
    }
  ]
}
</result>

**Regeln:**
1. Gib NUR das JSON zwischen <result>-Tags aus, keine weiteren Kommentare.
2. \`document_type_slug\`: lowercase, Umlaute ä→ae ö→oe ü→ue ß→ss, nur a-z 0-9 und Bindestriche. Beispiele: "Führungszeugnis" → "fuehrungszeugnis", "Heirats­urkunde" → "heiratsurkunde".
3. Wenn ein Dokumententyp mehrere Behörden pro Regierungsbezirk hat: erzeuge je EINEN Eintrag pro Regierungsbezirk.
4. \`regierungsbezirk\`: String (z.B. "Oberbayern") wenn der Bundesland Regierungsbezirke hat UND der Eintrag einem zugeordnet ist; sonst null.
5. \`needs_review\`: true falls der Quelltext \`[PRÜFEN]\`, \`[PRUEFEN]\`, oder den Text "bitte prüfen" für diesen Eintrag enthält.
6. \`special_rules\`: kurze deutsche Zusammenfassung von Ausnahmen (z.B. "Führungszeugnis: keine Vorbeglaubigung — direkt zur Apostille durch BfAA"; "Reisepass: keine Legalisation erforderlich"). Null falls keine.
7. \`notes\`: allgemeine Hinweise aus dem Text (Postweg, Gebühren, Bearbeitungszeit).
8. \`phone\`, \`email\`, \`office_hours\`, \`website\`: nur ausfüllen wenn im Quelltext explizit genannt.
9. Wenn ein Dokumententyp explizit als "nicht legalisierbar" / "keine Vorbeglaubigung" markiert ist (z.B. Reisepass), erzeuge dennoch einen Eintrag mit name="—" und special_rules="…". Das UI zeigt die Sonderregel an.
10. \`state_slug\` mit gleicher Umlaut-Regel: "Baden-Württemberg" → "baden-wuerttemberg".

**Markdown-Input:**

<input>
{{DOKUMENTE_RAW}}
</input>`;

// ---------------------------------------------------------------------------
// Zod schemas (research §B — verbatim shape).
// ---------------------------------------------------------------------------
export const AuthorityOutput = z.object({
  document_type_display: z.string().min(1),
  document_type_slug: z.string().regex(/^[a-z0-9-]+$/),
  regierungsbezirk: z.string().nullable(),
  name: z.string().min(1),
  address: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  website: z.string().nullable(),
  office_hours: z.string().nullable(),
  notes: z.string().nullable(),
  special_rules: z.string().nullable(),
  needs_review: z.boolean(),
});
export type AuthorityOutputT = z.infer<typeof AuthorityOutput>;

export const StateParseOutput = z.object({
  state_slug: z.string().regex(/^[a-z0-9-]+$/),
  state_name: z.string().min(1),
  hat_regierungsbezirke: z.boolean(),
  besonderheiten: z.string().nullable(),
  regierungsbezirke: z.array(z.string()),
  authorities: z.array(AuthorityOutput).min(1),
});
export type StateParseOutputT = z.infer<typeof StateParseOutput>;

// ---------------------------------------------------------------------------
// Slugifier (re-used by seed for regierungsbezirk and state lookup hints).
// Plan 03 owns the canonical copy under lib/behoerden/slug.ts; this is the
// seed's own stable implementation.
// ---------------------------------------------------------------------------
export function normalizeDocTypeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ---------------------------------------------------------------------------
// Claude client (lazy — do not instantiate at import time; the seed script
// should be importable without ANTHROPIC_API_KEY set if --skip-parse is used).
// ---------------------------------------------------------------------------
const CLAUDE_MODEL = "claude-sonnet-4-20250514" as const;

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  _client = new Anthropic({ apiKey });
  return _client;
}

// ---------------------------------------------------------------------------
// Main entry point used by scripts/seed-behoerden.ts.
// ---------------------------------------------------------------------------
export async function parseStateWithClaude(
  raw: string,
  stateSlugHint: string,
): Promise<StateParseOutputT> {
  const msg = await client().messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: STATE_PARSE_PROMPT.replace("{{DOKUMENTE_RAW}}", raw),
          },
        ],
      },
    ],
  });

  // Claude returns a ContentBlock[]; we want the first text block.
  const textBlock = msg.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error(
      `[parse-state-with-claude] No text block in Claude response for state=${stateSlugHint}`,
    );
  }

  // Extract <result>…</result> (reuse the convention from lib/extraction/schema.ts).
  const match = textBlock.text.match(/<result>([\s\S]*?)<\/result>/);
  const payload = (match ? match[1] : textBlock.text).trim();

  let obj: unknown;
  try {
    obj = JSON.parse(payload);
  } catch (e) {
    const prefix = textBlock.text.slice(0, 200).replace(/\s+/g, " ");
    throw new Error(
      `[parse-state-with-claude] JSON.parse failed for state=${stateSlugHint}. ` +
        `Response prefix: "${prefix}…". Original error: ${
          e instanceof Error ? e.message : String(e)
        }`,
    );
  }

  // Zod strict parse — throws on schema mismatch.
  try {
    return StateParseOutput.parse(obj);
  } catch (e) {
    throw new Error(
      `[parse-state-with-claude] Zod validation failed for state=${stateSlugHint}: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }
}
