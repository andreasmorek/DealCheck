"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type AccessResponse = {
  authenticated?: boolean;
  allowed?: boolean;
  plan?: string;
  reason?: string;
};

export default function SuccessClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Zahlung wird bestätigt...");

  useEffect(() => {
    const subscriptionId = searchParams.get("subscription_id");

    if (!subscriptionId) {
      router.replace("/upgrade?paypal=missing_subscription");
      return;
    }

    let stopped = false;
    let attempts = 0;

    const poll = async () => {
      while (!stopped && attempts < 12) {
        attempts += 1;

        try {
          const response = await fetch("/api/check-access", {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          });

          const result = (await response.json().catch(() => null)) as AccessResponse | null;

          if (response.ok && result?.authenticated && result?.plan === "pro" && result?.allowed) {
            router.replace("/?upgraded=1");
            return;
          }
        } catch (error) {
          console.error("SUCCESS POLL ERROR", error);
        }

        setMessage(
          attempts < 4
            ? "Zahlung eingegangen. Freischaltung wird gerade bestätigt..."
            : "PayPal hat bezahlt gemeldet. Der Webhook synchronisiert gerade dein Abo..."
        );

        await new Promise((resolve) => window.setTimeout(resolve, 2500));
      }

      if (!stopped) {
        setMessage(
          "Die Zahlung ist durch. Die automatische Freischaltung dauert gerade noch etwas. Bitte lade die Seite gleich noch einmal neu."
        );
      }
    };

    poll();

    return () => {
      stopped = true;
    };
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
        {message}
      </div>
    </div>
  );
}
