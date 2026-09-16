"use client";

import { useEffect, useState } from "react";
import { Monitor, Sun, Moon } from "lucide-react";
import type { Locale } from "@/lib/i18n";

export default function AppearanceSettings({ locale }: { locale: Locale }) {
  const [theme, setTheme] = useState(() =>
    typeof document === "undefined" ? "system" : document.documentElement.dataset.themePreference || "system",
  );
  const [dark, setDark] = useState(() =>
    typeof document !== "undefined" && document.documentElement.dataset.theme === "dark",
  );
  const uk = locale === "uk";

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => { if (theme === "system") setDark(media.matches); };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [theme]);

  function select(value: "system" | "light" | "dark") {
    const nextDark = value === "system" ? window.matchMedia("(prefers-color-scheme: dark)").matches : value === "dark";
    setTheme(value);
    setDark(nextDark);
    document.documentElement.dataset.themePreference = value;
    document.documentElement.dataset.theme = nextDark ? "dark" : "light";
    try { localStorage.setItem("directory-theme", value); } catch {}
  }

  return (
    <section className="px-2 pt-4 pb-3">
      <h3 className="mb-2 text-xs font-medium text-[var(--app-muted)]">{uk ? "Вигляд" : "Appearance"}</h3>
      <div className="flex items-center gap-2">
        <button type="button" role="switch" aria-checked={dark}
          aria-label={uk ? "Темна тема" : "Dark theme"}
          onClick={() => select(dark ? "light" : "dark")}
          className="theme-toggle" data-dark={dark}>
          <span className="theme-toggle-thumb" aria-hidden="true" />
          <Sun aria-hidden="true" className="theme-toggle-icon" strokeWidth={1.6} />
          <Moon aria-hidden="true" className="theme-toggle-icon" strokeWidth={1.6} />
        </button>
        <button type="button" aria-pressed={theme === "system"}
          aria-label={uk ? "Системний" : "System"}
          title={uk ? "Використовувати тему пристрою" : "Follow device appearance"}
          onClick={() => select("system")} className="theme-system">
          <Monitor aria-hidden="true" className="size-3.5" strokeWidth={1.6} />
          {theme === "system" && <span aria-hidden="true" className="theme-system-dot" />}
        </button>
      </div>
    </section>
  );
}
