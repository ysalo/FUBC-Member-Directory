"use client";

import {
  BookUser,
  UsersRound,
  SlidersHorizontal,
  Settings,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "@/components/navigation-link";
import LanguageSwitcher from "@/components/language-switcher";
import SignOutButton from "@/components/sign-out-button";
import { dictionaries, type Locale } from "@/lib/i18n";
import { groupCopy } from "@/lib/group-copy";
import type { AppRole } from "@/lib/auth";

export default function BottomNavigation({
  role,
  isDeacon,
  locale,
  fixed = false,
}: {
  role: AppRole;
  isDeacon: boolean;
  locale: Locale;
  fixed?: boolean;
}) {
  const pathname = usePathname();
  const copy = dictionaries[locale];
  const labels = groupCopy(locale);
  const [open, setOpen] = useState(false);
  const [textSize, setTextSize] = useState("standard");
  const dialog = useRef<HTMLElement>(null);
  const settingsButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const saved =
      window.localStorage.getItem("directory-text-size") === "large"
        ? "large"
        : "standard";
    document.documentElement.dataset.textSize = saved;
  }, []);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () =>
      Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          'button, a[href], input, select, [tabindex="0"]',
        ) ?? [],
      );
    focusable()[0]?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [open]);
  if (
    /^\/admin\/[^/]+$/.test(pathname) &&
    !["/admin/accounts", "/admin/groups"].includes(pathname)
  )
    return null;
  const tabs = [
    {
      href: "/",
      label: labels.directory,
      Icon: BookUser,
      active: pathname === "/",
    },
    ...(isDeacon
      ? [
          {
            href: "/groups",
            label: labels.myGroups,
            Icon: UsersRound,
            active: pathname === "/groups",
          },
        ]
      : []),
    ...(role !== "member"
      ? [
          {
            href: "/admin",
            label: copy.manage,
            Icon: SlidersHorizontal,
            active: pathname.startsWith("/admin"),
          },
        ]
      : []),
  ];
  return (
    <>
      <nav
        aria-label={locale === "uk" ? "Головна навігація" : "Main navigation"}
        className={`${fixed ? "fixed inset-x-0 bottom-0 z-40 mx-auto max-w-xl" : "relative z-30 flex-none"} border-t border-[var(--app-line)] bg-white/95 px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur-xl`}
      >
        <div className="flex items-stretch">
          {tabs.map(({ href, label, Icon, active }) => (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`bottom-navigation-item flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 font-medium ${active ? "text-[var(--app-ink)]" : "text-[var(--app-muted)]"}`}
            >
              <Icon className="bottom-navigation-icon" strokeWidth={1.75} />
              <span className="max-w-full truncate">{label}</span>
            </Link>
          ))}
          <button
            ref={settingsButton}
            type="button"
            onClick={() => {
              setTextSize(
                document.documentElement.dataset.textSize === "large"
                  ? "large"
                  : "standard",
              );
              setOpen(true);
            }}
            aria-expanded={open}
            className="bottom-navigation-item flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 font-medium text-[var(--app-muted)]"
          >
            <Settings className="bottom-navigation-icon" strokeWidth={1.75} />
            <span className="max-w-full truncate">{copy.settings}</span>
          </button>
        </div>
      </nav>
      {open && (
        <div
          className="native-fade fixed inset-0 z-[80] flex justify-end bg-[#07131d]/45"
          onClick={() => setOpen(false)}
        >
          <aside
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            onClick={(e) => e.stopPropagation()}
            className="safe-top safe-bottom native-enter flex h-dvh w-[min(88%,22rem)] flex-col overflow-y-auto bg-white px-5"
          >
            <div className="flex items-center justify-between border-b border-[var(--app-line)] pb-3">
              <h2 id="settings-title" className="text-xl font-bold">
                {copy.settings}
              </h2>
              <button
                aria-label={copy.closeSettings}
                onClick={() => setOpen(false)}
                className="grid size-11 place-items-center"
              >
                <X className="size-5" />
              </button>
            </div>
            <section className="border-b border-[var(--app-line)] py-5">
              <h3 className="mb-3 font-medium">{copy.language}</h3>
              <LanguageSwitcher locale={locale} />
            </section>
            <section className="py-5">
              <h3 className="mb-3 font-medium">{copy.textSize}</h3>
              <div className="grid grid-cols-2 gap-2">
                {["standard", "large"].map((size) => (
                  <button
                    key={size}
                    aria-pressed={size === textSize}
                    onClick={() => {
                      setTextSize(size);
                      document.documentElement.dataset.textSize = size;
                      window.localStorage.setItem("directory-text-size", size);
                    }}
                    className={`min-h-11 rounded-lg px-2 ${size === textSize ? "bg-[var(--app-surface-muted)] font-semibold" : "text-[var(--app-muted)]"}`}
                  >
                    {size === "large" ? copy.largerText : copy.standardText}
                  </button>
                ))}
              </div>
            </section>
            <div className="mt-auto border-t border-[var(--app-line)] py-5">
              <SignOutButton
                label={copy.signOut}
                loadingLabel={copy.signingOut}
              />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
