import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { subscriptionId, userId } = body;

    if (!subscriptionId || !userId) {
      return NextResponse.json({ error: "Fehlende Daten" }, { status: 400 });
    }

    const { error } = await supabaseServer.from("subscriptions").upsert(
      {
        user_id: userId,
        plan: "pro",
        status: "active",
        provider: "paypal",
        subscription_id: subscriptionId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (error) {
      console.error(error);
      return NextResponse.json({ error: "DB Fehler" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Serverfehler" }, { status: 500 });
  }
}