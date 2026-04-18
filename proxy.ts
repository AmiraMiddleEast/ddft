import { type NextRequest, NextResponse } from "next/server";

// better-auth session cookie name. In production over HTTPS, better-auth
// automatically prefixes the cookie with `__Secure-` (browser convention
// for secure-only cookies). Dev over http://localhost uses the bare name.
// Check BOTH variants so the gate works in both environments.
const SESSION_COOKIE = "better-auth.session_token";
const SESSION_COOKIE_SECURE = "__Secure-better-auth.session_token";

export function proxy(req: NextRequest) {
  const hasSession =
    req.cookies.has(SESSION_COOKIE) || req.cookies.has(SESSION_COOKIE_SECURE);
  const { pathname } = req.nextUrl;
  const isLoginPage = pathname.startsWith("/login");

  // Unauthenticated → /login (except on /login itself)
  if (!hasSession && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Authenticated → bounce away from /login back to /
  if (hasSession && isLoginPage) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Match all routes except: API routes, Next internals, static files, favicon
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
