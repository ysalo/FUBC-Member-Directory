"use client";

import { useState } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { dictionaries, type Locale } from "@/lib/i18n";

export default function AppearanceSettings({ locale }: { locale: Locale }) {
  const [theme, setTheme] = useState(() =>
    typeof document === "undefined"
      ? "system"
      : document.documentElement.dataset.themePreference || "system",
  );
  const uk = locale === "uk";
  return (
    <section className="border-b border-[var(--app-line)] py-5">
      <h3 className="mb-3 font-medium">{dictionaries[locale].appearance}</h3>
      <div
        className="grid grid-cols-3 gap-2"
        role="group"
        aria-label={dictionaries[locale].appearance}
      >
        {(["system", "light", "dark"] as const).map((value, index) => {
          const Icon = [Monitor, Sun, Moon][index];
          return (
            <button
              key={value}
              type="button"
              aria-pressed={theme === value}
              className={`relative flex min-h-24 min-w-0 flex-col items-center justify-center gap-3 rounded-2xl border px-1 py-4 text-xs focus-visible:outline-[var(--app-brand)] sm:text-sm ${theme === value ? "border-[var(--app-brand)] bg-[var(--app-brand-soft)] font-semibold text-[var(--app-brand)]" : "border-[var(--app-line)] bg-[var(--app-surface)] text-[var(--app-muted)] hover:bg-[var(--app-surface-muted)]"}`}
              onClick={() => {
                setTheme(value);
                document.documentElement.dataset.themePreference = value;
                document.documentElement.dataset.theme =
                  value === "system"
                    ? window.matchMedia("(prefers-color-scheme: dark)").matches
                      ? "dark"
                      : "light"
                    : value;
                try {
                  localStorage.setItem("directory-theme", value);
                } catch {}
              }}
            >
              <Icon aria-hidden="true" className="size-6" strokeWidth={1.75} />
              {theme === value && (
                <Check
                  aria-hidden="true"
                  className="absolute top-1.5 right-1.5 size-3"
                />
              )}
              <span className="max-w-full break-words">
                {
                  (uk
                    ? ["Системний", "Світлий", "Темний"]
                    : ["System", "Light", "Dark"])[index]
                }
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
