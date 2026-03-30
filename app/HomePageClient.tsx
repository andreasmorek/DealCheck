"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
  const [sessionLoading, setSessionLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState("");
  const [paywall, setPaywall] = useState<AccessResponse | null>(null);
  const [showUpgradeSuccess, setShowUpgradeSuccess] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        setSessionLoading(true);

        const supabase = createClient();
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (!active) return;

        if (sessionError) {
          console.error("HOME SESSION ERROR", sessionError);
          setIsLoggedIn(false);
          return;
        }

        setIsLoggedIn(!!session);
      } catch (err) {
        console.error("HOME SESSION LOAD ERROR", err);
        if (!active) return;
        setIsLoggedIn(false);
      } finally {
        if (active) {
          setSessionLoading(false);
        }
      }
    }

    loadSession();

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
      setSessionLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

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

      if (!accessData.authenticated) {
        setPaywall(accessData);
        setError("Bitte logge dich ein, um einen Preischeck zu starten.");
        router.push(accessData.loginUrl || "/login");
        return;
      }

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

        {sessionLoading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-center text-sm text-white/75">
            Login-Status wird geladen ...
          </div>
        ) : isLoggedIn ? (
          <UploadCard onUpload={handleAnalyze} />
        ) : (
          <section className="overflow-hidden rounded-[32px] border border-[#ff5a1f]/20 bg-gradient-to-br from-[#240905] via-[#120403] to-[#070202] shadow-[0_30px_120px_rgba(255,90,31,0.14)]">
            <div className="px-6 pb-6 pt-8 md:px-10 md:pb-8 md:pt-10">
              <div className="mx-auto flex max-w-fit items-center justify-center rounded-full border border-[#ff8a3d]/30 bg-[#ff7a1a]/10 px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#ffd2b0]">
                Screenshot rein • Preischeck raus
              </div>

              <div className="mx-auto mt-6 max-w-4xl text-center">
                <h1 className="text-4xl font-black leading-tight text-white md:text-6xl md:leading-[1.05]">
                  Ist das ein{" "}
                  <span className="bg-gradient-to-r from-[#ff5a1f] to-[#ffb347] bg-clip-text text-transparent">
                    echter Deal
                  </span>
                  <br className="hidden md:block" /> oder zahlst du zu viel?
                </h1>

                <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-white/72 md:text-[28px] md:leading-10">
                  Logge dich kurz ein und prüfe dann sofort mit deinem
                  Produkt-Screenshot, ob sich das Angebot wirklich lohnt.
                </p>
              </div>
            </div>

            <div className="border-t border-[#ff8a3d]/15 bg-black/25 px-6 py-6 md:px-10 md:py-8">
              <div className="grid gap-5 md:grid-cols-3">
                <div className="rounded-[28px] border border-[#ff8a3d]/15 bg-gradient-to-br from-[#1a0a05] to-[#0d0503] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                  <p className="text-sm text-white/60">Free</p>
                  <p className="mt-3 text-5xl font-black text-white">0 €</p>
                  <p className="mt-3 text-base leading-7 text-white/72">
                    3 Preischecks gratis zum Testen.
                  </p>
                </div>

                <div className="rounded-[28px] border border-[#ff8a3d]/15 bg-gradient-to-br from-[#1a0a05] to-[#0d0503] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                  <p className="text-sm text-white/60">Login</p>
                  <p className="mt-3 text-2xl font-black text-white">
                    Magic Link per E-Mail
                  </p>
                  <p className="mt-3 text-base leading-7 text-white/72">
                    Schnell einloggen und direkt wieder zurück zum Upload.
                  </p>
                </div>

                <div className="rounded-[28px] border border-[#ff8a3d]/25 bg-gradient-to-br from-[#3a1308] to-[#1a0804] p-6 shadow-[0_20px_60px_rgba(255,90,31,0.10)]">
                  <p className="text-sm text-orange-100/75">Pro</p>
                  <p className="mt-3 text-2xl font-black text-white">
                    Unbegrenzte Preischecks
                  </p>
                  <p className="mt-3 text-base leading-7 text-white/78">
                    Sauber am Benutzerkonto verknüpft.
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-[28px] border border-[#ff8a3d]/15 bg-gradient-to-r from-black/35 to-black/20 p-6 md:p-8">
                <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-3xl font-black text-white md:text-4xl">
                      Erst einloggen, dann Screenshot hochladen
                    </h2>
                    <p className="mt-3 max-w-2xl text-base leading-7 text-white/68">
                      Damit wir deine Preischecks, dein Free-Limit und ein
                      mögliches Pro-Upgrade sauber deinem Konto zuordnen können.
                    </p>
                  </div>

                  <a
                    href="/login"
                    className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-[#ff5a1f] to-[#ff7a1a] px-6 py-3 text-sm font-bold text-white shadow-[0_12px_40px_rgba(255,90,31,0.35)] transition hover:scale-[1.02]"
                  >
                    Mit E-Mail einloggen
                  </a>
                </div>

                <p className="mt-4 text-xs text-white/50">
                  Kostenlos starten • keine Verpflichtung • 3 Checks gratis
                </p>
              </div>
            </div>
          </section>
        )}

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