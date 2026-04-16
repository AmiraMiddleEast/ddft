/**
 * Helpers for auth integration tests.
 * These call the better-auth `auth` instance directly (not via HTTP) — the
 * unit of coverage is "auth.api.* behavior with Drizzle adapter + SQLite".
 */

export const TEST_OPERATOR = {
  email: "ops-test@example.com",
  password: "correcthorsebatterystaple", // 25 chars, passes D-14
  name: "ops-test@example.com",
};

/**
 * Parse a Set-Cookie header value into { name, value, attrs }.
 * better-auth sets Max-Age on the session cookie; we need to assert that.
 */
export function parseCookie(setCookieHeader: string) {
  const parts = setCookieHeader.split(";").map((s) => s.trim());
  const [nameValue, ...attrs] = parts;
  const eq = nameValue.indexOf("=");
  const name = eq === -1 ? nameValue : nameValue.slice(0, eq);
  const value = eq === -1 ? "" : nameValue.slice(eq + 1);
  const attrMap: Record<string, string | true> = {};
  for (const attr of attrs) {
    const aeq = attr.indexOf("=");
    if (aeq === -1) {
      attrMap[attr.toLowerCase()] = true;
    } else {
      const k = attr.slice(0, aeq).toLowerCase();
      const v = attr.slice(aeq + 1);
      attrMap[k] = v;
    }
  }
  return { name, value, attrs: attrMap };
}

/**
 * Build a mock Headers object carrying a prior session cookie — used to
 * simulate a subsequent request from the same browser.
 */
export function headersWithCookie(
  cookieName: string,
  cookieValue: string
): Headers {
  const h = new Headers();
  h.set("cookie", `${cookieName}=${cookieValue}`);
  return h;
}
