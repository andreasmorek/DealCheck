import { Suspense } from "react";
import SuccessClient from "./SuccessClient";

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white">
            Zahlung wird verarbeitet...
          </div>
        </div>
      }
    >
      <SuccessClient />
    </Suspense>
  );
}