"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PayPalSubscribeButton from "@/components/PayPalSubscribeButton";

type AccessResponse = {
  authenticated?: boolean;
  plan?: string;
};

export default function UpgradePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function init() {
      try {
        setLoading(true);
        setCheckingAccess(true);
        setError(null);

        const supabase = createClient();

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (!active) return;

        if (sessionError) {
          console.error("UPGRADE SESSION ERROR", sessionError);
          setError("Sitzung konnte nicht geladen werden.");
          setLoading(false);
          setCheckingAccess(false);
          return;
        }

        const currentUserId = session?.user?.id ?? null;
        setUserId(currentUserId);

        if (!session) {
          setLoading(false);
          setCheckingAccess(false);
          return;
        }

        const res = await fetch("/api/check-access", {
          method: "GET",
          cache: "no-store",
        });

        const accessData: AccessResponse = await res.json();

        if (!active) return;

        if (
          res.ok &&
          accessData.authenticated &&
          accessData.plan === "premium"
        ) {
          window.location.href = "/?upgraded=1";
          return;
        }

        setLoading(false);
        setCheckingAccess(false);
      } catch (err) {
        console.error("UPGRADE INIT ERROR", err);
        if (!active) return;
        setError("Upgrade-Status konnte nicht geprüft werden.");
        setLoading(false);
        setCheckingAccess(false);
      }
    }

    init();

    return () => {
      active = false;
    };
  }, []);

  if (loading || checkingAccess) {
    return (
      <main className="min-h-screen bg-[#050505] px-4 py-10 text-white">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-[32px] border border-white/10 bg-white/5 px-6 py-8 text-center text-sm text-white/70">
            Upgrade-Status wird geprüft ...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] px-4 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-[#1c0909] via-[#130707] to-[#090303] shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
          <div className="border-b border-white/10 bg-gradient-to-r from-[#ff5a1f]/20 via-[#ff7a1a]/10 to-transparent px-6 py-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-300/80">
              DealCheck Pro
            </p>
            <h1 className="mt-2 text-3xl font-black md:text-4xl">
              Mehr Preischecks freischalten
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
              Unbegrenzte Checks, sauberer Preisvergleich und direkte
              Freischaltung nach erfolgreicher Zahlung.
            </p>
          </div>

          <div className="grid gap-5 px-6 py-6 md:grid-cols-2">
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-6">
              <p className="text-sm text-white/60">Free</p>
              <p className="mt-2 text-3xl font-black">0 €</p>
              <ul className="mt-4 space-y-3 text-sm text-white/75">
                <li>3 Preischecks gratis</li>
                <li>Login per Magic Link</li>
                <li>Ideal zum Testen</li>
              </ul>
            </div>

            <div className="rounded-[24px] border border-orange-400/20 bg-gradient-to-br from-[#ff5a1f]/20 to-[#ff7a1a]/5 p-6">
              <p className="text-sm text-orange-100/75">Premium</p>
              <p className="mt-2 text-3xl font-black">3,99 € / Monat</p>
              <ul className="mt-4 space-y-3 text-sm text-white/85">
                <li>Unbegrenzte Preischecks</li>
                <li>Voller Zugriff auf DealCheck</li>
                <li>Sofortige Freischaltung nach Kauf</li>
              </ul>

              <div className="mt-6">
                {error ? (
                  <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    {error}
                  </div>
                ) : userId ? (
                  <PayPalSubscribeButton userId={userId} />
                ) : (
                  <a
                    href="/login"
                    className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-bold text-black transition hover:scale-[1.01]"
                  >
                    Bitte zuerst einloggen
                  </a>
                )}
              </div>

              <p className="mt-4 text-xs leading-5 text-white/50">
                Das Upgrade wird deinem Benutzerkonto direkt zugeordnet.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}