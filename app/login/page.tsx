"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function getReadableErrorMessage(error: unknown): string {
  if (!error) return "Login konnte nicht gestartet werden.";

  if (typeof error === "string") {
    const lower = error.toLowerCase();

    if (lower.includes("email rate limit exceeded")) {
      return "Es wurden gerade zu viele Magic-Links angefordert. Bitte warte kurz und versuche es dann erneut.";
    }

    return error;
  }

  if (error instanceof Error) {
    const message = error.message || "Login konnte nicht gestartet werden.";
    const lower = message.toLowerCase();

    if (lower.includes("email rate limit exceeded")) {
      return "Es wurden gerade zu viele Magic-Links angefordert. Bitte warte kurz und versuche es dann erneut.";
    }

    return message;
  }

  if (typeof error === "object" && error !== null) {
    const maybeMessage =
      "message" in error &&
      typeof (error as { message?: unknown }).message === "string"
        ? (error as { message: string }).message
        : "";

    if (maybeMessage) {
      const lower = maybeMessage.toLowerCase();

      if (lower.includes("email rate limit exceeded")) {
        return "Es wurden gerade zu viele Magic-Links angefordert. Bitte warte kurz und versuche es dann erneut.";
      }

      return maybeMessage;
    }
  }

  return "Login konnte nicht gestartet werden.";
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const trimmedEmail = useMemo(() => email.trim(), [email]);
  const isEmailValid = /\S+@\S+\.\S+/.test(trimmedEmail);

  async function handleMagicLinkLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (loading) return;

    setError("");
    setSuccess("");

    if (!trimmedEmail) {
      setError("Bitte gib deine E-Mail-Adresse ein.");
      return;
    }

    if (!isEmailValid) {
      setError("Bitte gib eine gültige E-Mail-Adresse ein.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const baseUrl =
        typeof window !== "undefined" ? window.location.origin : "";

      const { error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          emailRedirectTo: `${baseUrl}/auth/callback?next=/`,
        },
      });

      if (error) {
        throw error;
      }

      setSuccess(
        "Der Magic Link wurde verschickt. Bitte prüfe jetzt dein E-Mail-Postfach und klicke auf den Anmelde-Link."
      );
      setEmail("");
    } catch (err) {
      setError(getReadableErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050505] px-4 py-10 text-white">
      <div className="mx-auto max-w-md">
        <div className="overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-[#1f0b0b] via-[#130707] to-[#090303] shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
          <div className="border-b border-white/10 bg-gradient-to-r from-[#ff5a1f]/20 via-[#ff7a1a]/10 to-transparent px-6 py-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-300/80">
              Login
            </p>
            <h1 className="mt-2 text-3xl font-black text-white">
              Preischecks freischalten
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/70">
              Logge dich mit deiner E-Mail ein und starte deine Gratis-Checks.
            </p>
          </div>

          <div className="px-6 py-6">
            <form onSubmit={handleMagicLinkLogin} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-white/80"
                >
                  E-Mail-Adresse
                </label>

                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="name@beispiel.de"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-white/35 focus:border-orange-400/40 disabled:cursor-not-allowed disabled:opacity-70"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !trimmedEmail}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#ff5a1f] to-[#ff7a1a] px-5 py-3 text-sm font-bold text-white transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Link wird gesendet ..." : "Magic Link senden"}
              </button>
            </form>

            {error ? (
              <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm leading-6 text-rose-200">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm leading-6 text-emerald-200">
                {success}
              </div>
            ) : null}

            <div className="mt-6 text-sm text-white/50">
              <Link href="/" className="transition hover:text-white">
                ← Zurück zum Deal Check
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}