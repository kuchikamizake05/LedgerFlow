import { NextRequest, NextResponse } from "next/server";

const publicPaths = ["/auth/login", "/auth/register"];

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const customerToken = request.cookies.get("ledgerflow_customer_access_token");
  const staffToken = request.cookies.get("ledgerflow_access_token");
  if (pathname.startsWith("/api/wallet/auth/")) return NextResponse.next();
  if (pathname.startsWith("/wallet")) {
    if (["/wallet/login", "/wallet/register"].includes(pathname)) {
      if (customerToken) {
        const response = NextResponse.redirect(new URL("/wallet", request.url));
        response.cookies.delete("ledgerflow_access_token");
        return response;
      }
      return NextResponse.next();
    }
    if (!customerToken) return NextResponse.redirect(new URL("/wallet/login", request.url));
    const response = NextResponse.next();
    if (staffToken) response.cookies.delete("ledgerflow_access_token");
    return response;
  }
  if (customerToken && pathname.startsWith("/api/backend/"))
    return NextResponse.json({ message: "Staff authentication is required." }, { status: 401 });
  if (customerToken && !pathname.startsWith("/api/") && !pathname.startsWith("/auth/"))
    return NextResponse.redirect(new URL("/wallet", request.url));
  if (pathname.startsWith("/api/wallet/") && !pathname.startsWith("/api/wallet/auth/")) {
    if (!customerToken) return NextResponse.json({ message: "Customer authentication is required." }, { status: 401 });
    const response = NextResponse.next();
    if (staffToken) response.cookies.delete("ledgerflow_access_token");
    return response;
  }
  if (publicPaths.includes(request.nextUrl.pathname)) return NextResponse.next();
  if (!request.cookies.get("ledgerflow_access_token")) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/accounts/:path*", "/transfers/:path*", "/approvals/:path*", "/treasury/:path*", "/ledger/:path*", "/audit/:path*", "/users/:path*", "/system-status/:path*", "/wallet", "/wallet/:path*", "/api/wallet/:path*", "/api/backend/:path*"],
};
