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
          <svg
            className="login-contours"
            viewBox="0 0 1440 1000"
            preserveAspectRatio="xMidYMin slice"
          >
            <g fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M-180 -100C120 -300 300 100 600 -65S1100 -280 1620 -90" />
              <path d="M-180 -70C120 -270 300 130 600 -35S1100 -250 1620 -60" />
              <path d="M-180 -40C120 -240 300 160 600 -5S1100 -220 1620 -30" />
              <path d="M-180 -10C120 -210 300 190 600 25S1100 -190 1620 0" />
              <path d="M-180 20C120 -180 300 220 600 55S1100 -160 1620 30" />
              <path d="M-180 50C120 -150 300 250 600 85S1100 -130 1620 60" />
              <path d="M-180 80C120 -120 300 280 600 115S1100 -100 1620 90" />
              <path d="M-180 110C120 -90 300 310 600 145S1100 -70 1620 120" />
              <path d="M-180 140C120 -60 300 340 600 175S1100 -40 1620 150" />
              <path d="M-180 170C120 -30 300 370 600 205S1100 -10 1620 180" />
              <path d="M-180 200C120 0 300 400 600 235S1100 20 1620 210" />
              <path d="M-180 230C120 30 300 430 600 265S1100 50 1620 240" />
              <path d="M-180 260C120 60 300 460 600 295S1100 80 1620 270" />
              <path d="M-180 290C120 90 300 490 600 325S1100 110 1620 300" />
              <path d="M-180 320C120 120 300 520 600 355S1100 140 1620 330" />
              <path d="M-180 350C120 150 300 550 600 385S1100 170 1620 360" />
              <path d="M-180 380C120 180 300 580 600 415S1100 200 1620 390" />
              <path d="M-180 410C120 210 300 610 600 445S1100 230 1620 420" />
              <path d="M-180 440C120 240 300 640 600 475S1100 260 1620 450" />
              <path d="M-180 470C120 270 300 670 600 505S1100 290 1620 480" />
              <path d="M-180 500C120 300 300 700 600 535S1100 320 1620 510" />
              <path d="M-180 530C120 330 300 730 600 565S1100 350 1620 540" />
              <path d="M-180 560C120 360 300 760 600 595S1100 380 1620 570" />
              <path d="M-180 590C120 390 300 790 600 625S1100 410 1620 600" />
              <path d="M-180 620C120 420 300 820 600 655S1100 440 1620 630" />
              <path d="M-180 650C120 450 300 850 600 685S1100 470 1620 660" />
              <path d="M-180 680C120 480 300 880 600 715S1100 500 1620 690" />
              <path d="M-180 710C120 510 300 910 600 745S1100 530 1620 720" />
              <path d="M-180 740C120 540 300 940 600 775S1100 560 1620 750" />
              <path d="M-180 770C120 570 300 970 600 805S1100 590 1620 780" />
              <path d="M-180 800C120 600 300 1000 600 835S1100 620 1620 810" />
              <path d="M-180 830C120 630 300 1030 600 865S1100 650 1620 840" />
              <path d="M-180 860C120 660 300 1060 600 895S1100 680 1620 870" />
              <path d="M-180 890C120 690 300 1090 600 925S1100 710 1620 900" />
              <path d="M-180 920C120 720 300 1120 600 955S1100 740 1620 930" />
              <path d="M-180 950C120 750 300 1150 600 985S1100 770 1620 960" />
              <path d="M-180 980C120 780 300 1180 600 1015S1100 800 1620 990" />
              <path d="M-180 1010C120 810 300 1210 600 1045S1100 830 1620 1020" />
              <path d="M-180 1040C120 840 300 1240 600 1075S1100 860 1620 1050" />
              <path d="M-180 1070C120 870 300 1270 600 1105S1100 890 1620 1080" />
              <path d="M-180 1100C120 900 300 1300 600 1135S1100 920 1620 1110" />
            </g>
          </svg>
        </div>
        <div className="login-actions">
          <h1 className="login-title">
            FUBC
            <span>
              {locale === "uk" ? "Довідник членів церкви" : "Member Directory"}
            </span>
          </h1>
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
          <p role="status" className="sr-only">
            {loading === "google" ? copy.openingGoogle : ""}
          </p>
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
