import { PDFDocument } from "pdf-lib";

export type PdfValidation =
  | { ok: true }
  | { ok: false; reason: "invalid_pdf" | "encrypted_pdf" };

export async function validatePdf(bytes: Uint8Array): Promise<PdfValidation> {
  // 1. Magic bytes — "%PDF" at offset 0 (RESEARCH §PDF Validation).
  if (bytes.byteLength < 5) return { ok: false, reason: "invalid_pdf" };
  const head = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (head !== "%PDF") return { ok: false, reason: "invalid_pdf" };

  // 2. pdf-lib load — throws on encrypted (Hopding/pdf-lib issue #61).
  //    Do NOT pass ignoreEncryption:true — that defeats the check (RESEARCH State of the Art).
  try {
    await PDFDocument.load(bytes, { ignoreEncryption: false });
    return { ok: true };
  } catch (e) {
    const msg = String((e as Error).message ?? e).toLowerCase();
    if (msg.includes("encrypt")) return { ok: false, reason: "encrypted_pdf" };
    return { ok: false, reason: "invalid_pdf" };
  }
}
