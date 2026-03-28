export type InternalPlan = "free" | "pro";
export type InternalSubscriptionStatus =
  | "pending"
  | "trialing"
  | "active"
  | "paused"
  | "canceled"
  | "inactive";

export type PayPalSubscription = {
  id?: string;
  status?: string;
  plan_id?: string;
  custom_id?: string;
  subscriber?: {
    email_address?: string;
  };
  billing_info?: {
    next_billing_time?: string;
    last_payment?: {
      time?: string;
      amount?: {
        value?: string;
        currency_code?: string;
      };
    };
    failed_payments_count?: number;
  };
  create_time?: string;
  update_time?: string;
};

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} fehlt.`);
  }
  return value;
}

export function getPaypalBaseUrl() {
  return process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

export async function getPaypalAccessToken() {
  const clientId = requiredEnv("PAYPAL_CLIENT_ID");
  const clientSecret = requiredEnv("PAYPAL_CLIENT_SECRET");
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(`${getPaypalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.access_token) {
    throw new Error(`PayPal Token Fehler: ${JSON.stringify(data)}`);
  }

  return data.access_token as string;
}

export async function fetchPaypalSubscription(subscriptionId: string) {
  const accessToken = await getPaypalAccessToken();

  const response = await fetch(
    `${getPaypalBaseUrl()}/v1/billing/subscriptions/${subscriptionId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    }
  );

  const data = (await response.json().catch(() => null)) as PayPalSubscription | null;

  if (!response.ok || !data) {
    throw new Error(`PayPal Subscription Lookup Fehler: ${JSON.stringify(data)}`);
  }

  return data;
}

export function mapPaypalPlanToInternalPlan(paypalPlanId?: string | null): InternalPlan {
  return paypalPlanId === process.env.PAYPAL_PRO_PLAN_ID ? "pro" : "free";
}

export function mapPaypalStatusToInternalStatus(
  paypalStatus?: string | null
): InternalSubscriptionStatus {
  switch (String(paypalStatus || "").toUpperCase()) {
    case "ACTIVE":
      return "active";
    case "APPROVAL_PENDING":
    case "APPROVED":
      return "pending";
    case "SUSPENDED":
      return "paused";
    case "CANCELLED":
    case "EXPIRED":
      return "canceled";
    case "CREATED":
      return "pending";
    default:
      return "inactive";
  }
}

export async function verifyPaypalWebhookSignature({
  headers,
  body,
}: {
  headers: Headers;
  body: unknown;
}) {
  const webhookId = requiredEnv("PAYPAL_WEBHOOK_ID");
  const accessToken = await getPaypalAccessToken();

  const verificationPayload = {
    auth_algo: headers.get("paypal-auth-algo"),
    cert_url: headers.get("paypal-cert-url"),
    transmission_id: headers.get("paypal-transmission-id"),
    transmission_sig: headers.get("paypal-transmission-sig"),
    transmission_time: headers.get("paypal-transmission-time"),
    webhook_id: webhookId,
    webhook_event: body,
  };

  const response = await fetch(
    `${getPaypalBaseUrl()}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(verificationPayload),
      cache: "no-store",
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(`PayPal Webhook-Verifikation fehlgeschlagen: ${JSON.stringify(data)}`);
  }

  return String(data?.verification_status || "").toUpperCase() === "SUCCESS";
}
