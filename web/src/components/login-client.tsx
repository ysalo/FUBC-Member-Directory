"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import LanguageSwitcher from "@/components/language-switcher";
import { dictionaries, type Locale } from "@/lib/i18n";
import { safeNextPath } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/browser";

type Provider = "google" | "apple";
function ProviderIcon({ provider }: { provider: Provider }) {
  return provider === "google" ? (
    <span aria-hidden className="text-lg font-bold text-blue-600">
      G
    </span>
  ) : (
    <span aria-hidden className="text-xl">
      ●
    </span>
  );
}

export default function LoginClient({ locale }: { locale: Locale }) {
  const copy = dictionaries[locale];
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<Provider | null>(null);
  const [error, setError] = useState(
    searchParams.get("error") ? copy.signInFailed : "",
  );
  const appleEnabled = process.env.NEXT_PUBLIC_ENABLE_APPLE_AUTH === "true";
  async function signIn(provider: Provider) {
    setLoading(provider);
    setError("");
    const next = safeNextPath(searchParams.get("next"));
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error: authError } = await createClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (authError) {
      setLoading(null);
      setError(copy.providerUnavailable);
    }
  }
  return (
    <main className="safe-page grid min-h-dvh place-items-center p-5">
      <section className="native-enter native-shadow w-full max-w-sm rounded-[2rem] border border-white/80 bg-white/95 p-7 backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div className="grid size-12 place-items-center rounded-2xl bg-[var(--app-brand)] text-xl font-bold text-white shadow-sm">
            PD
          </div>
          <LanguageSwitcher locale={locale} />
        </div>
        <p className="mt-6 text-sm font-semibold text-[var(--app-accent)]">
          {copy.privateDirectory}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-[-0.025em] text-[var(--app-ink)]">
          {copy.welcome}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--app-muted)]">
          {copy.loginHelp}
        </p>
        <div className="mt-7 space-y-3">
          <button
            onClick={() => signIn("google")}
            disabled={loading !== null}
            className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          >
            <ProviderIcon provider="google" />
            {loading === "google" ? copy.openingGoogle : copy.continueGoogle}
          </button>
          {appleEnabled && (
            <button
              onClick={() => signIn("apple")}
              disabled={loading !== null}
              className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-black px-4 font-semibold text-white hover:bg-slate-900 disabled:opacity-60"
            >
              <ProviderIcon provider="apple" />
              {loading === "apple" ? copy.openingApple : copy.continueApple}
            </button>
          )}
        </div>
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        <p className="mt-6 text-xs leading-5 text-slate-400">
          {copy.noPassword}
        </p>
      </section>
    </main>
  );
}
