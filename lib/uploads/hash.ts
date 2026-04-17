export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // Web Crypto is global in Node 22 (RESEARCH §SHA-256 Dedup Strategy).
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
