"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";
import PayPalSubscribeButton from "@/components/PayPalSubscribeButton";

export default function UpgradePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabaseClient.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUserId(data.session?.user?.id || null);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

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
              <p className="text-sm text-orange-100/75">Pro</p>
              <p className="mt-2 text-3xl font-black">4,99 € / Monat</p>
              <ul className="mt-4 space-y-3 text-sm text-white/85">
                <li>Unbegrenzte Preischecks</li>
                <li>Voller Zugriff auf DealCheck</li>
                <li>Sofortige Freischaltung nach Kauf</li>
              </ul>

              <div className="mt-6">
                {loading ? (
                  <div className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white/70">
                    Sitzung wird geprüft ...
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