"use client";

import type { Locale } from "@/lib/i18n";

export default function LanguageSwitcher({
  locale,
  overlay = false,
}: {
  locale: Locale;
  overlay?: boolean;
}) {
  function select(nextLocale: Locale) {
    if (nextLocale === locale) return;
    document.cookie = `app_locale=${nextLocale}; Max-Age=31536000; Path=/; SameSite=Lax`;
    window.location.reload();
  }

  return (
    <div
      className={`inline-flex shrink-0 rounded-xl border p-1 backdrop-blur-xl ${overlay ? "border-white/20 bg-[#07131d]/65 shadow-lg" : "border-[var(--app-line)] bg-[var(--app-surface-muted)]"}`}
      role="group"
      aria-label={locale === "uk" ? "Мова" : "Language"}
    >
      <button
        type="button"
        onClick={() => select("en")}
        aria-pressed={locale === "en"}
        className={`min-h-11 min-w-11 rounded-lg px-2 text-sm font-semibold ${locale === "en" ? (overlay ? "bg-white/20 text-white shadow-sm" : "bg-white text-[var(--app-brand)] shadow-sm") : overlay ? "text-white/75" : "text-[var(--app-muted)]"}`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => select("uk")}
        aria-pressed={locale === "uk"}
        className={`min-h-11 min-w-11 rounded-lg px-2 text-sm font-semibold ${locale === "uk" ? (overlay ? "bg-white/20 text-white shadow-sm" : "bg-white text-[var(--app-brand)] shadow-sm") : overlay ? "text-white/75" : "text-[var(--app-muted)]"}`}
      >
        УКР
      </button>
    </div>
  );
}
