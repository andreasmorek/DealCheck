import { createSupabaseServerClient } from "@/lib/supabase/server";

export type UserPlan = "free" | "pro";

export type AccessState = {
  authenticated: boolean;
  allowed: boolean;
  plan: UserPlan;
  reason?: string;
  userId: string | null;
  usage: {
    used: number;
    limit: number | null;
    remaining: number | null;
  };
};

const FREE_LIMIT = 3;

function getMonthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export async function getAccessState(): Promise<AccessState> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("ACCESS USER ERROR", userError);
    return {
      authenticated: false,
      allowed: false,
      plan: "free",
      reason: "Bitte logge dich ein und nutze DealCheck kostenlos.",
      userId: null,
      usage: {
        used: 0,
        limit: FREE_LIMIT,
        remaining: FREE_LIMIT,
      },
    };
  }

  const { data: subscription, error: subError } = await supabase
    .from("subscriptions")
    .select("status, plan, created_at")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subError) {
    console.error("SUBSCRIPTION LOAD ERROR", subError);
  }

  let plan: UserPlan = "free";

  if (subscription && String(subscription.plan || "").toLowerCase() === "pro") {
    plan = "pro";
  }

  if (plan === "pro") {
    return {
      authenticated: true,
      allowed: true,
      plan: "pro",
      userId: user.id,
      usage: {
        used: 0,
        limit: null,
        remaining: null,
      },
    };
  }

  let used = 0;

  try {
    const { start, end } = getMonthRange();

    const { count, error } = await supabase
      .from("usage_tracking")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("event_type", "analyze")
      .gte("created_at", start)
      .lt("created_at", end);

    if (error) {
      console.error("USAGE COUNT ERROR", error);
      used = 0;
    } else {
      used = count ?? 0;
    }

    console.log("USAGE COUNT DEBUG", {
      userId: user.id,
      start,
      end,
      used,
    });
  } catch (err) {
    console.error("USAGE COUNT EXCEPTION", err);
    used = 0;
  }

  const remaining = Math.max(FREE_LIMIT - used, 0);
  const allowed = used < FREE_LIMIT;

  return {
    authenticated: true,
    allowed,
    plan: "free",
    reason: allowed
      ? undefined
      : "Deine 3 kostenlosen DealChecks für diesen Monat sind aufgebraucht.",
    userId: user.id,
    usage: {
      used,
      limit: FREE_LIMIT,
      remaining,
    },
  };
}

export async function registerAnalyzeUsage(userId: string) {
  const supabase = await createSupabaseServerClient();

  const payload = {
    user_id: userId,
    event_type: "analyze",
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("usage_tracking")
    .insert(payload)
    .select();

  console.log("USAGE INSERT DEBUG", {
    payload,
    inserted: data,
    error,
  });

  if (error) {
    throw error;
  }
}