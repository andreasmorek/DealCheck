import { NextResponse } from "next/server";
import { getAccessState } from "@/lib/access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const access = await getAccessState();

  console.log("CHECK-ACCESS DEBUG", {
    authenticated: access.authenticated,
    allowed: access.allowed,
    plan: access.plan,
    userId: access.userId,
    usage: access.usage,
    reason: access.reason || null,
  });

  return NextResponse.json(access, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}