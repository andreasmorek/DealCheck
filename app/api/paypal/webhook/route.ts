import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  fetchPaypalSubscription,
  mapPaypalPlanToInternalPlan,
  mapPaypalStatusToInternalStatus,
  verifyPaypalWebhookSignature,
  type PaypalSubscriptionResponse,
} from "@/lib/paypal";

export const runtime = "nodejs";

type PaypalWebhookEvent = {
  event_type?: string | null;
  resource?: {
    id?: string | null;
    plan_id?: string | null;
    status?: string | null;
    subscriber?: {
      email_address?: string | null;
    } | null;
    billing_info?: {
      next_billing_time?: string | null;
    } | null;
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

function buildRecordFromSubscription(
  userId: string,
  subscription: PaypalSubscriptionResponse
) {
  const subscriptionId = normalizeString(subscription.id);

  if (!subscriptionId) {
    throw new Error("PayPal subscription id missing.");
  }

  return {
    user_id: userId,
    provider: "paypal",
    plan: mapPaypalPlanToInternalPlan(normalizeString(subscription.plan_id)),
    status: mapPaypalStatusToInternalStatus(normalizeString(subscription.status)),
    subscription_id: subscriptionId,
    paypal_subscription_id: subscriptionId,
    paypal_plan_id: normalizeString(subscription.plan_id),
    paypal_email: normalizeEmail(subscription.subscriber?.email_address),
    current_period_end:
      normalizeString(subscription.billing_info?.next_billing_time),
    updated_at: new Date().toISOString(),
  };
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const body = rawBody ? (JSON.parse(rawBody) as PaypalWebhookEvent) : {};

    const isVerified = await verifyPaypalWebhookSignature({
      headers: {
        transmissionId: request.headers.get("paypal-transmission-id"),
        transmissionTime: request.headers.get("paypal-transmission-time"),
        transmissionSig: request.headers.get("paypal-transmission-sig"),
        authAlgo: request.headers.get("paypal-auth-algo"),
        certUrl: request.headers.get("paypal-cert-url"),
      },
      body,
    });

    if (!isVerified) {
      return NextResponse.json(
        { error: "Ungültige Webhook-Signatur." },
        { status: 400 }
      );
    }

    const subscriptionId =
      normalizeString(body.resource?.id) ??
      normalizeString((body as { id?: unknown }).id);

    if (!subscriptionId) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const admin = createSupabaseAdminClient();

    const { data: existingBySubId, error: lookupError } = await admin
      .from("subscriptions")
      .select("user_id")
      .eq("paypal_subscription_id", subscriptionId)
      .maybeSingle();

    if (lookupError) {
      console.error("WEBHOOK LOOKUP ERROR", lookupError);
    }

    if (!existingBySubId?.user_id) {
      return NextResponse.json({ ok: true, ignored: true, reason: "unknown_user" });
    }

    const paypalSubscription = await fetchPaypalSubscription(subscriptionId);
    const record = buildRecordFromSubscription(
      existingBySubId.user_id,
      paypalSubscription
    );

    const { error: upsertError } = await admin
      .from("subscriptions")
      .upsert(record, { onConflict: "user_id" });

    if (upsertError) {
      console.error("WEBHOOK UPSERT ERROR", upsertError);
      return NextResponse.json(
        { error: "Webhook konnte nicht gespeichert werden." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      synced: true,
      subscriptionId,
      plan: record.plan,
      status: record.status,
      eventType: body.event_type ?? null,
    });
  } catch (error) {
    console.error("PAYPAL WEBHOOK ERROR", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Webhook konnte nicht verarbeitet werden.",
      },
      { status: 500 }
    );
  }
}