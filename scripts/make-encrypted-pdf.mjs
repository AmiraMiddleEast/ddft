// Generates __fixtures__/encrypted.pdf — a minimal PDF whose trailer references
// an /Encrypt dictionary. pdf-lib's PDFDocument.load() detects the /Encrypt key
// in the trailer and throws an EncryptedPDFError (message contains "encrypt"),
// which is exactly what validatePdf() relies on (Phase 2 D-21).
//
// We hand-craft the PDF because:
//   - pdf-lib's save() does not natively encrypt.
//   - qpdf is not available on every dev machine.
//
// Byte-level PDF format:
//   - Header: "%PDF-1.4\n"
//   - Object 1: Catalog
//   - Object 2: Pages
//   - Object 3: Page
//   - Object 4: Encrypt dictionary (Standard security handler)
//   - xref table with byte offsets to each object
//   - trailer with /Encrypt 4 0 R + /ID pair + /Root 1 0 R
//
// The /Encrypt dict fields (Filter/V/R/O/U/P/Length) are taken from a
// password-protected 40-bit RC4 PDF — fabricated values are fine because we
// only need pdf-lib to detect "this PDF is encrypted" and refuse to parse.

import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const LF = "\n";

function buildEncryptedPdf() {
  const header = "%PDF-1.4" + LF + "%\xE2\xE3\xCF\xD3" + LF;

  const objects = [
    // 1: Catalog
    "1 0 obj" + LF + "<< /Type /Catalog /Pages 2 0 R >>" + LF + "endobj" + LF,
    // 2: Pages
    "2 0 obj" + LF +
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>" + LF +
      "endobj" + LF,
    // 3: Page
    "3 0 obj" + LF +
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>" + LF +
      "endobj" + LF,
    // 4: Encrypt dict — Standard security handler, RC4 40-bit, empty password
    // O and U are 32-byte strings; these are synthetic but well-formed enough
    // for pdf-lib's trailer scan to flag the document as encrypted.
    "4 0 obj" + LF +
      "<< /Filter /Standard /V 1 /R 2 /Length 40 " +
      "/O <" + "ab".repeat(32) + "> " +
      "/U <" + "cd".repeat(32) + "> " +
      "/P -4 >>" + LF +
      "endobj" + LF,
  ];

  let body = "";
  const offsets = [];
  offsets.push(header.length); // offset of object 1
  body += objects[0];
  offsets.push(header.length + body.length);
  body += objects[1];
  offsets.push(header.length + body.length);
  body += objects[2];
  offsets.push(header.length + body.length);
  body += objects[3];

  const xrefOffset = header.length + body.length;
  const pad = (n) => String(n).padStart(10, "0");
  const xref =
    "xref" + LF +
    "0 5" + LF +
    "0000000000 65535 f " + LF +
    pad(offsets[0]) + " 00000 n " + LF +
    pad(offsets[1]) + " 00000 n " + LF +
    pad(offsets[2]) + " 00000 n " + LF +
    pad(offsets[3]) + " 00000 n " + LF;

  const trailer =
    "trailer" + LF +
    "<< /Size 5 /Root 1 0 R /Encrypt 4 0 R " +
    "/ID [<11111111111111111111111111111111><22222222222222222222222222222222>] " +
    ">>" + LF +
    "startxref" + LF +
    xrefOffset + LF +
    "%%EOF" + LF;

  return Buffer.from(header + body + xref + trailer, "binary");
}

const outDir = path.resolve(process.cwd(), "__fixtures__");
mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "encrypted.pdf");
writeFileSync(outPath, buildEncryptedPdf());
console.log("Wrote", outPath);
