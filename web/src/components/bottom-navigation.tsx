"use client";

import {
  BookUser,
  UsersRound,
  SlidersHorizontal,
  Menu,
  X,
  CalendarDays,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import Link from "@/components/navigation-link";
import LanguageSwitcher from "@/components/language-switcher";
import SignOutButton from "@/components/sign-out-button";
import AppearanceSettings from "@/components/appearance-settings";
import { dictionaries, type Locale } from "@/lib/i18n";
import { groupCopy } from "@/lib/group-copy";
import type { AppRole } from "@/lib/auth";
import { pendingVisitCount } from "@/app/visitation/actions";
import { visitCopy } from "@/lib/visitation";
import MemberPhoto from "@/components/member-photo";
import type { NavigationUser } from "@/lib/navigation-user";

export default function BottomNavigation({
  role,
  isDeacon,
  isPastor = false,
  locale,
  fixed = false,
  currentUser,
}: {
  role: AppRole;
  isDeacon: boolean;
  isPastor?: boolean;
  locale: Locale;
  fixed?: boolean;
  currentUser: NavigationUser;
}) {
  const pathname = usePathname();
  const copy = dictionaries[locale];
  const labels = groupCopy(locale);
  const [open, setOpen] = useState(false);
  const [textSize, setTextSize] = useState("standard");
  const [pending, setPending] = useState<number | null>(null);
  useEffect(() => {
    if (!isDeacon && !isPastor) return;
    let mounted = true,
      sequence = 0;
    const update = () => {
      if (document.visibilityState === "hidden") return;
      const current = ++sequence;
      void pendingVisitCount()
        .then((count) => {
          if (mounted && current === sequence) setPending(count);
        })
        .catch(() => {
          if (mounted && current === sequence) setPending(null);
        });
    };
    update();
    const interval = window.setInterval(update, 60000);
    window.addEventListener("visitation-updated", update);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      mounted = false;
      window.clearInterval(interval);
      window.removeEventListener("visitation-updated", update);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [isDeacon, isPastor, pathname]);
  const dialog = useRef<HTMLElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const settingsButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let saved = "standard";
    try {
      if (window.localStorage.getItem("directory-text-size") === "large")
        saved = "large";
    } catch {}
    document.documentElement.dataset.textSize = saved;
  }, []);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const background = Array.from(document.body.children)
      .filter(
        (element): element is HTMLElement =>
          element instanceof HTMLElement && element !== overlay.current,
      )
      .map((element) => ({ element, inert: element.inert }));
    background.forEach(({ element }) => {
      element.inert = true;
    });
    const focusable = () =>
      Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]',
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
      document.body.style.overflow = previousOverflow;
      background.forEach(({ element, inert }) => {
        element.inert = inert;
      });
      previous?.focus();
    };
  }, [open]);
  const tabs = [
    {
      href: "/",
      label: labels.directory,
      Icon: BookUser,
      active: pathname === "/" || pathname.startsWith("/members"),
    },
    {
      href: "/groups",
      label: labels.browseGroups,
      Icon: UsersRound,
      active: pathname.startsWith("/groups"),
    },
    ...(isDeacon || isPastor
      ? [
          {
            href: "/visitation",
            label: locale === "uk" ? "Відвідування" : "Visitation",
            Icon: CalendarDays,
            active: pathname.startsWith("/visitation"),
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
  const identity = (
    <>
      <MemberPhoto name={currentUser.name} photoPath={currentUser.photoPath} />
      <span className="min-w-0">
        <span className="block break-words text-base font-semibold">
          {currentUser.name}
        </span>
        {!currentUser.personId && (
          <span className="block text-xs text-[var(--app-muted)]">
            {copy.notLinked}
          </span>
        )}
        <span className="block break-all text-xs text-[var(--app-muted)]">
          {currentUser.email}
        </span>
      </span>
    </>
  );
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
              aria-label={
                href === "/visitation" && pending
                  ? `${label}, ${pending} ${visitCopy(locale).pendingRequests}`
                  : undefined
              }
              className={`bottom-navigation-item flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 font-medium ${active ? "text-[var(--app-ink)]" : "text-[var(--app-muted)]"}`}
            >
              <span className="relative">
                <Icon className="bottom-navigation-icon" strokeWidth={1.75} />
                {href === "/visitation" && pending !== null && pending > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute -right-3 -top-2 grid min-h-4 min-w-4 place-items-center rounded-full bg-[#c43232] px-1 text-xs font-bold leading-4 text-white ring-2 ring-[var(--app-surface)]"
                  >
                    {pending > 99 ? "99+" : pending}
                  </span>
                )}
              </span>
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
            aria-haspopup="dialog"
            aria-controls="directory-menu"
            className="bottom-navigation-item flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 font-medium text-[var(--app-muted)]"
          >
            <Menu className="bottom-navigation-icon" strokeWidth={1.75} />
            <span className="max-w-full truncate">{copy.settings}</span>
          </button>
        </div>
      </nav>
      {open &&
        createPortal(
          <div
            ref={overlay}
            className="menu-overlay native-fade fixed inset-0 z-[80] flex justify-end bg-black/35"
            onClick={() => setOpen(false)}
          >
            <aside
              ref={dialog}
              id="directory-menu"
              role="dialog"
              aria-modal="true"
              aria-labelledby="settings-title"
              onClick={(e) => e.stopPropagation()}
              className="side-menu native-scroll flex h-dvh min-h-0 w-[min(90vw,24rem)] flex-col overflow-y-auto border-l border-[var(--app-line)] bg-[var(--app-surface)] px-6 shadow-2xl"
            >
              <div className="menu-brand">
                <p className="brand-wordmark">FUBC</p>
                <p className="brand-caption">
                  {locale === "uk"
                    ? "Довідник членів церкви"
                    : "Member Directory"}
                </p>
              </div>
              <div className="menu-header flex items-center justify-between gap-2 px-0 pt-4 pb-4">
                <h2 id="settings-title" className="sr-only">
                  {copy.settings}
                </h2>
                <div className="min-w-0 flex-1">
                  <p className="sr-only">{copy.signedInAs}</p>
                  {currentUser.personId ? (
                    <Link
                      href={`/members/${currentUser.personId}`}
                      onClick={() => setOpen(false)}
                      className="flex min-h-11 min-w-0 items-center gap-2"
                    >
                      {identity}
                    </Link>
                  ) : (
                    <div className="flex min-w-0 items-center gap-2">
                      {identity}
                    </div>
                  )}
                </div>
                <button
                  aria-label={copy.closeSettings}
                  onClick={() => setOpen(false)}
                  className="menu-close grid size-11 shrink-0 place-items-center rounded-xl"
                >
                  <X className="size-5" />
                </button>
              </div>
              <AppearanceSettings locale={locale} />
              <section className="menu-section">
                <h3 className="menu-section-title">{copy.language}</h3>
                <LanguageSwitcher locale={locale} />
              </section>
              <section className="menu-section">
                <h3 className="menu-section-title">{copy.textSize}</h3>
                <div className="text-size-stepper">
                  {["standard", "large"].map((size) => (
                    <button
                      key={size}
                      aria-pressed={size === textSize}
                      onClick={() => {
                        setTextSize(size);
                        document.documentElement.dataset.textSize = size;
                        try {
                          window.localStorage.setItem(
                            "directory-text-size",
                            size,
                          );
                        } catch {}
                      }}
                      className="text-size-option"
                    >
                      <span className="text-size-dot" aria-hidden="true" />
                      <span>
                        {size === "large" ? copy.largerText : copy.standardText}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
              <div className="mt-auto border-t border-[var(--app-line)] py-3">
                <SignOutButton
                  variant="menu"
                  label={copy.signOut}
                  loadingLabel={copy.signingOut}
                />
              </div>
            </aside>
          </div>,
          document.body,
        )}
    </>
  );
}
