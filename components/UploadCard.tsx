"use client";

import { useRef, useState } from "react";

type UploadCardProps = {
  onUpload: (file: File) => Promise<void> | void;
};

export default function UploadCard({ onUpload }: UploadCardProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleFileChange(file: File) {
    try {
      setError("");
      setIsLoading(true);
      await onUpload(file);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Etwas ist schiefgelaufen. Bitte erneut versuchen.";

      setError(message);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-[#2b0f0f] via-[#180808] to-[#090303] shadow-[0_20px_100px_rgba(0,0,0,0.55)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,90,31,0.22),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(255,122,26,0.12),transparent_28%)]" />

      <div className="relative px-6 py-8 md:px-8 md:py-10">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center rounded-full border border-orange-400/30 bg-orange-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-orange-200">
            Screenshot rein • Preischeck raus
          </div>

          <h1 className="mt-5 text-4xl font-black leading-tight text-white md:text-6xl">
            Ist das ein
            <span className="bg-gradient-to-r from-[#ff5a1f] to-[#ffb347] bg-clip-text text-transparent">
              {" "}echter Deal
            </span>
            {" "}oder zahlst du zu viel?
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/70 md:text-base">
            Lade einfach einen Produkt-Screenshot hoch. Wir erkennen Preis und Produktdaten
            und zeigen dir sofort, ob sich das Angebot lohnt.
          </p>
        </div>

        <div className="mx-auto mt-8 max-w-4xl">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isLoading}
            className="group flex min-h-[240px] w-full flex-col items-center justify-center rounded-[28px] border border-dashed border-orange-400/35 bg-gradient-to-br from-[#ff5a1f]/10 to-[#ff7a1a]/5 px-6 py-10 text-center transition duration-200 hover:scale-[1.01] hover:border-orange-300/60 hover:bg-[#ff5a1f]/10 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <div className="rounded-full bg-gradient-to-r from-[#ff5a1f] to-[#ff7a1a] px-5 py-2 text-sm font-bold text-white shadow-lg">
              {isLoading ? "Analyse läuft ..." : "Screenshot hochladen"}
            </div>

            <div className="mt-5 text-2xl font-bold text-white md:text-3xl">
              {isLoading ? "Bitte kurz warten" : "Preis in Sekunden prüfen"}
            </div>

            <div className="mt-3 text-sm text-white/65 md:text-base">
              Amazon, Otto, MediaMarkt, Zalando, eBay oder fast jeder andere Shop
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-white/50">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                Screenshot
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                Deal-Check
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                Sparpotenzial
              </span>
            </div>
          </button>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                void handleFileChange(file);
                e.currentTarget.value = "";
              }
            }}
          />

          {error ? (
            <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}