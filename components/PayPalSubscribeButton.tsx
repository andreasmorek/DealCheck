"use client";

import {
  PayPalButtons,
  PayPalScriptProvider,
  type ReactPayPalScriptOptions,
} from "@paypal/react-paypal-js";
import { useMemo, useState } from "react";

type Props = {
  userId: string;
};

export default function PayPalSubscribeButton({ userId }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const planId = process.env.NEXT_PUBLIC_PAYPAL_PLAN_ID;

  const options = useMemo<ReactPayPalScriptOptions | null>(() => {
    if (!clientId) return null;

    return {
      clientId,
      vault: true,
      intent: "subscription",
      currency: "EUR",
    };
  }, [clientId]);

  if (!clientId || !planId || !options) {
    return <div className="text-sm text-red-400">PayPal Konfiguration fehlt</div>;
  }

  return (
    <PayPalScriptProvider options={options}>
      <div className="space-y-3">
        {loading ? (
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">
            Zahlung wird verarbeitet...
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <PayPalButtons
          style={{
            layout: "vertical",
            shape: "pill",
            label: "subscribe",
          }}
          createSubscription={(_data, actions) => {
            setError(null);
            setLoading(false);

            return actions.subscription.create({
              plan_id: planId,
              custom_id: userId,
            });
          }}
          onApprove={async (data) => {
            try {
              setError(null);
              setLoading(true);

              if (!data.subscriptionID) {
                throw new Error("Keine subscriptionID erhalten.");
              }

              const response = await fetch("/api/paypal/subscribe", {
                method: "POST",
                credentials: "include",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  subscriptionId: data.subscriptionID,
                }),
              });

              const result = await response.json().catch(() => null);

              if (!response.ok) {
                throw new Error(result?.error || "Abo konnte nicht gespeichert werden.");
              }

              window.location.href = "/success?subscription_id=" + encodeURIComponent(data.subscriptionID);
            } catch (err) {
              console.error("PAYPAL APPROVE ERROR", err);
              setError(
                err instanceof Error
                  ? err.message
                  : "Zahlung erfolgreich, aber Freischaltung fehlgeschlagen."
              );
              setLoading(false);
            }
          }}
          onError={(err) => {
            console.error("PAYPAL ERROR", err);
            setError("PayPal konnte nicht geladen werden.");
            setLoading(false);
          }}
          onCancel={() => {
            setError("Zahlung wurde abgebrochen.");
            setLoading(false);
          }}
        />
      </div>
    </PayPalScriptProvider>
  );
}
