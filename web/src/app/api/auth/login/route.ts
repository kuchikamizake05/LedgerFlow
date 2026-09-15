import { NextRequest, NextResponse } from "next/server";

const tokenCookie = "ledgerflow_access_token";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const base = process.env.LEDGERFLOW_API_URL || "http://127.0.0.1:8081";
    const response = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    const data = await response.json();
    if (!response.ok) return NextResponse.json(data, { status: response.status });

    const result = NextResponse.json({ user: data.user, expiresAt: data.expiresAt });
    result.cookies.set(tokenCookie, data.accessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 30 * 60,
    });
    return result;
  } catch {
    return NextResponse.json(
      { message: "Authentication service is unavailable. Try again shortly." },
      { status: 502 },
    );
  }
}
