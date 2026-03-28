import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({
        authenticated: false,
        allowed: false,
        plan: "free",
        reason: "Bitte logge dich ein.",
        userId: null,
        usage: { used: 0, limit: 3, remaining: 3 },
      });
    }

    const { data: subscription, error: subscriptionError } = await supabase
      .from("subscriptions")
      .select("user_id, plan, status, provider")
      .eq("user_id", user.id)
      .maybeSingle();

    if (subscriptionError) {
      console.error("CHECK-ACCESS subscription error:", subscriptionError);
    }

    const isPremium =
      subscription?.status === "active" &&
      subscription?.plan === "premium";

    const plan = isPremium ? "premium" : "free";
    const limit = isPremium ? 999999 : 3;
    const used = 0;

    return NextResponse.json({
      authenticated: true,
      allowed: used < limit,
      plan,
      reason: used < limit ? null : "Upgrade erforderlich.",
      userId: user.id,
      usage: {
        used,
        limit,
        remaining: Math.max(0, limit - used),
      },
    });
  } catch (error) {
    console.error("CHECK-ACCESS fatal error:", error);

    return NextResponse.json(
      {
        authenticated: false,
        allowed: false,
        plan: "free",
        reason: "Fehler bei der Prüfung des Zugangs.",
        userId: null,
        usage: { used: 0, limit: 3, remaining: 3 },
      },
      { status: 500 }
    );
  }
}