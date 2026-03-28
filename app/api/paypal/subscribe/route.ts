import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  fetchPaypalSubscription,
  mapPaypalPlanToInternalPlan,
  mapPaypalStatusToInternalStatus,
  type PaypalSubscriptionResponse,
} from "@/lib/paypal";

export const runtime = "nodejs";

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
  paypalSubscription: PaypalSubscriptionResponse
) {
  const resolvedSubscriptionId =
    normalizeString(paypalSubscription.id) ?? subscriptionId;

  const plan = mapPaypalPlanToInternalPlan(
    normalizeString(paypalSubscription.plan_id)
  );

  const status = mapPaypalStatusToInternalStatus(
    normalizeString(paypalSubscription.status)
  );

  return {
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
      return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const subscriptionId = normalizeString(body?.subscriptionId);

    if (!subscriptionId) {
      return NextResponse.json(
        { error: "subscriptionId fehlt." },
        { status: 400 }
      );
    }

    const paypalSubscription = await fetchPaypalSubscription(subscriptionId);

    const record = buildSubscriptionRecord(
      user.id,
      subscriptionId,
      paypalSubscription
    );

    const admin = createSupabaseAdminClient();

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
      synced: true,
      plan: record.plan,
      status: record.status,
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