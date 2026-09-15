"use client";

import { useState } from "react";
import type { Locale } from "@/lib/i18n";

export default function AppearanceSettings({ locale }: { locale: Locale }) {
  const [theme, setTheme] = useState(() =>
    typeof document === "undefined"
      ? "system"
      : document.documentElement.dataset.themePreference || "system",
  );
  const uk = locale === "uk";
  return (
    <section className="border-b border-[var(--app-line)] py-5">
      <h3 className="mb-3 font-medium">{uk ? "Вигляд" : "Appearance"}</h3>
      <div className="grid grid-cols-3 gap-2">
        {(["system", "light", "dark"] as const).map((value, index) => (
          <button
            key={value}
            aria-pressed={theme === value}
            className={`min-h-11 rounded-lg px-2 text-sm ${theme === value ? "bg-[var(--app-surface-muted)] font-semibold" : "text-[var(--app-muted)]"}`}
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
            {
              (uk
                ? ["Системний", "Світлий", "Темний"]
                : ["System", "Light", "Dark"])[index]
            }
          </button>
        ))}
      </div>
    </section>
  );
}
