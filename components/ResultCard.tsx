"use client";

import DealBadge from "./DealBadge";

type Recommendation = {
  level: "kaufen" | "beobachten" | "warten";
  text: string;
  reason: string;
};

type ResultCardProps = {
  product: {
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
};

function formatPrice(value: number, currency = "EUR") {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: currency || "EUR",
  }).format(value || 0);
}

function getRating(level?: Recommendation["level"]): "good" | "fair" | "expensive" {
  if (level === "kaufen") return "good";
  if (level === "beobachten") return "fair";
  return "expensive";
}

export default function ResultCard({ product }: ResultCardProps) {
  const recommendation = product.recommendation;
  const rating = getRating(recommendation?.level);

  return (
    <section className="mt-6 overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#1a0808] via-[#261010] to-[#120707] shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
      <div className="border-b border-white/10 bg-gradient-to-r from-[#ff5a1f]/20 via-[#ff7a1a]/10 to-transparent px-6 py-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-300/80">
              Deal-Check Ergebnis
            </p>
            <h2 className="mt-2 text-2xl font-bold leading-tight text-white md:text-3xl">
              {product.title || "Erkanntes Produkt"}
            </h2>

            {(product.brand || product.model || product.category) && (
              <div className="mt-3 flex flex-wrap gap-2 text-sm text-white/70">
                {product.brand ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    Marke: {product.brand}
                  </span>
                ) : null}
                {product.model ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    Modell: {product.model}
                  </span>
                ) : null}
                {product.category ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    Kategorie: {product.category}
                  </span>
                ) : null}
              </div>
            )}
          </div>

          <div className="shrink-0">
            <DealBadge
              rating={rating}
              recommendationText={recommendation?.text}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 px-6 py-6 md:grid-cols-3">
        <div className="rounded-[24px] border border-orange-400/20 bg-gradient-to-br from-[#ff5a1f]/20 to-[#ff7a1a]/5 p-5">
          <p className="text-sm font-medium text-orange-200/80">
            Erkannter Preis
          </p>
          <p className="mt-2 text-3xl font-black tracking-tight text-white md:text-4xl">
            {formatPrice(product.detectedPrice, product.currency)}
          </p>
          <p className="mt-2 text-xs text-orange-100/70">
            Direkt aus dem Screenshot erkannt
          </p>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
          <p className="text-sm font-medium text-white/70">KI-Score</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-white md:text-4xl">
            {typeof product.score === "number" ? product.score : 0}
            <span className="ml-1 text-lg font-semibold text-white/50">/100</span>
          </p>
          <p className="mt-2 text-xs text-white/55">
            Bewertung auf Basis der erkannten Daten
          </p>
        </div>

        <div className="rounded-[24px] border border-rose-400/20 bg-gradient-to-br from-[#3a1016] to-[#1a0a0d] p-5">
          <p className="text-sm font-medium text-rose-200/80">Einschätzung</p>
          <p className="mt-2 text-2xl font-bold text-white">
            {recommendation?.text || "Noch keine Einschätzung"}
          </p>
          <p className="mt-2 text-sm leading-6 text-white/70">
            {recommendation?.reason || "Noch keine Begründung vorhanden."}
          </p>
        </div>
      </div>

      {product.summary ? (
        <div className="px-6 pb-6">
          <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
              Kurzfazit
            </p>
            <p className="mt-3 text-base leading-7 text-white/85">
              {product.summary}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}