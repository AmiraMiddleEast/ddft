import { type NextRequest, NextResponse } from "next/server";

// better-auth default session cookie name.
// ASSUMED A2: if advanced.cookiePrefix is set in lib/auth.ts, update here.
// Current lib/auth.ts does not set cookiePrefix, so default applies.
const SESSION_COOKIE = "better-auth.session_token";

export function proxy(req: NextRequest) {
  const hasSession = req.cookies.has(SESSION_COOKIE);
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
