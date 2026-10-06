import { NextRequest, NextResponse } from "next/server";
const uuid = "[a-fA-F0-9-]{36}";
async function forward(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const path = (await context.params).path.join("/");
  const read = new RegExp(
    `^(accounts|accounts/${uuid}(/statement)?|transfers/${uuid}(/entries)?|audit|auth/me|health|reconciliation)$`,
  );
  const write = new RegExp(
    `^(accounts|transfers|accounts/${uuid}/deposits|transfers/${uuid}/reversal)$`,
  );
  if (!(request.method === "GET" ? read : write).test(path))
    return NextResponse.json(
      { message: "Endpoint not supported." },
      { status: 404 },
    );
  if (
    request.method === "POST" &&
    request.headers.get("origin") !== request.nextUrl.origin
  )
    return NextResponse.json(
      { message: "Cross-origin write rejected." },
      { status: 403 },
    );
  try {
    const body = request.method === "POST" ? await request.text() : undefined;
    if (body && body.length > 8192)
      return NextResponse.json(
        { message: "Request too large." },
        { status: 413 },
      );
    const base = process.env.LEDGERFLOW_API_URL || "http://127.0.0.1:8081";
    const response = await fetch(
      `${base}${path === "health" ? "/actuator/health" : `/api/${path}`}${request.nextUrl.search}`,
      {
        method: request.method,
        headers: {
          "Content-Type": "application/json",
          ...(request.cookies.get("ledgerflow_access_token")?.value
            ? {
                Authorization: `Bearer ${request.cookies.get("ledgerflow_access_token")?.value}`,
              }
            : {}),
        },
        body,
        signal: AbortSignal.timeout(12000),
        cache: "no-store",
      },
    );
    const raw = await response.text();
    const data = JSON.parse(
      raw.replace(
        /("(?:amount|openingBalance|currentBalance|expectedBalance|difference|debitTotal|creditTotal)"\s*:\s*)(-?\d+(?:\.\d+)?)/g,
        '$1"$2"',
      ),
    );
    if (path === "health")
      return NextResponse.json(
        {
          status: data.status,
          database: data.components?.db?.status ?? "UNKNOWN",
        },
        { status: response.status },
      );
    const result = NextResponse.json(data, { status: response.status });
    if (response.status === 401) result.cookies.delete("ledgerflow_access_token");
    return result;
  } catch {
    return NextResponse.json(
      {
        message:
          "API unavailable or confirmation timed out. For submitted payments, retain the request reference and verify the outcome before retrying.",
      },
      { status: 502 },
    );
  }
}
export const GET = forward;
export const POST = forward;
