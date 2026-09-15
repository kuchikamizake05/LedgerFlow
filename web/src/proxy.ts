import { NextRequest, NextResponse } from "next/server";

const publicPaths = ["/auth/login", "/auth/register"];

export function proxy(request: NextRequest) {
  if (publicPaths.includes(request.nextUrl.pathname)) return NextResponse.next();
  if (!request.cookies.get("ledgerflow_access_token")) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/accounts/:path*", "/transfers/:path*", "/treasury/:path*", "/ledger/:path*", "/system-status/:path*"],
};
