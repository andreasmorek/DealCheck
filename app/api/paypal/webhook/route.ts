import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  fetchPaypalSubscription,
  mapPaypalPlanToInternalPlan,
  mapPaypalStatusToInternalStatus,
  verifyPaypalWebhookSignature,
} from "@/lib/paypal";

export const runtime = "nodejs";

type PaypalSubscription = {
  id?: string | null;
  custom_id?: string | null;
  plan_id?: string | null;
  status?: string | null;
  subscriber?: {
    email_address?: string | null;
  } | null;
  billing_info?: {
    next_billing_time?: string | null;
  } | null;
};

function extractSubscriptionId(eventBody: any): string | null {
  const candidate =
    eventBody?.resource?.id ||
    eventBody?.resource?.subscription_id ||
    eventBody?.resource?.billing_agreement_id ||
    null;

  return typeof candidate === "string" && candidate.trim()
    ? candidate.trim()
    : null;
}

function normalizeString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeEmail(value: unknown): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim().toLowerCase()
    : null;
}

async function resolveUserId(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  subscriptionId: string,
  customId: string | null
): Promise<string | null> {
  if (customId) {
    return customId;
  }

  const { data, error } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("paypal_subscription_id", subscriptionId)
    .maybeSingle();

  if (error) {
    console.error("WEBHOOK LOOKUP BY SUBSCRIPTION FAILED", error);
    return null;
  }

  return normalizeString(data?.user_id);
}

function buildSubscriptionPayload(
  userId: string,
  subscriptionId: string,
  paypalSubscription: PaypalSubscription
) {
  const plan = mapPaypalPlanToInternalPlan(paypalSubscription.plan_id ?? null);
  const status = mapPaypalStatusToInternalStatus(paypalSubscription.status ?? null);

  return {
    record: {
      user_id: userId,
      provider: "paypal",
      plan,
      status,
      subscription_id: paypalSubscription.id ?? subscriptionId,
      paypal_subscription_id: paypalSubscription.id ?? subscriptionId,
      paypal_plan_id: paypalSubscription.plan_id ?? null,
      paypal_email: normalizeEmail(paypalSubscription.subscriber?.email_address),
      current_period_end: paypalSubscription.billing_info?.next_billing_time ?? null,
      updated_at: new Date().toISOString(),
    },
    plan,
    status,
  };
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "paypal-webhook-live",
    method: "GET",
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const isValid = await verifyPaypalWebhookSignature({
      headers: request.headers,
      body,
    });

    if (!isValid) {
      console.error("PAYPAL WEBHOOK INVALID SIGNATURE");
      return NextResponse.json(
        { error: "Ungültige Signatur." },
        { status: 400 }
      );
    }

    const eventType = normalizeString(body?.event_type);
    const subscriptionId = extractSubscriptionId(body);

    if (!subscriptionId) {
      return NextResponse.json({
        ok: true,
        ignored: true,
        reason: "no_subscription_id",
      });
    }

    const paypalSubscription = (await fetchPaypalSubscription(
      subscriptionId
    )) as PaypalSubscription;

    const customId = normalizeString(paypalSubscription.custom_id);
    const admin = createSupabaseAdminClient();

    console.log("PAYPAL WEBHOOK RECEIVED", {
      eventType,
      subscriptionId,
      customId,
      paypalEmail: normalizeEmail(paypalSubscription.subscriber?.email_address),
      paypalPlanId: normalizeString(paypalSubscription.plan_id),
      paypalStatus: normalizeString(paypalSubscription.status),
    });

    const userId = await resolveUserId(admin, subscriptionId, customId);

    if (!userId) {
      console.error("WEBHOOK USER NOT RESOLVED", {
        eventType,
        subscriptionId,
        customId,
      });

      return NextResponse.json({
        ok: true,
        ignored: true,
        reason: "user_not_resolved",
      });
    }

    const { record, plan, status } = buildSubscriptionPayload(
      userId,
      subscriptionId,
      paypalSubscription
    );

    const { error: upsertError } = await admin
      .from("subscriptions")
      .upsert(record, { onConflict: "user_id" });

    if (upsertError) {
      console.error("WEBHOOK UPSERT FAILED", upsertError);
      return NextResponse.json(
        { error: "Webhook-Upsert fehlgeschlagen." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      eventType,
      userId,
      subscriptionId,
      plan,
      status,
    });
  } catch (error) {
    console.error("PAYPAL WEBHOOK ERROR", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Webhook fehlgeschlagen.",
      },
      { status: 500 }
    );
  }
}