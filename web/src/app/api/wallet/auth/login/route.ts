import { NextRequest, NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/request-security";

const cookieName = "ledgerflow_customer_access_token";

export async function POST(request: NextRequest) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Cross-origin sign in rejected." }, { status: 403 });
    const body = await request.text();
    if (body.length > 8192) return NextResponse.json({ message: "Request too large." }, { status: 413 });
    const base = process.env.LEDGERFLOW_API_URL || "http://127.0.0.1:8081";
    const response = await fetch(`${base}/api/wallet/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body, cache: "no-store", signal: AbortSignal.timeout(12000) });
    const data = await response.json();
    if (!response.ok) return NextResponse.json(data, { status: response.status });
    if (data.user?.role !== "CUSTOMER" || !data.accessToken) return NextResponse.json({ message: "Customer access is required." }, { status: 403 });
    const result = NextResponse.json({ user: data.user, expiresAt: data.expiresAt });
    result.cookies.set(cookieName, data.accessToken, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 30 * 60 });
    result.cookies.delete("ledgerflow_access_token");
    return result;
  } catch {
    return NextResponse.json({ message: "Wallet service is unavailable. Try again shortly." }, { status: 502 });
  }
}
