"use client";

import {
  PayPalScriptProvider,
  PayPalButtons,
} from "@paypal/react-paypal-js";
import { useMemo, useState } from "react";

type Props = {
  userId: string;
};

export default function PayPalSubscribeButton({ userId }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const planId = process.env.NEXT_PUBLIC_PAYPAL_PLAN_ID!;
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!;

  const options = useMemo(
    () => ({
      clientId,
      vault: true,
      intent: "subscription" as const,
      currency: "EUR",
    }),
    [clientId]
  );

  if (!clientId || !planId) {
    return (
      <div className="text-sm text-red-400">
        PayPal Konfiguration fehlt
      </div>
    );
  }

  return (
    <PayPalScriptProvider options={options}>
      <div className="space-y-3">

        {loading && (
          <div className="text-sm text-white/70">
            Zahlung wird verarbeitet...
          </div>
        )}

        {error && (
          <div className="text-sm text-red-400">
            {error}
          </div>
        )}

        <PayPalButtons
          style={{
            layout: "vertical",
            shape: "pill",
            label: "subscribe",
          }}
          createSubscription={(data, actions) => {
            setError(null);

            return actions.subscription.create({
              plan_id: planId,
              custom_id: userId,
            });
          }}
          onApprove={async (data) => {
            try {
              setLoading(true);

              const res = await fetch("/api/paypal/subscribe", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  subscriptionId: data.subscriptionID,
                  userId,
                }),
              });

              if (!res.ok) {
                throw new Error("Freischaltung fehlgeschlagen");
              }

              window.location.href = "/";
            } catch (err) {
              setError("Fehler bei der Zahlung. Bitte erneut versuchen.");
              setLoading(false);
            }
          }}
          onError={(err) => {
            console.error(err);
            setError("PayPal konnte nicht geladen werden.");
          }}
          onCancel={() => {
            setError("Zahlung wurde abgebrochen.");
          }}
        />
      </div>
    </PayPalScriptProvider>
  );
}