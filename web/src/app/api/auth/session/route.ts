import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const token = (await cookies()).get("ledgerflow_access_token")?.value;
  if (!token) return NextResponse.json({ message: "Authentication is required" }, { status: 401 });

  try {
    const base = process.env.LEDGERFLOW_API_URL || "http://127.0.0.1:8081";
    const response = await fetch(`${base}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    const data = await response.json();
    const result = NextResponse.json(data, { status: response.status });
    if (!response.ok) result.cookies.delete("ledgerflow_access_token");
    return result;
  } catch {
    return NextResponse.json({ message: "Authentication service is unavailable." }, { status: 502 });
  }
}
