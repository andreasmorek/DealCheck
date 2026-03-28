import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);

  return NextResponse.json({
    ok: true,
    pathname: url.pathname,
    codePresent: Boolean(url.searchParams.get("code")),
    next: url.searchParams.get("next") ?? null,
    fullUrl: request.url,
  });
}