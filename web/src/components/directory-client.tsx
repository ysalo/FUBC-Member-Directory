"use client";

import {
  CalendarDays,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import LanguageSwitcher from "@/components/language-switcher";
import SignOutButton from "@/components/sign-out-button";
import {
  dictionaries,
  englishAlphabet,
  type Locale,
  ukrainianAlphabet,
} from "@/lib/i18n";

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

  const alphabet = nameLocale === "uk-UA" ? ukrainianAlphabet : englishAlphabet;
  const visibleLetters = new Set(groups.map(([letter]) => letter));

  if (selected)
    return (
      <main className="h-dvh overflow-hidden bg-[var(--app-bg)] sm:p-6">
        <section className="native-enter native-shadow mx-auto flex h-dvh max-w-xl flex-col overflow-hidden bg-white sm:h-[calc(100dvh-3rem)] sm:rounded-[2rem]">
          <header className="safe-top flex flex-none items-center justify-between border-b border-[var(--app-line)] bg-white/92 px-4 pb-3 backdrop-blur-xl">
            <button
              onClick={() => {
                setPhotoOpen(false);
                setSelected(null);
              }}
              aria-label={copy.backToDirectory}
              className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--app-brand-soft)] text-2xl font-medium text-[var(--app-brand)] hover:bg-[#d9e9f3]"
            >
              ←
            </button>
            <p className="text-sm font-semibold text-[var(--app-muted)]">
              {copy.memberProfile}
            </p>
            <LanguageSwitcher locale={locale} />
          </header>
          <div className="native-scroll min-h-0 flex-1 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="relative flex flex-col items-center px-5 pb-5 pt-8 text-center">
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[var(--app-brand-soft)] to-white"
              />
              <div className="relative">
                {selected.photoPath ? (
                  <button
                    onClick={() => setPhotoOpen(true)}
                    aria-label={copy.viewPhoto}
                    className="rounded-full"
                  >
                    <Avatar person={selected} large />
                  </button>
                ) : (
                  <Avatar person={selected} large />
                )}
              </div>
              <h1 className="relative mt-4 text-[28px] font-bold tracking-[-0.025em] text-[var(--app-ink)]">
                {selected.name}
              </h1>
            </div>
            <div className="mx-4 mb-8 overflow-hidden rounded-2xl border border-[var(--app-line)] bg-white shadow-sm sm:mx-6">
              {selected.phone && (
                <a
                  href={`tel:${selected.phone.replace(/[^\d+]/g, "")}`}
                  className="flex min-h-[72px] gap-4 border-b border-[var(--app-line)] px-4 py-4 hover:bg-[var(--app-surface-muted)]"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--app-brand-soft)] text-[var(--app-brand)]">
                    <Phone className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
                      {copy.phone}
                    </span>
                    <span className="mt-0.5 block text-[17px] font-medium text-[var(--app-brand)]">
                      {selected.phone}
                    </span>
                  </span>
                </a>
              )}
              {selected.address && (
                <a
                  href={`https://maps.apple.com/?q=${encodeURIComponent(selected.address)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-[72px] gap-4 border-b border-[var(--app-line)] px-4 py-4 hover:bg-[var(--app-surface-muted)]"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--app-accent-soft)] text-[var(--app-accent)]">
                    <MapPin className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
                      {copy.address}
                    </span>
                    <span className="mt-0.5 block text-[17px] leading-6 text-[var(--app-ink)]">
                      {selected.address}
                    </span>
                  </span>
                </a>
              )}
              <div className="flex min-h-[72px] gap-4 border-b border-[var(--app-line)] px-4 py-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--app-brand-soft)] text-[var(--app-brand)]">
                  <UserRound className="size-5" />
                </span>
                <span>
                  <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
                    {copy.dateOfBirth}
                  </span>
                  <span className="mt-0.5 block text-[17px] text-[var(--app-ink)]">
                    {formatDate(selected.dateOfBirth)}
                  </span>
                </span>
              </div>
              <div className="flex min-h-[72px] gap-4 px-4 py-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--app-accent-soft)] text-[var(--app-accent)]">
                  <CalendarDays className="size-5" />
                </span>
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
    <main className="h-dvh overflow-hidden bg-[var(--app-bg)] sm:p-6">
      <section className="native-enter native-shadow relative mx-auto flex h-dvh max-w-xl flex-col overflow-hidden bg-white sm:h-[calc(100dvh-3rem)] sm:rounded-[2rem]">
        <header className="safe-top z-30 flex-none border-b border-[var(--app-line)] bg-white/92 px-4 pb-3 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--app-accent)]">
                {copy.privateAccess}
              </p>
              <h1 className="mt-0.5 text-[24px] font-bold leading-tight tracking-[-0.025em] text-[var(--app-ink)] min-[375px]:text-[26px]">
                {copy.memberDirectory}
              </h1>
            </div>
            <LanguageSwitcher locale={locale} />
          </div>
          <div className="mt-3 flex items-center gap-2">
            {role !== "member" && (
              <Link
                href="/admin"
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-[var(--app-brand-soft)] px-3 py-2 text-sm font-semibold text-[var(--app-brand)] hover:bg-[#d9e9f3]"
              >
                {copy.manage}
              </Link>
            )}
            <SignOutButton
              compact
              label={copy.signOut}
              loadingLabel={copy.signingOut}
            />
          </div>
        </header>
        <div className="native-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <p className="px-4 py-3 pr-9 text-sm font-medium text-[var(--app-muted)]">
            {query
              ? `${results.length} ${results.length === 1 ? copy.result : copy.results}`
              : `${members.length} ${members.length === 1 ? copy.member : copy.members}`}
          </p>
          <div className="pr-8">
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
        <nav
          aria-label={
            locale === "uk" ? "Алфавітний покажчик" : "Alphabetical index"
          }
          className="absolute right-1 top-1/2 z-20 flex -translate-y-1/2 flex-col items-center text-[8px] font-bold leading-[9px] max-[600px]:text-[7px] max-[600px]:leading-[7px]"
        >
          {alphabet.map((letter) =>
            visibleLetters.has(letter) ? (
              <a
                key={letter}
                href={`#letter-${letter}`}
                className="min-w-5 text-center text-[var(--app-brand)] hover:underline"
              >
                {letter}
              </a>
            ) : (
              <span key={letter} className="min-w-5 text-center text-slate-300">
                {letter}
              </span>
            ),
          )}
        </nav>
        <div className="safe-bottom z-30 flex-none border-t border-[var(--app-line)] bg-white/92 px-4 pb-4 pt-3 backdrop-blur-xl">
          <label className="relative block">
            <Search className="absolute left-3 top-3 size-5 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.searchPlaceholder}
              className="min-h-11 w-full rounded-2xl border border-transparent bg-[var(--app-surface-muted)] py-2.5 pl-10 pr-11 text-base outline-none placeholder:text-slate-400 focus:border-[var(--app-brand)] focus:bg-white focus:ring-4 focus:ring-[#d9e9f3]"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-0 top-0 grid size-11 place-items-center text-slate-400 hover:text-slate-700"
                aria-label={copy.clearSearch}
              >
                <X className="size-5" />
              </button>
            )}
          </label>
          <p className="mt-2 hidden items-center justify-center gap-1.5 text-[11px] text-slate-400 min-[375px]:flex">
            <ShieldCheck className="size-3.5" />
            {copy.approvedOnly}
          </p>
        </div>
      </section>
    </main>
  );
}
