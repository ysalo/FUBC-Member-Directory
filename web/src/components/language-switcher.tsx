"use client";
import { Globe, ChevronDown } from "lucide-react";
import type { Locale } from "@/lib/i18n";
export default function LanguageSwitcher({ locale }: { locale: Locale }) {
  return (
    <div className="language-select">
      <Globe aria-hidden="true" />
      <select
        aria-label={locale === "uk" ? "Мова" : "Language"}
        value={locale}
        onChange={(event) => {
          document.cookie = `app_locale=${event.target.value}; Max-Age=31536000; Path=/; SameSite=Lax`;
          window.location.reload();
        }}
      >
        <option value="en">English</option>
        <option value="uk">Українська</option>
      </select>
      <ChevronDown aria-hidden="true" />
    </div>
  );
}
