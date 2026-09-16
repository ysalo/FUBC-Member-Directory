"use client";

import { useState } from "react";
import type { Locale } from "@/lib/i18n";

export default function AppearanceSettings({ locale }: { locale: Locale }) {
  const [dark, setDark] = useState(() =>
    typeof document !== "undefined" && document.documentElement.dataset.theme === "dark",
  );
  const uk = locale === "uk";
  function select(value: "light" | "dark") {
    setDark(value === "dark");
    document.documentElement.dataset.themePreference = value;
    document.documentElement.dataset.theme = value;
    try { localStorage.setItem("directory-theme", value); } catch {}
  }
  return (
    <section className="px-2 pt-5 pb-4">
      <h3 className="mb-3 text-sm font-medium text-[var(--app-muted)]">{uk ? "Вигляд" : "Appearance"}</h3>
      <div className="theme-choice" role="group" aria-label={uk ? "Вигляд" : "Appearance"}>
        <button type="button" aria-label={uk ? "Світла тема" : "Light theme"} aria-pressed={!dark} onClick={() => select("light")} className="theme-choice-button theme-choice-light">
          <svg aria-hidden="true" viewBox="0 0 40 40" className="theme-choice-icon">
            <circle cx="20" cy="20" r="8" fill="currentColor" />
            <path d="M20 3v4m0 26v4M3 20h4m26 0h4M8 8l3 3m18 18 3 3M8 32l3-3m18-18 3-3" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          </svg>
        </button>
        <button type="button" aria-label={uk ? "Темна тема" : "Dark theme"} aria-pressed={dark} onClick={() => select("dark")} className="theme-choice-button theme-choice-dark">
          <svg aria-hidden="true" viewBox="0 0 40 40" className="theme-choice-icon"><path fill="currentColor" d="M24 3A17 17 0 1 0 37 27 17 17 0 0 1 24 3Z" /></svg>
        </button>
      </div>
    </section>
  );
}
