"use client";

import { useMemo, useState } from "react";
import UploadCard from "@/components/UploadCard";
import ResultCard from "@/components/ResultCard";
import PriceResults from "@/components/PriceResults";
import { supabaseClient } from "@/lib/supabase/client";

type Recommendation = {
  level: "kaufen" | "beobachten" | "warten";
  text: string;
  reason: string;
};

type AnalyzedProduct = {
  title: string;
  brand?: string;
  model?: string;
  category?: string;
  detectedPrice: number;
  currency: string;
  score?: number;
  summary?: string;
  recommendation?: Recommendation;
};

type AccessResponse = {
  allowed: boolean;
  reason?: string;
  plan?: string;
  used?: number;
  limit?: number | null;
  authenticated?: boolean;
  upgradeUrl?: string | null;
  loginUrl?: string | null;
};

export default function Home() {
  const [product, setProduct] = useState<AnalyzedProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [paywall, setPaywall] = useState<AccessResponse | null>(null);

  async function handleAnalyze(file: File) {
    try {
      setLoading(true);
      setError("");
      setPaywall(null);
      setProduct(null);

      const {
        data: { session },
      } = await supabaseClient.auth.getSession();

      const authHeaders = session?.access_token
        ? {
            Authorization: `Bearer ${session.access_token}`,
          }
        : {};

      const accessRes = await fetch("/api/check-access", {
        method: "GET",
        cache: "no-store",
        headers: authHeaders,
      });

      const accessData: AccessResponse = await accessRes.json();

      if (!accessRes.ok) {
        throw new Error(accessData?.reason || "Zugriff konnte nicht geprüft werden");
      }

      if (!accessData.allowed) {
        setPaywall(accessData);
        return;
      }

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
        headers: authHeaders,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Analyse fehlgeschlagen");
      }

      setProduct(data);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Analyse fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }

  const usageText = useMemo(() => {
    if (!paywall) return "";
    if (typeof paywall.used !== "number") return "";
    if (typeof paywall.limit === "number") {
      return `${paywall.used} von ${paywall.limit} Gratis-Checks verbraucht`;
    }
    return `${paywall.used} Checks verbraucht`;
  }, [paywall]);

  return (
    <main className="min-h-screen bg-[#050505] px-4 pb-20 text-white">
      <div className="mx-auto max-w-5xl pt-10">
        <UploadCard onUpload={handleAnalyze} />

        {loading ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-center text-sm text-white/75">
            Analyse läuft ...
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-4 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        {paywall ? (
          <section className="mt-6 overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#1c0909] via-[#130707] to-[#090303] shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
            <div className="border-b border-white/10 bg-gradient-to-r from-[#ff5a1f]/20 via-[#ff7a1a]/10 to-transparent px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-300/80">
                Zugriff begrenzt
              </p>
              <h2 className="mt-2 text-2xl font-black text-white md:text-3xl">
                Mehr Preischecks freischalten
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
                {paywall.reason || "Dein aktueller Zugriff reicht für weitere Analysen nicht aus."}
              </p>
            </div>

            <div className="grid gap-4 px-6 py-6 md:grid-cols-3">
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                <p className="text-sm text-white/60">Plan</p>
                <p className="mt-2 text-3xl font-black text-white">
                  {(paywall.plan || "free").toUpperCase()}
                </p>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                <p className="text-sm text-white/60">Nutzung</p>
                <p className="mt-2 text-lg font-bold text-white">
                  {usageText || "Kontingent erreicht"}
                </p>
              </div>

              <div className="rounded-[24px] border border-orange-400/20 bg-gradient-to-br from-[#ff5a1f]/20 to-[#ff7a1a]/5 p-5">
                <p className="text-sm text-orange-100/75">Pro-Version</p>
                <p className="mt-2 text-lg font-bold text-white">
                  Mehr Checks, voller Preisvergleich, mehr Conversion
                </p>
              </div>
            </div>

            <div className="px-6 pb-6">
              <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
                <div className="flex flex-col gap-3 md:flex-row">
                  {!paywall.authenticated ? (
                    <a
                      href={paywall.loginUrl || "/login"}
                      className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-bold text-black transition hover:scale-[1.01]"
                    >
                      Einloggen / Registrieren
                    </a>
                  ) : null}

                  <a
                    href={paywall.upgradeUrl || "/upgrade"}
                    className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-[#ff5a1f] to-[#ff7a1a] px-5 py-3 text-sm font-bold text-white transition hover:scale-[1.01]"
                  >
                    Jetzt auf Pro upgraden
                  </a>
                </div>

                <p className="mt-4 text-xs text-white/45">
                  PayPal-Upgrade kann direkt mit deiner bestehenden Paywall verknüpft werden.
                </p>
              </div>
            </div>
          </section>
        ) : null}

        {product ? (
          <>
            <ResultCard product={product} />
            <PriceResults product={product} />
          </>
        ) : null}
      </div>
    </main>
  );
}