import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { getLauflisteForDownload } from "@/lib/laufliste/queries";

/**
 * Phase 4 Plan 06 Task 1 — Laufliste PDF download Route Handler.
 *
 * Status matrix (D-15 + D-21):
 *   401 — no session.
 *   404 — caseId / lauflisteId / ownership triple does not align
 *         (zero-leak policy from getLauflisteForDownload — wrong owner,
 *         cross-case id, or missing rows all collapse to 404).
 *   410 — row exists but the PDF file is missing on disk (orphaned row).
 *   200 — bytes streamed back with:
 *           Content-Type: application/pdf
 *           Content-Length: {bytes}
 *           Content-Disposition: attachment; filename="..."; filename*=UTF-8''...
 *             (RFC 6266 + RFC 5987 — ASCII fallback plus UTF-8 variant so German
 *              umlauts in the person name survive every client.)
 *           Cache-Control: private, no-store (T-04-27 — keep PDFs out of shared
 *             caches; they contain personal data.)
 *
 * The `personSlug` + `generatedDate` inputs are computed by the query layer
 * (see `getLauflisteForDownload`) so the route does not duplicate the
 * slugify / date-format rules. Filename shape:
 *   Laufliste-{person-slug}-{yyyy-MM-dd}.pdf
 */
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; lauflisteId: string }> },
) {
  const { id: caseId, lauflisteId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const row = await getLauflisteForDownload(
    caseId,
    lauflisteId,
    session.user.id,
    db,
  );
  if (!row) return new NextResponse("Not found", { status: 404 });

  const abs = path.isAbsolute(row.pdfStoragePath)
    ? row.pdfStoragePath
    : path.resolve(process.cwd(), row.pdfStoragePath);

  let bytes: Buffer;
  try {
    bytes = await readFile(abs);
  } catch {
    return new NextResponse("File missing", { status: 410 });
  }

  // ASCII fallback filename (strict [A-Za-z0-9.-]) — the slug util already
  // ASCII-folds German umlauts (ä→ae, ö→oe, ü→ue, ß→ss).
  const asciiName = `Laufliste-${row.personSlug}-${row.generatedDate}.pdf`;

  // UTF-8 variant — keep original umlauts and also strip any chars that could
  // smuggle a CRLF or quote into the header (T-04-28). `\p{L}\p{N}` keeps
  // letters (including non-ASCII) and digits; space, dot, dash are allowed.
  const utf8NameRaw = `Laufliste-${row.personName.replace(/[^\p{L}\p{N} .\-]/gu, "")}-${row.generatedDate}.pdf`;

  const ab = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return new Response(ab, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(utf8NameRaw)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
