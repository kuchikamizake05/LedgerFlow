import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const base = process.env.LEDGERFLOW_API_URL || "http://127.0.0.1:8081";
    const response = await fetch(`${base}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    const data = await response.json();
    return NextResponse.json(
      response.ok ? { user: data.user } : data,
      { status: response.status },
    );
  } catch {
    return NextResponse.json(
      { message: "Registration service is unavailable. Try again shortly." },
      { status: 502 },
    );
  }
}
