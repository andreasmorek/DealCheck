const PAYPAL_API_BASE =
  process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

const DEALCHECK_PREMIUM_PLAN_ID = "P-51462856DU6745131NHCBNRA";

type PaypalAccessTokenResponse = {
  access_token: string;
};

export type PaypalSubscriptionResponse = {
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

type VerifyWebhookResponse = {
  verification_status?: string;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export async function getPaypalAccessToken(): Promise<string> {
  const clientId = requireEnv("PAYPAL_CLIENT_ID");
  const clientSecret = requireEnv("PAYPAL_CLIENT_SECRET");

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PayPal token error: ${response.status} ${text}`);
  }

  const data = (await response.json()) as PaypalAccessTokenResponse;

  if (!data.access_token) {
    throw new Error("PayPal access token missing.");
  }

  return data.access_token;
}

export async function fetchPaypalSubscription(
  subscriptionId: string
): Promise<PaypalSubscriptionResponse> {
  const accessToken = await getPaypalAccessToken();

  const response = await fetch(
    `${PAYPAL_API_BASE}/v1/billing/subscriptions/${subscriptionId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `PayPal subscription fetch failed: ${response.status} ${text}`
    );
  }

  return (await response.json()) as PaypalSubscriptionResponse;
}

export function mapPaypalPlanToInternalPlan(
  paypalPlanId: string | null | undefined
): "free" | "premium" {
  if (!paypalPlanId) return "free";
  return paypalPlanId === DEALCHECK_PREMIUM_PLAN_ID ? "premium" : "free";
}

export function mapPaypalStatusToInternalStatus(
  paypalStatus: string | null | undefined
): "active" | "inactive" | "cancelled" | "suspended" {
  const value = (paypalStatus ?? "").toUpperCase();

  if (value === "ACTIVE" || value === "APPROVED") return "active";
  if (value === "SUSPENDED") return "suspended";
  if (value === "CANCELLED" || value === "EXPIRED") return "cancelled";
  return "inactive";
}

export async function verifyPaypalWebhookSignature(params: {
  headers: {
    transmissionId: string | null;
    transmissionTime: string | null;
    transmissionSig: string | null;
    authAlgo: string | null;
    certUrl: string | null;
  };
  body: unknown;
}): Promise<boolean> {
  const webhookId = requireEnv("PAYPAL_WEBHOOK_ID");

  const {
    transmissionId,
    transmissionTime,
    transmissionSig,
    authAlgo,
    certUrl,
  } = params.headers;

  if (
    !transmissionId ||
    !transmissionTime ||
    !transmissionSig ||
    !authAlgo ||
    !certUrl
  ) {
    return false;
  }

  // PayPal simulator / mock events cannot be verified against the endpoint
  if (webhookId === "WEBHOOK_ID") {
    return true;
  }

  const accessToken = await getPaypalAccessToken();

  const response = await fetch(
    `${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transmission_id: transmissionId,
        transmission_time: transmissionTime,
        cert_url: certUrl,
        auth_algo: authAlgo,
        transmission_sig: transmissionSig,
        webhook_id: webhookId,
        webhook_event: params.body,
      }),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `PayPal webhook verification failed: ${response.status} ${text}`
    );
  }

  const data = (await response.json()) as VerifyWebhookResponse;
  return data.verification_status === "SUCCESS";
}