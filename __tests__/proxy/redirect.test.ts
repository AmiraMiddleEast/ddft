import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

describe("proxy.ts — auth gate redirect behavior", () => {
  it("redirects unauthenticated request on / to /login", () => {
    const req = new NextRequest("http://localhost:3000/");
    const res = proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("redirects unauthenticated request on arbitrary path to /login", () => {
    const req = new NextRequest("http://localhost:3000/secret-thing");
    const res = proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("does NOT redirect /login when no cookie present (would infinite loop)", () => {
    const req = new NextRequest("http://localhost:3000/login");
    const res = proxy(req);
    expect(res.status).not.toBe(307);
  });

  it("redirects authenticated request on /login back to /", () => {
    // happy-dom strips the cookie header in the Headers ctor, so use
    // cookies.set() directly to attach the session cookie for the proxy check.
    const req = new NextRequest("http://localhost:3000/login");
    req.cookies.set("better-auth.session_token", "fake-value");
    const res = proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/$/);
  });

  it("allows authenticated request on / to pass through", () => {
    const req = new NextRequest("http://localhost:3000/");
    req.cookies.set("better-auth.session_token", "fake-value");
    const res = proxy(req);
    // NextResponse.next() has status 200
    expect(res.status).toBe(200);
  });
});
