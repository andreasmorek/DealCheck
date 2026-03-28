"use client";

import { useEffect, useMemo, useState } from "react";
import DealBadge from "./DealBadge";

type Product = {
  title: string;
  brand?: string;
  model?: string;
  category?: string;
  detectedPrice: number;
  currency: string;
  recommendation?: {
    level: "kaufen" | "beobachten" | "warten";
    text: string;
    reason: string;
  };
};

type PriceItem = {
  title: string;
  price: number;
  shop: string;
  link: string;
  image?: string;
};

type PriceApiResponse = {
  ok?: boolean;
  results?: PriceItem[];
  error?: string;
};

type PriceResultsProps = {
  product: Product;
};

function formatPrice(value: number, currency = "EUR") {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
  }).format(value);
}

function getRating(detectedPrice: number, cheapestPrice: number): "good" | "fair" | "expensive" {
  if (!cheapestPrice || !detectedPrice) return "fair";

  const diffPercent = ((detectedPrice - cheapestPrice) / cheapestPrice) * 100;

  if (diffPercent <= 5) return "good";
  if (diffPercent <= 15) return "fair";
  return "expensive";
}

export default function PriceResults({ product }: PriceResultsProps) {
  const [prices, setPrices] = useState<PriceItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const query = useMemo(() => {
    return [product.brand, product.model, product.title].filter(Boolean).join(" ");
  }, [product.brand, product.model, product.title]);

  useEffect(() => {
    let isCancelled = false;

    async function fetchPrices() {
      try {
        setIsLoading(true);
        setError("");
        setPrices([]);

        const res = await fetch(`/api/prices?query=${encodeURIComponent(query)}`);
        const data: PriceApiResponse = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || "Preisvergleich fehlgeschlagen");
        }

        if (!isCancelled) {
          const results = Array.isArray(data.results) ? data.results : [];
          const sorted = [...results].sort((a, b) => a.price - b.price);
          setPrices(sorted);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Preise konnten nicht geladen werden"
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    if (query) {
      void fetchPrices();
    }

    return () => {
      isCancelled = true;
    };
  }, [query]);

  const cheapestPrice = prices[0]?.price ?? 0;
  const highestPrice = prices.length > 0 ? prices[prices.length - 1]?.price ?? 0 : 0;
  const savings = cheapestPrice > 0 ? Math.max(product.detectedPrice - cheapestPrice, 0) : 0;
  const rating = getRating(product.detectedPrice, cheapestPrice);

  return (
    <section className="mt-6 overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#120707] via-[#1d0b0b] to-[#080303] shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
      <div className="border-b border-white/10 bg-gradient-to-r from-[#ff5a1f]/20 via-[#ff7a1a]/10 to-transparent px-6 py-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-300/80">
              Preisvergleich
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">
              So steht dein Preis im Markt
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
              Wir vergleichen den erkannten Screenshot-Preis mit verfügbaren Treffern aus externen Quellen.
            </p>
          </div>

          <div className="shrink-0">
            <DealBadge rating={rating} />
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        {isLoading ? (
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 text-sm text-white/70">
            Preisvergleich wird geladen...
          </div>
        ) : null}

        {error ? (
          <div className="rounded-[24px] border border-rose-400/30 bg-rose-500/10 p-5 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        {!isLoading && !error && prices.length > 0 ? (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-[24px] border border-orange-400/20 bg-gradient-to-br from-[#ff5a1f]/20 to-[#ff7a1a]/5 p-5">
                <p className="text-sm text-orange-100/75">Dein Screenshot</p>
                <p className="mt-2 text-3xl font-black text-white">
                  {formatPrice(product.detectedPrice, product.currency || "EUR")}
                </p>
              </div>

              <div className="rounded-[24px] border border-emerald-400/20 bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 p-5">
                <p className="text-sm text-emerald-100/75">Günstigster Treffer</p>
                <p className="mt-2 text-3xl font-black text-white">
                  {formatPrice(cheapestPrice, product.currency || "EUR")}
                </p>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                <p className="text-sm text-white/65">Sparpotenzial</p>
                <p className="mt-2 text-3xl font-black text-white">
                  {formatPrice(savings, product.currency || "EUR")}
                </p>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                <p className="text-sm text-white/65">Preisspanne</p>
                <p className="mt-2 text-2xl font-black text-white">
                  {formatPrice(cheapestPrice, product.currency || "EUR")} –{" "}
                  {formatPrice(highestPrice, product.currency || "EUR")}
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {prices.map((item, index) => {
                const delta = product.detectedPrice - item.price;
                const isBest = index === 0;

                return (
                  <div
                    key={`${item.shop}-${item.link}-${index}`}
                    className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 transition hover:bg-white/[0.07]"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                            {item.shop}
                          </span>
                          {isBest ? (
                            <span className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                              Bester Preis
                            </span>
                          ) : null}
                        </div>

                        <p className="mt-3 text-base font-semibold leading-7 text-white">
                          {item.title}
                        </p>

                        <p className="mt-2 text-sm text-white/55">
                          {delta > 0
                            ? `Du zahlst hier ${formatPrice(delta, product.currency || "EUR")} weniger als im Screenshot.`
                            : delta < 0
                            ? `Dieser Treffer liegt ${formatPrice(Math.abs(delta), product.currency || "EUR")} über deinem Screenshot.`
                            : "Preis identisch mit deinem Screenshot."}
                        </p>
                      </div>

                      <div className="shrink-0 text-left md:text-right">
                        <p className={`text-2xl font-black ${isBest ? "text-emerald-300" : "text-white"}`}>
                          {formatPrice(item.price, product.currency || "EUR")}
                        </p>
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex rounded-2xl bg-gradient-to-r from-[#ff5a1f] to-[#ff7a1a] px-4 py-2.5 text-sm font-bold text-white transition hover:scale-[1.02]"
                        >
                          Zum Angebot
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}

        {!isLoading && !error && prices.length === 0 ? (
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-white/70">
              Noch keine passenden Marktpreise gefunden. Das Layout ist aber bereit, sobald deine `/api/prices` Treffer liefert.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}