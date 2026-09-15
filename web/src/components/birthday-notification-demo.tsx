"use client";

import { useId, useState } from "react";
import type { Locale } from "@/lib/i18n";

export default function BirthdayNotificationDemo({
  preferenceKey,
  locale,
}: {
  preferenceKey: string;
  locale: Locale;
}) {
  const id = useId();
  const uk = locale === "uk";
  const [enabled, setEnabled] = useState(() => {
    try {
      return (
        typeof window !== "undefined" &&
        localStorage.getItem(preferenceKey) === "on"
      );
    } catch {
      return false;
    }
  });
  const [storageFailed, setStorageFailed] = useState(false);
  return (
    <div className="mb-6 rounded-2xl bg-[var(--app-surface-muted)] px-4 py-3">
      <label
        className="flex min-h-14 cursor-pointer items-center justify-between gap-4"
        htmlFor={id}
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold">
            {uk ? "Сповіщення про дні народження" : "Birthday notifications"}
          </span>
          <span className="mt-1 block text-xs text-[var(--app-muted)]">
            {enabled
              ? uk
                ? "Увімкнено для демо"
                : "On for demo"
              : uk
                ? "Вимкнено"
                : "Off"}
          </span>
        </span>
        <span className="relative grid min-h-11 min-w-14 shrink-0 place-items-center">
          <input
            id={id}
            type="checkbox"
            role="switch"
            checked={enabled}
            aria-describedby={`${id}-hint`}
            className="peer sr-only"
            onChange={(event) => {
              const next = event.target.checked;
              setEnabled(next);
              try {
                localStorage.setItem(preferenceKey, next ? "on" : "off");
                setStorageFailed(false);
              } catch {
                setStorageFailed(true);
              }
            }}
          />
          <span
            aria-hidden="true"
            className="flex h-8 w-[52px] items-center rounded-full bg-[var(--app-line)] p-0.5 peer-checked:bg-[#34c759] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-[var(--app-brand)]"
          >
            <span
              className={`size-7 rounded-full bg-white shadow-sm ${enabled ? "translate-x-5" : "translate-x-0"}`}
              style={{ backgroundColor: "#ffffff" }}
            />
          </span>
        </span>
      </label>
      <p
        id={`${id}-hint`}
        className="mt-1 text-xs leading-relaxed text-[var(--app-muted)]"
      >
        {uk
          ? "Лише демо — сповіщення не надсилаються. Налаштування зберігається на цьому пристрої."
          : "Demo only — no notifications are sent. Saved on this device."}
      </p>
      {storageFailed && (
        <p role="status" className="mt-2 text-xs text-[var(--app-muted)]">
          {uk
            ? "Цей браузер не дозволяє зберегти налаштування. Воно діятиме до закриття цього екрана."
            : "This browser cannot save the setting. It will last until you leave this view."}
        </p>
      )}
    </div>
  );
}
