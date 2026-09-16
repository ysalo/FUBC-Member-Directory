"use client";

import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { useState } from "react";
import LanguageSwitcher from "@/components/language-switcher";
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
    <main className="login-page">
      <div className="login-language">
        <LanguageSwitcher locale={locale} />
      </div>
      <section
        className="login-card native-enter"
        aria-label={locale === "uk" ? "Вхід" : "Login"}
      >
        <div className="login-art" aria-hidden="true">
          <span className="login-blob login-blob-one" />
          <span className="login-blob login-blob-two" />
          <span className="login-dot login-dot-one" />
          <span className="login-dot login-dot-two" />
          <span className="login-dot login-dot-three" />
          <Image
            className="login-logo"
            src="/church-logo.jpg"
            alt=""
            width={900}
            height={900}
            priority
          />
          <svg
            className="login-wave"
            viewBox="0 0 400 80"
            preserveAspectRatio="none"
          >
            <path
              d="M0 45C75 0 115 12 180 40S310 85 400 36V80H0Z"
              fill="currentColor"
            />
          </svg>
        </div>
        <div className="login-actions">
          <button
            onClick={() => signIn("google")}
            disabled={loading !== null}
            className="login-google"
          >
            <ProviderIcon provider="google" />
            {loading === "google" ? copy.openingGoogle : copy.continueGoogle}
          </button>
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
