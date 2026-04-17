import { z } from "zod";

const confidence = z.enum(["high", "medium", "low"]);

const fieldStr = z.object({
  value: z.string().nullable(),
  confidence,
  reasoning: z.string().max(240),
});

const fieldDate = z.object({
  value: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  confidence,
  reasoning: z.string().max(240),
});

export const ExtractionResponse = z.object({
  dokumenten_typ: fieldStr,
  ausstellende_behoerde: fieldStr,
  ausstellungsort: fieldStr,
  bundesland: fieldStr,
  ausstellungsdatum: fieldDate,
  voller_name: fieldStr,
});
export type ExtractionResponseT = z.infer<typeof ExtractionResponse>;

export function parseExtractionResponse(raw: string): ExtractionResponseT {
  // Prefer content inside <result>...</result>
  const m = raw.match(/<result>([\s\S]*?)<\/result>/);
  let json = (m ? m[1] : raw).trim();

  // Strip ```json fences if present (RESEARCH Pitfall 3).
  const fence = json.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) json = fence[1].trim();

  const parsed = JSON.parse(json);
  return ExtractionResponse.parse(parsed);
}
