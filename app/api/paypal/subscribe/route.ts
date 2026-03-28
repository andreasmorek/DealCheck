import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  fetchPaypalSubscription,
  mapPaypalPlanToInternalPlan,
  mapPaypalStatusToInternalStatus,
} from "@/lib/paypal";

export const runtime = "nodejs";

type PaypalSubscription = {
  id?: string | null;
  plan_id?: string | null;
  status?: string | null;
  subscriber?: {
    email_address?: string | null;
  } | null;
  billing_info?: {
    next_billing_time?: string | null;
  } | null;
};

function normalizeString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeEmail(value: unknown): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim().toLowerCase()
    : null;
}

function buildSubscriptionRecord(
  userId: string,
  subscriptionId: string,
  paypalSubscription: PaypalSubscription
) {
  const resolvedSubscriptionId =
    normalizeString(paypalSubscription.id) ?? subscriptionId;

  const plan = mapPaypalPlanToInternalPlan(paypalSubscription.plan_id ?? null);
  const status = mapPaypalStatusToInternalStatus(paypalSubscription.status ?? null);

  return {
    record: {
      user_id: userId,
      provider: "paypal",
      plan,
      status,
      subscription_id: resolvedSubscriptionId,
      paypal_subscription_id: resolvedSubscriptionId,
      paypal_plan_id: normalizeString(paypalSubscription.plan_id),
      paypal_email: normalizeEmail(paypalSubscription.subscriber?.email_address),
      current_period_end:
        normalizeString(paypalSubscription.billing_info?.next_billing_time),
      updated_at: new Date().toISOString(),
    },
    plan,
    status,
  };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Nicht eingeloggt." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);
    const subscriptionId = normalizeString(body?.subscriptionId);

    if (!subscriptionId) {
      return NextResponse.json(
        { error: "subscriptionId fehlt." },
        { status: 400 }
      );
    }

    const paypalSubscription = (await fetchPaypalSubscription(
      subscriptionId
    )) as PaypalSubscription;

    console.log("PAYPAL SUBSCRIBE SYNC", {
      userId: user.id,
      subscriptionId,
      paypalSubscriptionId: normalizeString(paypalSubscription.id),
      paypalPlanId: normalizeString(paypalSubscription.plan_id),
      paypalStatus: normalizeString(paypalSubscription.status),
      paypalEmail: normalizeEmail(paypalSubscription.subscriber?.email_address),
    });

    const admin = createSupabaseAdminClient();
    const { record, plan, status } = buildSubscriptionRecord(
      user.id,
      subscriptionId,
      paypalSubscription
    );

    const { error: upsertError } = await admin
      .from("subscriptions")
      .upsert(record, { onConflict: "user_id" });

    if (upsertError) {
      console.error("PAYPAL SUBSCRIBE UPSERT FAILED", upsertError);
      return NextResponse.json(
        { error: "Abo konnte nicht gespeichert werden." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      plan,
      status,
      sourceOfTruth: "webhook",
      synced: true,
    });
  } catch (error) {
    console.error("PAYPAL SUBSCRIBE ERROR", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Abo konnte nicht gespeichert werden.",
      },
      { status: 500 }
    );
  }
}