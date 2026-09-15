"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { BookUser, LoaderCircle, ShieldCheck } from "lucide-react";
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
  const [mode, setMode] = useState<"signIn" | "createAccount">("signIn");
  const [error, setError] = useState(
    searchParams.get("error") ? copy.signInFailed : "",
  );
  const appleEnabled = process.env.NEXT_PUBLIC_ENABLE_APPLE_AUTH === "true";
  async function signIn(provider: Provider) {
    if (loading) return;
    setLoading(provider);
    setError("");
    try {
      const next = safeNextPath(searchParams.get("next"));
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const { error: authError } = await createClient().auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (authError) throw authError;
    } catch {
      setLoading(null);
      setError(copy.providerUnavailable);
    }
  }
  return (
    <main className="safe-page grid min-h-dvh place-items-center p-5">
      <section
        aria-labelledby="login-title"
        className="native-enter native-shadow w-full max-w-md rounded-[2rem] border border-[var(--app-line)] bg-[var(--app-surface)] p-5 sm:p-8"
      >
        <div className="flex items-center gap-3">
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--app-brand-soft)] text-[var(--app-brand)]">
            <BookUser
              aria-hidden="true"
              className="size-6"
              strokeWidth={1.75}
            />
          </div>
          <p className="text-sm font-semibold tracking-wide text-[var(--app-brand)]">
            {copy.privateDirectory}
          </p>
        </div>
        <h1
          id="login-title"
          className="mt-7 text-4xl font-bold tracking-[-0.035em] text-[var(--app-ink)]"
        >
          {copy.welcome}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--app-muted)]">
          {mode === "signIn" ? copy.loginHelp : copy.createAccountHelp}
        </p>
        <div
          role="group"
          aria-label={copy.accountAction}
          className="mt-6 grid grid-cols-2 gap-1 rounded-2xl bg-[var(--app-surface-muted)] p-1"
        >
          {(["signIn", "createAccount"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              disabled={loading !== null}
              onClick={() => {
                setMode(value);
                setError("");
              }}
              className={`min-h-12 rounded-xl px-2 py-2 text-sm font-semibold focus-visible:outline-[var(--app-brand)] disabled:opacity-60 ${mode === value ? "bg-[var(--app-surface)] text-[var(--app-brand)] shadow-sm" : "text-[var(--app-muted)] hover:text-[var(--app-ink)]"}`}
            >
              {copy[value]}
            </button>
          ))}
        </div>
        <div className="mt-5 space-y-3">
          <button
            type="button"
            onClick={() => signIn("google")}
            disabled={loading !== null}
            aria-busy={loading === "google"}
            className="flex min-h-13 w-full items-center justify-center gap-3 rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface)] px-4 font-semibold text-[var(--app-ink)] hover:bg-[var(--app-surface-muted)] focus-visible:outline-[var(--app-brand)] disabled:opacity-60"
          >
            {loading === "google" ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-5 animate-spin motion-reduce:animate-none"
              />
            ) : (
              <ProviderIcon provider="google" />
            )}
            {loading === "google" ? copy.openingGoogle : copy.continueGoogle}
          </button>
          {appleEnabled && (
            <button
              type="button"
              onClick={() => signIn("apple")}
              disabled={loading !== null}
              aria-busy={loading === "apple"}
              className="flex min-h-13 w-full items-center justify-center gap-3 rounded-2xl bg-black px-4 font-semibold text-white hover:bg-slate-900 focus-visible:outline-[var(--app-brand)] disabled:opacity-60"
            >
              {loading === "apple" ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="size-5 animate-spin motion-reduce:animate-none"
                />
              ) : (
                <ProviderIcon provider="apple" />
              )}
              {loading === "apple" ? copy.openingApple : copy.continueApple}
            </button>
          )}
        </div>
        <p role="status" className="sr-only">
          {loading === "google"
            ? copy.openingGoogle
            : loading === "apple"
              ? copy.openingApple
              : ""}
        </p>
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
          <ShieldCheck
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-[var(--app-brand)]"
          />
          <div>
            <h2 className="text-sm font-semibold">{copy.approvalRequired}</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--app-muted)]">
              {copy.approvalHelp}
            </p>
          </div>
        </div>
        <p className="mt-4 text-xs leading-5 text-[var(--app-muted)]">
          {copy.noPassword}
        </p>
        <div className="mt-6 border-t border-[var(--app-line)] pt-5">
          <LanguageSwitcher locale={locale} compact />
        </div>
      </section>
    </main>
  );
}
