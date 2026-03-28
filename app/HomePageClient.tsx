"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import UploadCard from "@/components/UploadCard";
import ResultCard from "@/components/ResultCard";
import PriceResults from "@/components/PriceResults";

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
  priceRating?: string;
  positives?: string[];
  negatives?: string[];
  confidence?: string;
};

type AccessResponse = {
  allowed: boolean;
  reason?: string;
  plan?: string;
  authenticated?: boolean;
  userId?: string | null;
  usage?: {
    used: number;
    limit: number | null;
    remaining: number | null;
  };
  used?: number;
  limit?: number | null;
  upgradeUrl?: string | null;
  loginUrl?: string | null;
};

type AnalyzeResponse = {
  ok: boolean;
  error?: string;
  authenticated?: boolean;
  allowed?: boolean;
  plan?: string;
  usage?: {
    used: number;
    limit: number | null;
    remaining: number | null;
  };
  result?: AnalyzedProduct;
};

function getReadableErrorMessage(error: unknown) {
  if (!error) return "Analyse fehlgeschlagen.";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return "Analyse fehlgeschlagen.";
}

async function fetchAccess(): Promise<AccessResponse> {
  const response = await fetch("/api/check-access", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.reason || "Zugriff konnte nicht geprüft werden.");
  }

  return data as AccessResponse;
}

export default function HomePageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [product, setProduct] = useState<AnalyzedProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [error, setError] = useState("");
  const [paywall, setPaywall] = useState<AccessResponse | null>(null);
  const [showUpgradeSuccess, setShowUpgradeSuccess] = useState(false);

  useEffect(() => {
    const upgraded = searchParams.get("upgraded") === "1";
    if (!upgraded) return;

    let cancelled = false;

    const runUpgradeRefresh = async () => {
      try {
        setCheckingAccess(true);

        const access = await fetchAccess();
        if (cancelled) return;

        if (access.allowed) {
          setPaywall(null);
        } else {
          setPaywall(access);
        }

        setShowUpgradeSuccess(true);
      } catch (err) {
        console.error("UPGRADE REFRESH ERROR", err);
      } finally {
        if (!cancelled) {
          setCheckingAccess(false);
        }
      }
    };

    runUpgradeRefresh();

    const timer = window.setTimeout(() => {
      if (!cancelled) {
        setShowUpgradeSuccess(false);
        router.replace("/", { scroll: false });
        router.refresh();
      }
    }, 5000);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchParams, router]);

  async function handleAnalyze(file: File) {
    try {
      setLoading(true);
      setError("");
      setProduct(null);
      setPaywall(null);

      const accessData = await fetchAccess();

      if (!accessData.allowed) {
        setPaywall(accessData);
        return;
      }

      const formData = new FormData();
      formData.append("file", file);

      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const analyzeData: AnalyzeResponse = await analyzeRes
        .json()
        .catch(() => ({ ok: false, error: "Ungültige Server-Antwort." }));

      if (!analyzeRes.ok) {
        if (analyzeRes.status === 401 || analyzeRes.status === 403) {
          setPaywall({
            allowed: false,
            reason: analyzeData.error || "Upgrade erforderlich.",
            authenticated: analyzeData.authenticated,
            plan: analyzeData.plan,
            usage: analyzeData.usage,
          });
        }

        throw new Error(analyzeData.error || "Analyse fehlgeschlagen.");
      }

      if (!analyzeData.ok || !analyzeData.result) {
        throw new Error("Es konnte kein Analyseergebnis erzeugt werden.");
      }

      setProduct(analyzeData.result);

      if (analyzeData.usage || analyzeData.plan) {
        setPaywall((prev) =>
          prev
            ? {
                ...prev,
                plan: analyzeData.plan ?? prev.plan,
                usage: analyzeData.usage ?? prev.usage,
              }
            : null
        );
      }
    } catch (err) {
      console.error("ANALYZE FLOW ERROR", err);
      setError(getReadableErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const usageText = useMemo(() => {
    if (!paywall) return "";

    const usageUsed =
      typeof paywall.usage?.used === "number"
        ? paywall.usage.used
        : typeof paywall.used === "number"
          ? paywall.used
          : null;

    const usageLimit =
      typeof paywall.usage?.limit === "number" || paywall.usage?.limit === null
        ? paywall.usage.limit
        : typeof paywall.limit === "number" || paywall.limit === null
          ? paywall.limit
          : null;

    if (usageUsed === null) return "";

    if (typeof usageLimit === "number") {
      return `${usageUsed} von ${usageLimit} Gratis-Checks verbraucht`;
    }

    return `${usageUsed} Checks verbraucht`;
  }, [paywall]);

  return (
    <main className="min-h-screen bg-[#050505] px-4 pb-20 text-white">
      <div className="mx-auto max-w-5xl pt-10">
        {showUpgradeSuccess ? (
          <div className="mb-5 rounded-2xl border border-green-500/30 bg-green-600/20 px-4 py-3 text-sm text-green-300 shadow-[0_10px_30px_rgba(34,197,94,0.12)]">
            ✅ Upgrade erfolgreich! Du bist jetzt freigeschaltet und kannst
            unbegrenzt neue Preischecks starten.
          </div>
        ) : null}

        <UploadCard onUpload={handleAnalyze} />

        {checkingAccess ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-center text-sm text-white/75">
            Zugriff wird aktualisiert ...
          </div>
        ) : null}

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

        {paywall && !paywall.allowed ? (
          <section className="mt-6 overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#1c0909] via-[#130707] to-[#090303] shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
            <div className="border-b border-white/10 bg-gradient-to-r from-[#ff5a1f]/20 via-[#ff7a1a]/10 to-transparent px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-300/80">
                Zugriff begrenzt
              </p>
              <h2 className="mt-2 text-2xl font-black text-white md:text-3xl">
                Mehr Preischecks freischalten
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
                {paywall.reason ||
                  "Dein aktueller Zugriff reicht für weitere Analysen nicht aus."}
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
                  Dein Upgrade wird nach erfolgreicher Zahlung automatisch
                  erkannt und freigeschaltet.
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