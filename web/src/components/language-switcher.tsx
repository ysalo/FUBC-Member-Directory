"use client";

import type { Locale } from "@/lib/i18n";

export default function LanguageSwitcher({ locale, variant = "labels" }: { locale: Locale; variant?: "labels" | "flags" }) {
  function select(nextLocale: Locale) {
    if (nextLocale === locale) return;
    document.cookie = `app_locale=${nextLocale}; Max-Age=31536000; Path=/; SameSite=Lax`;
    window.location.reload();
  }

  return (
    <div
      className={`inline-flex shrink-0 bg-[var(--app-surface-muted)] ${variant === "flags" ? "gap-1 rounded-lg p-0.5" : "rounded-xl p-1"}`}
      role="group"
      aria-label={locale === "uk" ? "Мова" : "Language"}
    >
      <button
        type="button"
        onClick={() => select("en")}
        aria-pressed={locale === "en"}
        aria-label={variant === "flags" ? "English" : undefined}
        title={variant === "flags" ? "English" : undefined}
        className={`${variant === "flags" ? "grid size-8 place-items-center rounded-md" : "min-h-11 min-w-11 rounded-lg px-2 text-sm font-semibold"} ${locale === "en" ? "bg-[var(--app-surface)] text-[var(--app-ink)] shadow-sm" : "text-[var(--app-muted)]"}`}
      >
        {variant === "flags" ? <svg aria-hidden="true" viewBox="0 0 60 40" className="h-3.5 w-5 overflow-hidden rounded-[2px]">
          <path fill="#012169" d="M0 0h60v40H0z" />
          <path stroke="#fff" strokeWidth="8" d="m0 0 60 40M60 0 0 40" />
          <path stroke="#c8102e" strokeWidth="3" d="m0 0 60 40M60 0 0 40" />
          <path stroke="#fff" strokeWidth="12" d="M30 0v40M0 20h60" />
          <path stroke="#c8102e" strokeWidth="7" d="M30 0v40M0 20h60" />
        </svg> : "EN"}
      </button>
      <button
        type="button"
        onClick={() => select("uk")}
        aria-pressed={locale === "uk"}
        aria-label={variant === "flags" ? "Українська" : undefined}
        title={variant === "flags" ? "Українська" : undefined}
        className={`${variant === "flags" ? "grid size-8 place-items-center rounded-md" : "min-h-11 min-w-11 rounded-lg px-2 text-sm font-semibold"} ${locale === "uk" ? "bg-[var(--app-surface)] text-[var(--app-ink)] shadow-sm" : "text-[var(--app-muted)]"}`}
      >
        {variant === "flags" ? <svg aria-hidden="true" viewBox="0 0 60 40" className="h-3.5 w-5 overflow-hidden rounded-[2px]">
          <path fill="#0057b7" d="M0 0h60v20H0z" />
          <path fill="#ffd700" d="M0 20h60v20H0z" />
        </svg> : "УКР"}
      </button>
    </div>
  );
}
