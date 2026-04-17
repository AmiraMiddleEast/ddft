import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/lib/auth";
import { getDocumentForUser } from "@/lib/documents/queries";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const doc = await getDocumentForUser(id, session.user.id);
  if (!doc) return new NextResponse("Not found", { status: 404 });

  const abs = path.isAbsolute(doc.storagePath)
    ? doc.storagePath
    : path.resolve(process.cwd(), doc.storagePath);

  let bytes: Buffer;
  try {
    bytes = await readFile(abs);
  } catch {
    return new NextResponse("File missing", { status: 410 });
  }

  // Convert Buffer to a typed Uint8Array for the Response constructor
  const ab = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return new Response(ab, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.byteLength),
      // RFC 6266 / RFC 5987: plain ASCII fallback in filename= (for older clients)
      // plus the percent-encoded UTF-8 value in filename*= (for all modern clients).
      // This ensures German umlauts (ä, ö, ü, ß) are preserved correctly.
      "Content-Disposition": `inline; filename="document.pdf"; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
