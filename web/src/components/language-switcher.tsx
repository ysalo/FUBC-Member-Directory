"use client";

import type { Locale } from "@/lib/i18n";

export default function LanguageSwitcher({ locale }: { locale: Locale }) {
  function select(nextLocale: Locale) {
    if (nextLocale === locale) return;
    document.cookie = `app_locale=${nextLocale}; Max-Age=31536000; Path=/; SameSite=Lax`;
    window.location.reload();
  }

  return (
    <div
      className="inline-flex min-h-11 rounded-xl bg-slate-100 p-1"
      role="group"
      aria-label={locale === "uk" ? "Мова" : "Language"}
    >
      <button
        type="button"
        onClick={() => select("en")}
        aria-pressed={locale === "en"}
        className={`min-w-11 rounded-lg px-2 text-sm font-semibold ${locale === "en" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => select("uk")}
        aria-pressed={locale === "uk"}
        className={`min-w-11 rounded-lg px-2 text-sm font-semibold ${locale === "uk" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}
      >
        УКР
      </button>
    </div>
  );
}
