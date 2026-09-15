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
    ? "h-36 w-36 text-4xl ring-4 ring-white/70"
    : "size-12 text-base";
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
      <main className="safe-page min-h-dvh bg-slate-100 sm:p-6">
        <section className="mx-auto min-h-dvh max-w-xl overflow-hidden bg-white shadow-xl sm:min-h-0 sm:rounded-3xl">
          <div className="relative h-72 overflow-hidden bg-gradient-to-br from-sky-500 to-blue-700 sm:h-80">
            {selected.photoPath ? (
              <button
                onClick={() => setPhotoOpen(true)}
                aria-label={copy.viewPhoto}
                className="block h-full w-full cursor-zoom-in"
              >
                <img
                  src={selected.photoPath}
                  alt={selected.name}
                  className="h-full w-full object-cover"
                />
              </button>
            ) : (
              <div className="grid h-full place-items-center">
                <Avatar person={selected} large />
              </div>
            )}
            <button
              onClick={() => {
                setPhotoOpen(false);
                setSelected(null);
              }}
              aria-label={copy.backToDirectory}
              className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] grid size-11 place-items-center rounded-full bg-black/40 text-2xl font-semibold text-white backdrop-blur hover:bg-black/55"
            >
              ←
            </button>
          </div>
          <div className="px-6 pb-10 pt-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  {copy.memberProfile}
                </p>
                <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
                  {selected.name}
                </h1>
              </div>
              <LanguageSwitcher locale={locale} />
            </div>
            <div className="mt-7 divide-y divide-slate-200 border-y border-slate-200">
              {selected.phone && (
                <a
                  href={`tel:${selected.phone.replace(/[^\d+]/g, "")}`}
                  className="flex gap-4 py-5 hover:bg-slate-50"
                >
                  <Phone className="mt-1 size-5 text-blue-600" />
                  <span>
                    <span className="block text-sm text-slate-500">
                      {copy.phone}
                    </span>
                    <span className="text-lg font-medium text-blue-700">
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
                  className="flex gap-4 py-5 hover:bg-slate-50"
                >
                  <MapPin className="mt-1 size-5 text-blue-600" />
                  <span>
                    <span className="block text-sm text-slate-500">
                      {copy.address}
                    </span>
                    <span className="text-lg font-medium text-blue-700">
                      {selected.address}
                    </span>
                  </span>
                </a>
              )}
              <div className="flex gap-4 py-5">
                <UserRound className="mt-1 size-5 text-blue-600" />
                <span>
                  <span className="block text-sm text-slate-500">
                    {copy.dateOfBirth}
                  </span>
                  <span className="text-lg font-medium text-slate-900">
                    {formatDate(selected.dateOfBirth)}
                  </span>
                </span>
              </div>
              <div className="flex gap-4 py-5">
                <CalendarDays className="mt-1 size-5 text-blue-600" />
                <span>
                  <span className="block text-sm text-slate-500">
                    {copy.membershipDate}
                  </span>
                  <span className="text-lg font-medium text-slate-900">
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
            className="fixed inset-0 z-50 grid cursor-zoom-out place-items-center bg-black/95 p-4"
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
    <main className="safe-page min-h-dvh bg-slate-100 sm:p-6">
      <section className="relative mx-auto min-h-dvh max-w-xl bg-white shadow-xl sm:min-h-0 sm:overflow-hidden sm:rounded-3xl">
        <header className="safe-top sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 pb-3 pt-5 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                {copy.privateAccess}
              </p>
              <h1 className="mt-0.5 text-[26px] font-bold tracking-tight text-slate-950">
                {copy.memberDirectory}
              </h1>
            </div>
            <LanguageSwitcher locale={locale} />
          </div>
          <div className="mt-3 flex items-center gap-2">
            {role !== "member" && (
              <Link
                href="/admin"
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
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
        <p className="px-4 py-3 pr-9 text-sm text-slate-500">
          {query
            ? `${results.length} ${results.length === 1 ? copy.result : copy.results}`
            : `${members.length} ${members.length === 1 ? copy.member : copy.members}`}
        </p>
        <div className="pb-24 pr-7">
          {groups.map(([letter, people]) => (
            <section key={letter} id={`letter-${letter}`}>
              <h2 className="border-b border-slate-200 bg-slate-50 px-4 py-1.5 text-sm font-bold text-slate-500">
                {letter}
              </h2>
              <div className="divide-y divide-slate-100 pl-4">
                {people.map((person) => (
                  <button
                    key={person.id}
                    onClick={() => setSelected(person)}
                    className="flex min-h-[68px] w-full items-center gap-3 py-2.5 pr-2 text-left hover:bg-blue-50"
                  >
                    <Avatar person={person} />
                    <span className="min-w-0 flex-1 truncate text-[17px] font-medium text-slate-950">
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
          <div className="px-5 py-16 text-center text-slate-500">
            {copy.noMembers}
          </div>
        )}
        <nav
          aria-label={
            locale === "uk" ? "Алфавітний покажчик" : "Alphabetical index"
          }
          className="fixed right-[max(0.2rem,calc((100vw-36rem)/2+0.2rem))] top-1/2 z-20 flex -translate-y-1/2 flex-col items-center text-[8px] font-bold leading-[9px] sm:absolute sm:right-1"
        >
          {alphabet.map((letter) =>
            visibleLetters.has(letter) ? (
              <a
                key={letter}
                href={`#letter-${letter}`}
                className="min-w-5 text-center text-blue-600 hover:underline"
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
        <div className="safe-bottom sticky bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 pb-4 pt-3 backdrop-blur">
          <label className="relative block">
            <Search className="absolute left-3 top-3 size-5 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.searchPlaceholder}
              className="min-h-11 w-full rounded-2xl border border-transparent bg-slate-100 py-2.5 pl-10 pr-11 text-base outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
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
          <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="size-3.5" />
            {copy.approvedOnly}
          </p>
        </div>
      </section>
    </main>
  );
}
