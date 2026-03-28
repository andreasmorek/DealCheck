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
    return {
      authenticated: false,
      allowed: false,
      plan: "free",
      reason: "Bitte logge dich ein.",
      userId: null,
      usage: {
        used: 0,
        limit: FREE_LIMIT,
        remaining: FREE_LIMIT,
      },
    };
  }

  const { data: subscription, error: subscriptionError } = await supabase
    .from("subscriptions")
    .select("plan, status, subscription_id, paypal_subscription_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (subscriptionError) {
    console.error("SUBSCRIPTION READ ERROR", subscriptionError);
  }

  let plan: UserPlan = "free";

  if (subscription) {
    const rawPlan = String(subscription.plan || "").toLowerCase();
    const rawStatus = String(subscription.status || "").toLowerCase();

    const hasSubscription =
      Boolean(subscription.paypal_subscription_id) ||
      Boolean(subscription.subscription_id);

    if (rawStatus === "active" && (rawPlan === "pro" || hasSubscription)) {
      plan = "pro";
    }
  }

  if (plan === "pro") {
    return {
      authenticated: true,
      allowed: true,
      plan,
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
      .from("analysis_usage")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", start)
      .lt("created_at", end);

    if (error) {
      console.error("USAGE COUNT ERROR", error);
      used = 0;
    } else {
      used = count ?? 0;
    }
  } catch (error) {
    console.error("USAGE COUNT CATCH", error);
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
      : "Upgrade erforderlich. Dein Free-Limit ist erreicht.",
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
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("analysis_usage").insert(payload);

  if (error) {
    console.error("USAGE TRACKING ERROR", error);
  } else {
    console.log("USAGE TRACKING INSERT OK", payload);
  }
}