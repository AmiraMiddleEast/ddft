import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { EXTRACTION_PROMPT } from "./prompt";
import {
  parseExtractionResponse,
  type ExtractionResponseT,
} from "./schema";
import { resolveAnthropicKey, resolveClaudeModel } from "@/lib/settings/store";

export type ExtractFieldsResult = {
  parsed: ExtractionResponseT;
  usage: { input_tokens: number; output_tokens: number };
  model: string;
};

export async function extractFields(
  storagePath: string,
): Promise<ExtractFieldsResult> {
  const abs = path.isAbsolute(storagePath)
    ? storagePath
    : path.resolve(process.cwd(), storagePath);
  const pdfBuffer = await readFile(abs);
  const base64 = pdfBuffer.toString("base64");

  // Quick 260626-wou: resolve key + model at CALL TIME (no module-level cache)
  // so a UI key/model change applies on the next extraction with NO restart.
  // Creating the client per call is intentional and fine for a single-user tool.
  const apiKey = await resolveAnthropicKey();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  const model = await resolveClaudeModel();
  const anthropic = new Anthropic({ apiKey });

  const msg = await anthropic.messages.create({
    model,
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
