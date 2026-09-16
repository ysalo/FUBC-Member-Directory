"use client";

import { useSearchParams } from "next/navigation";

import { useState } from "react";

import { dictionaries, type Locale } from "@/lib/i18n";
import { safeNextPath } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/browser";

type Provider = "google";
function ProviderIcon({ provider }: { provider: Provider }) {
  return (
    <svg
      aria-hidden="true"
      width="22"
      height="22"
      viewBox="0 0 48 48"
      data-provider={provider}
    >
      <path
        fill="#4285F4"
        d="M43.6 24.5c0-1.5-.1-2.9-.4-4.3H24v8.1h11a9.4 9.4 0 0 1-4.1 6.2v5.2h6.7c3.9-3.6 6-8.9 6-15.2Z"
      />
      <path
        fill="#34A853"
        d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.7-5.2c-1.8 1.2-4.1 1.9-6.8 1.9-5.3 0-9.8-3.6-11.4-8.4H5.7v5.4A20.4 20.4 0 0 0 24 44Z"
      />
      <path
        fill="#FBBC05"
        d="M12.6 27.4a12.2 12.2 0 0 1 0-7.8v-5.4H5.7a20 20 0 0 0 0 18.6l6.9-5.4Z"
      />
      <path
        fill="#EA4335"
        d="M24 11.2c3 0 5.6 1 7.7 3l5.8-5.8A19.4 19.4 0 0 0 24 3 20.4 20.4 0 0 0 5.7 14.2l6.9 5.4C14.2 14.8 18.7 11.2 24 11.2Z"
      />
    </svg>
  );
}

export default function LoginClient({ locale }: { locale: Locale }) {
  const copy = dictionaries[locale];
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<Provider | null>(null);
  const [error, setError] = useState(
    searchParams.get("error") ? copy.signInFailed : "",
  );
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
    <main className="login-page">
      <section
        className="login-card native-enter"
        aria-label={locale === "uk" ? "Вхід" : "Login"}
      >
        <div className="login-art" aria-hidden="true">
          <svg className="login-contours" viewBox="0 0 1440 1000" preserveAspectRatio="xMidYMin slice">
            <defs>
              <pattern id="login-contour-pattern" width="480" height="320" patternUnits="userSpaceOnUse" patternTransform="rotate(-18)">
                <g fill="none" stroke="currentColor" strokeWidth="1">
                  <path d="M0 40C80-60 160-60 240 40S400 140 480 40" />
                  <path d="M0 60C80-40 160-40 240 60S400 160 480 60" />
                  <path d="M0 80C80-20 160-20 240 80S400 180 480 80" />
                  <path d="M0 100C80 0 160 0 240 100S400 200 480 100" />
                  <path d="M0 120C80 20 160 20 240 120S400 220 480 120" />
                  <path d="M0 140C80 40 160 40 240 140S400 240 480 140" />
                  <path d="M0 160C80 60 160 60 240 160S400 260 480 160" />
                  <path d="M0 180C80 80 160 80 240 180S400 280 480 180" />
                </g>
              </pattern>
            </defs>
            <rect width="1440" height="1000" fill="url(#login-contour-pattern)" />
          </svg>
        </div>
        <div className="login-actions">
          <h1 className="login-title">FIBC<span>{locale === "uk" ? "Довідник членів церкви" : "Member Directory"}</span></h1>
          <button
            type="button"
            onClick={() => signIn("google")}
            disabled={loading !== null}
            aria-busy={loading === "google"}
            className="login-google"
          >
            <ProviderIcon provider="google" />
            {loading === "google" ? copy.openingGoogle : copy.continueGoogle}
          </button>
          <p role="status" className="sr-only">{loading === "google" ? copy.openingGoogle : ""}</p>
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
