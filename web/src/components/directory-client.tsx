"use client";

import {
  CalendarDays,
  ChevronRight,
  MapPin,
  Phone,
  Search,
  Settings,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import LanguageSwitcher from "@/components/language-switcher";
import SignOutButton from "@/components/sign-out-button";
import { dictionaries, type Locale } from "@/lib/i18n";

export type DirectoryPerson = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  phone: string;
  address: string;
  dateOfBirth: string;
  membershipJoinedAt: string;
  photoPath: string | null;
};

const gradients = [
  "from-sky-500 to-blue-700",
  "from-rose-400 to-fuchsia-700",
  "from-amber-400 to-orange-700",
  "from-emerald-400 to-teal-700",
  "from-violet-400 to-indigo-700",
];
const initials = (person: DirectoryPerson) =>
  `${person.firstName[0] ?? ""}${person.lastName[0] ?? ""}`.toLocaleUpperCase();

function Avatar({
  person,
  large = false,
}: {
  person: DirectoryPerson;
  large?: boolean;
}) {
  const size = large
    ? "size-32 text-3xl ring-4 ring-white shadow-lg"
    : "size-12 text-base ring-1 ring-slate-200/80";
  const color =
    gradients[
      Number.parseInt(person.id.replace(/\D/g, "").slice(-2) || "0", 10) %
        gradients.length
    ];
  return (
    <div
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br ${color} font-semibold text-white shadow-sm ${size}`}
    >
      {person.photoPath ? (
        <img
          src={person.photoPath}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        initials(person)
      )}
    </div>
  );
}

export default function DirectoryClient({
  members,
  role,
  locale,
}: {
  members: DirectoryPerson[];
  role: "member" | "editor" | "admin";
  locale: Locale;
}) {
  const copy = dictionaries[locale];
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<DirectoryPerson | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [textSize, setTextSize] = useState<"standard" | "large">("standard");
  const [appearanceReady, setAppearanceReady] = useState(false);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  const returnToDirectory = () => {
    setPhotoOpen(false);
    setSelected(null);
  };

  useEffect(() => {
    const saved = window.localStorage.getItem("directory-text-size");
    const initialSize = saved === "large" ? "large" : "standard";
    setTextSize(initialSize);
    document.documentElement.dataset.textSize = initialSize;
    setAppearanceReady(true);
  }, []);

  useEffect(() => {
    if (!appearanceReady) return;
    document.documentElement.dataset.textSize = textSize;
    window.localStorage.setItem("directory-text-size", textSize);
  }, [appearanceReady, textSize]);

  useEffect(() => {
    if (!settingsOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSettingsOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [settingsOpen]);

  const dateLocale = locale === "uk" ? "uk-UA" : "en-US";
  const nameLocale = members.some((person) =>
    /[А-Яа-яІіЇїЄєҐґ]/u.test(person.lastName),
  )
    ? "uk-UA"
    : "en-US";
  const formatDate = (date: string) =>
    date
      ? new Intl.DateTimeFormat(dateLocale, {
          dateStyle: "long",
          timeZone: "UTC",
        }).format(new Date(`${date}T00:00:00Z`))
      : copy.notProvided;

  const results = useMemo(() => {
    const collator = new Intl.Collator(nameLocale, { sensitivity: "base" });
    const sorted = [...members].sort(
      (a, b) =>
        collator.compare(a.lastName, b.lastName) ||
        collator.compare(a.firstName, b.firstName),
    );
    const term = query.trim().toLocaleLowerCase(nameLocale);
    return term
      ? sorted.filter((person) =>
          [
            person.name,
            `${person.lastName} ${person.firstName}`,
            person.phone,
            person.address,
            person.dateOfBirth,
            person.membershipJoinedAt,
          ].some((field) => field.toLocaleLowerCase(nameLocale).includes(term)),
        )
      : sorted;
  }, [members, nameLocale, query]);

  const groups = useMemo(() => {
    const grouped = new Map<string, DirectoryPerson[]>();
    for (const person of results) {
      const firstCharacter =
        person.lastName.trim().charAt(0).toLocaleUpperCase(nameLocale) || "#";
      const letter = /\p{L}/u.test(firstCharacter) ? firstCharacter : "#";
      grouped.set(letter, [...(grouped.get(letter) ?? []), person]);
    }
    return [...grouped.entries()];
  }, [nameLocale, results]);

  if (selected)
    return (
      <main className="fixed inset-0 h-dvh overflow-hidden overscroll-none bg-[var(--app-bg)] sm:p-6">
        <section
          onTouchStart={(event) => {
            const touch = event.touches[0];
            swipeStart.current = touch
              ? { x: touch.clientX, y: touch.clientY }
              : null;
          }}
          onTouchEnd={(event) => {
            const start = swipeStart.current;
            const touch = event.changedTouches[0];
            swipeStart.current = null;
            if (!start || !touch || photoOpen) return;
            const horizontalDistance = touch.clientX - start.x;
            const verticalDistance = Math.abs(touch.clientY - start.y);
            if (
              horizontalDistance > 72 &&
              horizontalDistance > verticalDistance * 1.4
            ) {
              returnToDirectory();
            }
          }}
          className="native-enter native-shadow mx-auto flex h-full max-w-xl flex-col overflow-hidden bg-white sm:rounded-[2rem]"
        >
          <div className="native-scroll min-h-0 flex-1 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="relative h-[62dvh] min-h-[360px] max-h-[600px] overflow-hidden bg-gradient-to-br from-[var(--app-brand)] to-[#07131d]">
              {selected.photoPath ? (
                <button
                  onClick={() => setPhotoOpen(true)}
                  aria-label={copy.viewPhoto}
                  className="absolute inset-0 h-full w-full cursor-zoom-in"
                >
                  <img
                    src={selected.photoPath}
                    alt={selected.name}
                    className="h-full w-full object-cover"
                  />
                </button>
              ) : (
                <div className="grid h-full place-items-center pb-16">
                  <Avatar person={selected} large />
                </div>
              )}
              {selected.photoPath && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 backdrop-blur-[10px]"
                  style={{
                    maskImage:
                      "linear-gradient(to bottom, transparent 52%, rgba(0, 0, 0, 0.03) 60%, rgba(0, 0, 0, 0.12) 69%, rgba(0, 0, 0, 0.3) 78%, rgba(0, 0, 0, 0.62) 89%, black 100%)",
                    WebkitMaskImage:
                      "linear-gradient(to bottom, transparent 52%, rgba(0, 0, 0, 0.03) 60%, rgba(0, 0, 0, 0.12) 69%, rgba(0, 0, 0, 0.3) 78%, rgba(0, 0, 0, 0.62) 89%, black 100%)",
                  }}
                />
              )}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(7,19,29,0.14)_0%,transparent_22%,transparent_60%,rgba(7,19,29,0.04)_68%,rgba(7,19,29,0.14)_76%,rgba(7,19,29,0.36)_86%,rgba(7,19,29,0.78)_100%)]"
              />
              <div className="safe-top absolute inset-x-0 top-0 z-10 flex items-start justify-between px-4">
                <button
                  onClick={returnToDirectory}
                  aria-label={copy.backToDirectory}
                  className="grid size-11 shrink-0 place-items-center rounded-full border border-white/15 bg-[#07131d]/65 text-2xl font-medium text-white shadow-lg backdrop-blur-xl hover:bg-[#07131d]/80"
                >
                  ←
                </button>
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-5 pb-6 pt-14 text-left">
                <h1 className="text-[30px] font-bold leading-tight tracking-[-0.025em] text-white drop-shadow-md min-[375px]:text-[34px]">
                  {selected.name}
                </h1>
              </div>
            </div>
            <div className="mx-5 mb-10 mt-7 space-y-7 sm:mx-7">
              {selected.phone && (
                <a
                  href={`tel:${selected.phone.replace(/[^\d+]/g, "")}`}
                  className="flex min-h-14 items-center gap-4 py-1"
                >
                  <Phone className="size-5 shrink-0 text-slate-400" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
                      {copy.phone}
                    </span>
                    <span className="mt-0.5 block text-[17px] font-medium text-[var(--app-brand)]">
                      {selected.phone}
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-slate-300" />
                </a>
              )}
              {selected.address && (
                <a
                  href={`https://maps.apple.com/?q=${encodeURIComponent(selected.address)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-14 items-center gap-4 py-1"
                >
                  <MapPin className="size-5 shrink-0 text-slate-400" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
                      {copy.address}
                    </span>
                    <span className="mt-0.5 block text-[17px] leading-6 text-[var(--app-brand)]">
                      {selected.address}
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-slate-300" />
                </a>
              )}
              <div className="flex min-h-14 items-center gap-4 py-1">
                <UserRound className="size-5 shrink-0 text-slate-400" />
                <span>
                  <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
                    {copy.dateOfBirth}
                  </span>
                  <span className="mt-0.5 block text-[17px] text-[var(--app-ink)]">
                    {formatDate(selected.dateOfBirth)}
                  </span>
                </span>
              </div>
              <div className="flex min-h-14 items-center gap-4 py-1">
                <CalendarDays className="size-5 shrink-0 text-slate-400" />
                <span>
                  <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
                    {copy.membershipDate}
                  </span>
                  <span className="mt-0.5 block text-[17px] text-[var(--app-ink)]">
                    {formatDate(selected.membershipJoinedAt)}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </section>
        {photoOpen && selected.photoPath && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${selected.name} profile photo`}
            onClick={() => setPhotoOpen(false)}
            className="native-fade fixed inset-0 z-50 grid cursor-zoom-out place-items-center bg-[#07131d]/96 p-4 backdrop-blur-sm"
          >
            <button
              onClick={() => setPhotoOpen(false)}
              aria-label={copy.closePhoto}
              className="absolute right-5 top-[max(1.25rem,env(safe-area-inset-top))] grid size-11 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"
            >
              <X className="size-6" />
            </button>
            <img
              src={selected.photoPath}
              alt={selected.name}
              onClick={(event) => event.stopPropagation()}
              className="max-h-full max-w-full cursor-default object-contain"
            />
          </div>
        )}
      </main>
    );

  return (
    <main className="fixed inset-0 h-dvh overflow-hidden overscroll-none bg-[var(--app-bg)] sm:p-6">
      <section className="native-enter native-shadow relative mx-auto flex h-full max-w-xl flex-col overflow-hidden bg-white sm:rounded-[2rem]">
        <header className="safe-top z-30 flex-none bg-white/92 px-4 pb-1 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="mt-0.5 text-[24px] font-bold leading-tight tracking-[-0.025em] text-[var(--app-ink)] min-[375px]:text-[26px]">
                {copy.memberDirectory}
                <span
                  aria-label={`${members.length} ${members.length === 1 ? copy.member : copy.members}`}
                  className="ml-2 align-middle text-sm font-medium tracking-normal text-[var(--app-muted)]"
                >
                  {members.length}
                </span>
              </h1>
            </div>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label={copy.settings}
              aria-expanded={settingsOpen}
              className="grid size-11 shrink-0 place-items-center text-[var(--app-muted)] hover:text-[var(--app-ink)]"
            >
              <Settings className="size-5" />
            </button>
          </div>
        </header>
        <div className="z-30 flex-none border-b border-[var(--app-line)] bg-white/92 px-4 backdrop-blur-xl">
          <label className="flex min-h-11 items-center gap-3 px-1">
            <Search className="size-5 shrink-0 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.searchPlaceholder}
              className="min-h-11 min-w-0 flex-1 bg-transparent py-2 text-base outline-none placeholder:text-slate-400"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="grid size-11 shrink-0 place-items-center text-slate-400 hover:text-slate-700"
                aria-label={copy.clearSearch}
              >
                <X className="size-5" />
              </button>
            )}
          </label>
        </div>
        <div className="native-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white">
          <div>
            {groups.map(([letter, people]) => (
              <section key={letter} id={`letter-${letter}`}>
                <h2 className="sticky top-0 z-10 border-y border-[var(--app-line)] bg-[var(--app-surface-muted)]/95 px-4 py-1.5 text-sm font-bold text-[var(--app-brand)] backdrop-blur">
                  {letter}
                </h2>
                <div className="divide-y divide-[var(--app-line)] pl-4">
                  {people.map((person) => (
                    <button
                      key={person.id}
                      onClick={() => setSelected(person)}
                      className="flex min-h-[68px] w-full items-center gap-3 py-2.5 pr-2 text-left hover:bg-[var(--app-brand-soft)] active:bg-[#d9e9f3]"
                    >
                      <Avatar person={person} />
                      <span className="min-w-0 flex-1 truncate text-[17px] font-medium text-[var(--app-ink)]">
                        {person.firstName}{" "}
                        <span className="font-semibold">{person.lastName}</span>
                      </span>
                      <span aria-hidden className="text-xl text-slate-300">
                        ›
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
          {!results.length && (
            <div className="px-5 py-16 text-center text-[var(--app-muted)]">
              {copy.noMembers}
            </div>
          )}
        </div>
        {settingsOpen && (
          <div
            className="native-fade absolute inset-0 z-50 flex justify-end bg-[#07131d]/45 backdrop-blur-[2px]"
            role="presentation"
            onClick={() => setSettingsOpen(false)}
          >
            <aside
              role="dialog"
              aria-modal="true"
              aria-labelledby="settings-title"
              onClick={(event) => event.stopPropagation()}
              className="native-enter safe-top safe-bottom native-shadow flex h-full w-[min(88%,22rem)] flex-col bg-white px-5 pb-5"
            >
              <div className="flex items-center justify-between border-b border-[var(--app-line)] pb-4">
                <h2
                  id="settings-title"
                  className="text-xl font-bold text-[var(--app-ink)]"
                >
                  {copy.settings}
                </h2>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  aria-label={copy.closeSettings}
                  className="grid size-11 place-items-center rounded-full bg-[var(--app-surface-muted)] text-[var(--app-muted)] hover:bg-[var(--app-brand-soft)]"
                >
                  <X className="size-5" />
                </button>
              </div>

              <section className="border-b border-[var(--app-line)] py-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--app-muted)]">
                  {copy.language}
                </h3>
                <div className="mt-3">
                  <LanguageSwitcher locale={locale} />
                </div>
              </section>

              <section className="py-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--app-muted)]">
                  {copy.appearance}
                </h3>
                <p className="mt-3 text-sm font-medium text-[var(--app-ink)]">
                  {copy.textSize}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl bg-[var(--app-surface-muted)] p-1">
                  {(["standard", "large"] as const).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setTextSize(size)}
                      aria-pressed={textSize === size}
                      className={`min-h-11 rounded-lg px-3 text-sm font-semibold ${textSize === size ? "bg-white text-[var(--app-brand)] shadow-sm" : "text-[var(--app-muted)]"}`}
                    >
                      {size === "standard"
                        ? copy.standardText
                        : copy.largerText}
                    </button>
                  ))}
                </div>
              </section>

              <section className="mt-auto border-t border-[var(--app-line)] pt-5">
                <div className="grid gap-2">
                  {role !== "member" && (
                    <Link
                      href="/admin"
                      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--app-brand-soft)] px-4 py-2 text-sm font-semibold text-[var(--app-brand)] hover:bg-[#d9e9f3]"
                    >
                      {copy.manage}
                    </Link>
                  )}
                  <SignOutButton
                    label={copy.signOut}
                    loadingLabel={copy.signingOut}
                  />
                </div>
              </section>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
