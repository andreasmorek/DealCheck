import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type PlanName = "free" | "pro";

const FREE_LIMIT = 3;

function getPlanLimit(plan: PlanName) {
  if (plan === "pro") return null;
  return FREE_LIMIT;
}

async function getUserFromAccessToken(token: string) {
  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseAuth.auth.getUser(token);
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : null;

    if (!token) {
      return NextResponse.json({
        allowed: false,
        reason: "Bitte logge dich ein, um Preischecks zu nutzen.",
        plan: "free",
        used: 0,
        limit: FREE_LIMIT,
        authenticated: false,
        upgradeUrl: "/upgrade",
        loginUrl: "/login",
      });
    }

    const {
      data: { user },
      error: userError,
    } = await getUserFromAccessToken(token);

    if (userError || !user) {
      return NextResponse.json({
        allowed: false,
        reason: "Deine Sitzung konnte nicht geprüft werden. Bitte erneut einloggen.",
        plan: "free",
        used: 0,
        limit: FREE_LIMIT,
        authenticated: false,
        upgradeUrl: "/upgrade",
        loginUrl: "/login",
      });
    }

    const userId = user.id;

    const { data: subscription, error: subscriptionError } = await supabaseServer
      .from("subscriptions")
      .select("status, plan")
      .eq("user_id", userId)
      .in("status", ["active", "trialing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subscriptionError) {
      console.error("SUBSCRIPTION LOOKUP FAILED", subscriptionError);
    }

    const plan: PlanName = subscription?.plan === "pro" ? "pro" : "free";
    const limit = getPlanLimit(plan);

    const { count, error: usageError } = await supabaseServer
      .from("analysis_usage")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (usageError) {
      console.error("USAGE LOOKUP FAILED", usageError);
      return NextResponse.json(
        {
          allowed: false,
          reason: "Nutzung konnte gerade nicht geprüft werden.",
          plan,
          used: 0,
          limit,
          authenticated: true,
          upgradeUrl: "/upgrade",
          loginUrl: "/login",
        },
        { status: 500 }
      );
    }

    const used = count ?? 0;

    if (limit === null) {
      return NextResponse.json({
        allowed: true,
        reason: null,
        plan,
        used,
        limit,
        authenticated: true,
        upgradeUrl: "/upgrade",
        loginUrl: "/login",
      });
    }

    if (used < limit) {
      return NextResponse.json({
        allowed: true,
        reason: null,
        plan,
        used,
        limit,
        authenticated: true,
        upgradeUrl: "/upgrade",
        loginUrl: "/login",
      });
    }

    return NextResponse.json({
      allowed: false,
      reason: "Dein Gratis-Kontingent ist aufgebraucht. Upgrade auf Pro für weitere Preischecks.",
      plan,
      used,
      limit,
      authenticated: true,
      upgradeUrl: "/upgrade",
      loginUrl: "/login",
    });
  } catch (error) {
    console.error("CHECK ACCESS ERROR", error);

    return NextResponse.json(
      {
        allowed: false,
        reason: "Zugriff konnte nicht geprüft werden.",
        plan: "free",
        used: 0,
        limit: FREE_LIMIT,
        authenticated: false,
        upgradeUrl: "/upgrade",
        loginUrl: "/login",
      },
      { status: 500 }
    );
  }
}