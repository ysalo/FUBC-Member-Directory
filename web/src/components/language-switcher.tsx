"use client";

import { Check, Languages } from "lucide-react";
import { dictionaries, type Locale } from "@/lib/i18n";

function selectLocale(nextLocale: Locale) {
  document.cookie = `app_locale=${nextLocale}; Max-Age=31536000; Path=/; SameSite=Lax`;
  window.location.reload();
}

export default function LanguageSwitcher({
  locale,
  compact = false,
}: {
  locale: Locale;
  compact?: boolean;
}) {
  const copy = dictionaries[locale];
  return (
    <div
      className={`grid min-w-0 grid-cols-2 gap-1 rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-1 ${compact ? "w-full" : ""}`}
      role="group"
      aria-label={copy.language}
    >
      {(["en", "uk"] as const).map((value) => (
        <button
          key={value}
          type="button"
          lang={value}
          onClick={() => {
            if (value !== locale) selectLocale(value);
          }}
          aria-pressed={locale === value}
          className={`flex min-h-11 min-w-0 flex-wrap items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-sm font-semibold focus-visible:outline-[var(--app-brand)] ${locale === value ? "bg-[var(--app-surface)] text-[var(--app-brand)] shadow-sm" : "text-[var(--app-muted)] hover:bg-[var(--app-surface)]"}`}
        >
          {locale === value ? (
            <Check aria-hidden="true" className="size-4 shrink-0" />
          ) : (
            <Languages aria-hidden="true" className="size-4 shrink-0" />
          )}
          <span>{value === "en" ? copy.english : copy.ukrainian}</span>
        </button>
      ))}
    </div>
  );
}
