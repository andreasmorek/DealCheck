"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import ResultCard from "@/components/ResultCard";
import PriceResults from "@/components/PriceResults";

function ResultContent() {
  const searchParams = useSearchParams();

  const parsed = useMemo(() => {
    const raw = searchParams.get("data");
    if (!raw) return null;

    try {
      return JSON.parse(decodeURIComponent(raw));
    } catch (error) {
      console.error("Fehler beim Parsen der Result-Daten:", error);
      return null;
    }
  }, [searchParams]);

  if (!parsed) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-10 text-white">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-center">
          Keine Ergebnisdaten gefunden.
        </div>
      </main>
    );
  }

  const product = parsed?.analyzed ?? parsed;

  return (
    <main className="min-h-screen px-4 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <ResultCard product={product} />
        <PriceResults product={product} />
      </div>
    </main>
  );
}

export default function ResultPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center px-4 py-10 text-white">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-center">
            Ergebnis wird geladen ...
          </div>
        </main>
      }
    >
      <ResultContent />
    </Suspense>
  );
}