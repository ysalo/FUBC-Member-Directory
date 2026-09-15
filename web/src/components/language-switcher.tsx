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
      className="inline-flex shrink-0 rounded-xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-1"
      role="group"
      aria-label={locale === "uk" ? "Мова" : "Language"}
    >
      <button
        type="button"
        onClick={() => select("en")}
        aria-pressed={locale === "en"}
        className={`min-h-11 min-w-11 rounded-lg px-2 text-sm font-semibold ${locale === "en" ? "bg-white text-[var(--app-brand)] shadow-sm" : "text-[var(--app-muted)]"}`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => select("uk")}
        aria-pressed={locale === "uk"}
        className={`min-h-11 min-w-11 rounded-lg px-2 text-sm font-semibold ${locale === "uk" ? "bg-white text-[var(--app-brand)] shadow-sm" : "text-[var(--app-muted)]"}`}
      >
        УКР
      </button>
    </div>
  );
}
