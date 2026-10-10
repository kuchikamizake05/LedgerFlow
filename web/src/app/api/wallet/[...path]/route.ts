import { NextRequest, NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/request-security";

const uuid = "[a-fA-F0-9-]{36}";
const reads = new RegExp(`^(me|history|progress|recipient/${uuid}|transactions/${uuid})$`);
const writes = /^(topups|transfers)$/;

async function forward(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const path = (await context.params).path.join("/");
  if (!(request.method === "GET" ? reads : writes).test(path)) return NextResponse.json({ message: "Endpoint not supported." }, { status: 404 });
  if (request.method === "POST" && !isSameOriginRequest(request)) return NextResponse.json({ message: "Cross-origin write rejected." }, { status: 403 });
  const token = request.cookies.get("ledgerflow_customer_access_token")?.value;
  if (!token) return NextResponse.json({ message: "Customer authentication is required." }, { status: 401 });
  try {
    const body = request.method === "POST" ? await request.text() : undefined;
    if (body && body.length > 8192) return NextResponse.json({ message: "Request too large." }, { status: 413 });
    const base = process.env.LEDGERFLOW_API_URL || "http://127.0.0.1:8081";
    const response = await fetch(`${base}/api/wallet/${path}${request.nextUrl.search}`, { method: request.method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body, cache: "no-store", signal: AbortSignal.timeout(12000) });
    const raw = await response.text();
    const data = JSON.parse(raw.replace(/("(?:amount|balance|currentBalance|openingBalance)"\s*:\s*)(-?\d+(?:\.\d+)?)/g, '$1"$2"'));
    const result = NextResponse.json(data, { status: response.status });
    if (response.status === 401) result.cookies.delete("ledgerflow_customer_access_token");
    return result;
  } catch {
    return NextResponse.json({ message: "Wallet request timed out or could not reach the service. Keep the request reference and check history before retrying." }, { status: 502 });
  }
}

export const GET = forward;
export const POST = forward;
