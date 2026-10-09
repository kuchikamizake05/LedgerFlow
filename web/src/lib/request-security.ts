import type { NextRequest } from "next/server";

/** Accept only browser writes whose Origin matches this request's host and scheme. */
export function isSameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;

  try {
    const originUrl = new URL(origin);
    return originUrl.host.toLowerCase() === host.toLowerCase()
      && originUrl.protocol === request.nextUrl.protocol;
  } catch {
    return false;
  }
}
