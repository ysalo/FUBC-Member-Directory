"use client";

import { useId, useState } from "react";
import { CircleHelp } from "lucide-react";
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
  const [helpOpen, setHelpOpen] = useState(false);
  return (
    <div className="mb-6 rounded-2xl bg-[var(--app-surface-muted)] px-4 py-3">
      <div className="flex items-center gap-1">
        <label
          className="flex min-h-14 min-w-0 flex-1 cursor-pointer items-center justify-between gap-3"
          htmlFor={id}
        >
          <span className="min-w-0">
            <span className="block text-sm font-semibold">
              {uk ? "Сповіщення про дні народження" : "Birthday notifications"}
            </span>
            <span className="mt-1 block text-xs text-[var(--app-muted)]">
              {enabled ? (uk ? "Увімкнено" : "On") : uk ? "Вимкнено" : "Off"}
            </span>
          </span>
          <span className="relative grid min-h-11 min-w-14 shrink-0 place-items-center">
            <input
              id={id}
              type="checkbox"
              role="switch"
              checked={enabled}
              aria-describedby={helpOpen ? `${id}-hint` : undefined}
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
        <button
          type="button"
          aria-label={
            uk
              ? "Про сповіщення про дні народження"
              : "About birthday notifications"
          }
          aria-expanded={helpOpen}
          aria-controls={`${id}-hint`}
          className="grid size-11 shrink-0 place-items-center text-[var(--app-muted)]"
          onClick={() => setHelpOpen((open) => !open)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setHelpOpen(false);
          }}
        >
          <CircleHelp className="size-4" aria-hidden="true" />
        </button>
      </div>
      <p
        hidden={!helpOpen}
        id={`${id}-hint`}
        className="mt-1 text-xs leading-relaxed text-[var(--app-muted)]"
      >
        {uk
          ? "Нагадування допоможуть вам не пропустити дні народження членів вашої групи. Перемикач зберігає ваш вибір на цьому пристрої; надсилання сповіщень ще не ввімкнено."
          : "Birthday reminders help you keep track of birthdays for members in your group. This switch saves your preference on this device; notification delivery is not enabled yet."}
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
