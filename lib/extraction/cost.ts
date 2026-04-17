export const PRICING_PER_MTOK = {
  "claude-sonnet-4-20250514": { inputUsd: 3, outputUsd: 15 },
} as const;

export function computeCostEur(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = PRICING_PER_MTOK[model as keyof typeof PRICING_PER_MTOK];
  if (!p) return 0; // unknown model — do NOT fabricate a price
  const usd =
    (inputTokens * p.inputUsd + outputTokens * p.outputUsd) / 1_000_000;
  const rate = Number(process.env.USD_TO_EUR ?? "0.92");
  return Number((usd * rate).toFixed(6));
}
