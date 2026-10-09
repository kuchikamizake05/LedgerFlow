import { NextRequest, NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/request-security";

export async function POST(request: NextRequest) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Cross-origin registration rejected." }, { status: 403 });
    const body = await request.text();
    if (body.length > 8192) return NextResponse.json({ message: "Request too large." }, { status: 413 });
    const base = process.env.LEDGERFLOW_API_URL || "http://127.0.0.1:8081";
    const response = await fetch(`${base}/api/wallet/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body, cache: "no-store", signal: AbortSignal.timeout(12000) });
    const data = await response.json();
    return NextResponse.json(response.ok ? { user: data.user } : data, { status: response.status });
  } catch {
    return NextResponse.json({ message: "Wallet service is unavailable. Try again shortly." }, { status: 502 });
  }
}
