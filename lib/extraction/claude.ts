import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { EXTRACTION_PROMPT } from "./prompt";
import {
  parseExtractionResponse,
  type ExtractionResponseT,
} from "./schema";

export type ExtractFieldsResult = {
  parsed: ExtractionResponseT;
  usage: { input_tokens: number; output_tokens: number };
  model: string;
};

const MODEL = "claude-sonnet-4-20250514" as const;

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  _client = new Anthropic({ apiKey });
  return _client;
}

export async function extractFields(
  storagePath: string,
): Promise<ExtractFieldsResult> {
  const abs = path.isAbsolute(storagePath)
    ? storagePath
    : path.resolve(process.cwd(), storagePath);
  const pdfBuffer = await readFile(abs);
  const base64 = pdfBuffer.toString("base64");

  const msg = await client().messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64,
            },
          },
          { type: "text", text: EXTRACTION_PROMPT },
        ],
      },
    ],
  });

  // RESEARCH Pitfall 4: content is ContentBlock[], not a string.
  const textBlock = msg.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude response had no text block");
  }

  return {
    parsed: parseExtractionResponse(textBlock.text),
    usage: {
      input_tokens: msg.usage.input_tokens,
      output_tokens: msg.usage.output_tokens,
    },
    model: msg.model,
  };
}
