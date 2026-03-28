import { Suspense } from "react";
import HomePageClient from "./HomePageClient";

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#050505] px-4 pb-20 text-white">
          <div className="mx-auto max-w-5xl pt-10">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-center text-sm text-white/70">
              Seite wird geladen ...
            </div>
          </div>
        </main>
      }
    >
      <HomePageClient />
    </Suspense>
  );
}