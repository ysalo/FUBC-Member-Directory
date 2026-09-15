"use client";

import {
  CalendarDays,
  Cake,
  ChevronRight,
  MapPin,
  Phone,
  Search,
  ListFilter,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import BottomNavigation from "@/components/bottom-navigation";
import BirthdayNotificationDemo from "@/components/birthday-notification-demo";
import Link from "@/components/navigation-link";
import { groupCopy, type DeaconGroup } from "@/lib/group-copy";
import { upcomingBirthdays, ageOn, membershipDuration } from "@/lib/birthdays";
import type { AppRole } from "@/lib/auth";
import { useEffect, useMemo, useRef, useState } from "react";
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
  maritalStatus: "single" | "married" | "widowed" | null;
  isOrphan: boolean;
  ministryRoles?: ("deacon" | "pastor")[];
  groupName: string;
  groupId: string | null;
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
  isDeacon = false,
  isPastor = false,
  deaconGroups,
  today = "",
  showBirthdays = false,
  birthdayNotificationKey,
}: {
  members: DirectoryPerson[];
  role: AppRole;
  locale: Locale;
  isDeacon?: boolean;
  isPastor?: boolean;
  deaconGroups?: DeaconGroup[];
  today?: string;
  showBirthdays?: boolean;
  birthdayNotificationKey?: string;
}) {
  const copy = dictionaries[locale];
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<DirectoryPerson | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [unlinkedDeacon, setUnlinkedDeacon] = useState<string | null>(null);
  const [view, setView] = useState<"members" | "birthdays">("members");
  const [badgeFilters, setBadgeFilters] = useState({
    widowed: false,
    orphan: false,
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const activeFilterCount =
    Number(badgeFilters.widowed) + Number(badgeFilters.orphan);
  useEffect(() => {
    if (!filtersOpen) return;
    const outside = (event: PointerEvent) => {
      if (!filterRef.current?.contains(event.target as Node))
        setFiltersOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFiltersOpen(false);
        filterButtonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [filtersOpen]);
  const listRef = useRef<HTMLDivElement>(null);
  const savedScroll = useRef(0);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const labels = groupCopy(locale);
  const scopeGroups = deaconGroups;
  const scopedMembers = useMemo(() => {
    const scopeIds = new Set(scopeGroups?.flatMap((group) => group.memberIds));
    return deaconGroups
      ? members.filter((person) => scopeIds.has(person.id))
      : members;
  }, [scopeGroups, deaconGroups, members]);
  const memberCounts = [
    { label: labels.totalMembers, count: scopedMembers.length },
    {
      label: labels.orphanCount,
      count: scopedMembers.filter((person) => person.isOrphan).length,
    },
    {
      label: labels.widowedCount,
      count: scopedMembers.filter(
        (person) => person.maritalStatus === "widowed",
      ).length,
    },
  ];
  const birthdays = today ? upcomingBirthdays(scopedMembers, today) : [];
  const openMember = (person: DirectoryPerson) => {
    savedScroll.current = listRef.current?.scrollTop ?? 0;
    setSelected(person);
  };
  const returnToDirectory = () => {
    setPhotoOpen(false);
    setSelected(null);
  };
  useEffect(() => {
    if (!selected && !unlinkedDeacon && listRef.current)
      listRef.current.scrollTop = savedScroll.current;
  }, [selected, unlinkedDeacon]);

  const dateLocale = locale === "uk" ? "uk-UA" : "en-US";
  const tenure = selected
    ? membershipDuration(selected.membershipJoinedAt, today)
    : null;
  const tenureLabel = tenure
    ? [
        tenure.years
          ? new Intl.NumberFormat(dateLocale, {
              style: "unit",
              unit: "year",
              unitDisplay: "long",
            }).format(tenure.years)
          : "",
        tenure.months
          ? new Intl.NumberFormat(dateLocale, {
              style: "unit",
              unit: "month",
              unitDisplay: "long",
            }).format(tenure.months)
          : "",
      ]
        .filter(Boolean)
        .join(", ") || labels.lessThanMonth
    : "";
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
    const sorted = scopedMembers
      .filter(
        (person) =>
          !activeFilterCount ||
          (badgeFilters.widowed && person.maritalStatus === "widowed") ||
          (badgeFilters.orphan && person.isOrphan),
      )
      .sort(
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
  }, [scopedMembers, nameLocale, query, badgeFilters, activeFilterCount]);
  const visibleBirthdays = birthdays.filter((birthday) =>
    results.some((person) => person.id === birthday.id),
  );
  const ministryBadges = (person: DirectoryPerson) => (
    <span className="inline-flex shrink-0 self-center flex-wrap items-center gap-1 text-[11px] font-semibold leading-none tracking-normal">
      {(["deacon", "pastor"] as const)
        .filter((role) => person.ministryRoles?.includes(role))
        .map((role) => (
          <span
            key={role}
            className="inline-flex min-h-5 items-center justify-center rounded-full bg-[var(--app-brand-soft)] px-2 py-1 text-[var(--app-brand)]"
          >
            {labels[role]}
          </span>
        ))}
    </span>
  );
  const badges = (person: DirectoryPerson) => (
    <span className="flex flex-wrap gap-2 text-xs font-medium text-[var(--app-muted)]">
      {person.maritalStatus === "widowed" && (
        <span className="rounded-full bg-[var(--app-surface-muted)] px-2 py-0.5">
          {labels.widowed}
        </span>
      )}
      {person.isOrphan && (
        <span className="rounded-full bg-[var(--app-surface-muted)] px-2 py-0.5">
          {labels.orphan}
        </span>
      )}
    </span>
  );

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

  if (unlinkedDeacon)
    return (
      <main className="fixed inset-0 h-dvh bg-[var(--app-bg)] sm:p-6">
        <section className="safe-top native-enter mx-auto h-full max-w-xl bg-white px-5 sm:rounded-[2rem]">
          <button
            onClick={() => setUnlinkedDeacon(null)}
            aria-label={labels.backToGroups}
            className="grid size-11 place-items-center text-2xl"
          >
            ←
          </button>
          <h1 className="mt-5 text-2xl font-semibold">{unlinkedDeacon}</h1>
          <p className="mt-6 flex items-center gap-3 text-[var(--app-muted)]">
            <Phone className="size-5" />
            {copy.phone}: {copy.notProvided}
          </p>
        </section>
      </main>
    );

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
                  className="pointer-events-none absolute inset-0 backdrop-blur-[24px]"
                  style={{
                    maskImage:
                      "linear-gradient(to bottom, transparent 45%, rgba(0, 0, 0, 0.015) 53%, rgba(0, 0, 0, 0.055) 60%, rgba(0, 0, 0, 0.14) 67%, rgba(0, 0, 0, 0.28) 74%, rgba(0, 0, 0, 0.48) 81%, rgba(0, 0, 0, 0.72) 88%, rgba(0, 0, 0, 0.93) 95%, black 100%)",
                    WebkitMaskImage:
                      "linear-gradient(to bottom, transparent 45%, rgba(0, 0, 0, 0.015) 53%, rgba(0, 0, 0, 0.055) 60%, rgba(0, 0, 0, 0.14) 67%, rgba(0, 0, 0, 0.28) 74%, rgba(0, 0, 0, 0.48) 81%, rgba(0, 0, 0, 0.72) 88%, rgba(0, 0, 0, 0.93) 95%, black 100%)",
                  }}
                />
              )}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(7,19,29,0.12)_0%,transparent_22%,transparent_48%,rgba(7,19,29,0.01)_56%,rgba(7,19,29,0.04)_64%,rgba(7,19,29,0.10)_72%,rgba(7,19,29,0.22)_80%,rgba(7,19,29,0.42)_88%,rgba(7,19,29,0.65)_95%,rgba(7,19,29,0.82)_100%)]"
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
                <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[30px] font-bold leading-tight tracking-[-0.025em] text-white drop-shadow-md min-[375px]:text-[34px]">
                  <span>{selected.name}</span>
                  {ministryBadges(selected)}
                </h1>
              </div>
            </div>
            <div className="mx-5 mb-10 mt-7 space-y-7 sm:mx-7">
              {badges(selected)}
              {isPastor && (
                <Link
                  href={`/visitation/new?person=${selected.id}`}
                  className="flex min-h-12 items-center justify-center rounded-xl bg-[var(--app-brand)] px-4 py-3 font-semibold text-white"
                >
                  {locale === "uk" ? "Запросити відвідування" : "Request visit"}
                </Link>
              )}
              <div className="flex min-h-14 items-center gap-4 py-1">
                <UserRound className="size-5 shrink-0 text-slate-400" />
                <span>
                  <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
                    {labels.maritalStatus}
                  </span>
                  <span className="mt-0.5 block text-[17px]">
                    {selected.maritalStatus
                      ? labels[selected.maritalStatus]
                      : copy.notProvided}
                  </span>
                </span>
              </div>
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
              {!selected.phone && (
                <div className="flex min-h-14 items-center gap-4 py-1">
                  <Phone className="size-5 shrink-0 text-slate-400" />
                  <span>
                    <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
                      {copy.phone}
                    </span>
                    <span className="mt-0.5 block text-[17px]">
                      {copy.notProvided}
                    </span>
                  </span>
                </div>
              )}
              <div className="flex min-h-14 items-center gap-4 py-1">
                <UserRound className="size-5 shrink-0 text-slate-400" />
                <span>
                  <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
                    {ageOn(selected.dateOfBirth, today) !== null
                      ? labels.age
                      : copy.dateOfBirth}
                  </span>
                  <span className="mt-0.5 block text-[17px] text-[var(--app-ink)]">
                    {ageOn(selected.dateOfBirth, today) !== null ? (
                      <>
                        <span className="text-xl font-semibold">
                          {ageOn(selected.dateOfBirth, today)}
                        </span>
                        <span className="mt-0.5 block text-sm text-[var(--app-muted)]">
                          {formatDate(selected.dateOfBirth)}
                        </span>
                      </>
                    ) : (
                      formatDate(selected.dateOfBirth)
                    )}
                  </span>
                </span>
              </div>
              <div className="flex min-h-14 items-center gap-4 py-1">
                <CalendarDays className="size-5 shrink-0 text-slate-400" />
                <span>
                  <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
                    {tenure ? labels.memberFor : copy.membershipDate}
                  </span>
                  <span className="mt-0.5 block text-[17px] text-[var(--app-ink)]">
                    {tenure ? (
                      <>
                        <span className="text-xl font-semibold">
                          {tenureLabel}
                        </span>
                        <span className="mt-0.5 block text-sm text-[var(--app-muted)]">
                          {formatDate(selected.membershipJoinedAt)}
                        </span>
                      </>
                    ) : (
                      formatDate(selected.membershipJoinedAt)
                    )}
                  </span>
                </span>
              </div>
              <div className="flex min-h-14 items-center gap-4 py-1">
                <UserRound className="size-5 shrink-0 text-slate-400" />
                <span>
                  <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
                    {labels.assignedGroup}
                  </span>
                  {selected.groupId && selected.groupName ? (
                    <Link
                      href={`/groups/${selected.groupId}`}
                      className="mt-0.5 inline-flex min-h-11 items-center gap-1 text-[17px] text-[var(--app-accent)] hover:underline"
                    >
                      {selected.groupName}
                      <ChevronRight
                        aria-hidden="true"
                        className="size-4 shrink-0"
                      />
                    </Link>
                  ) : (
                    <span className="mt-0.5 block text-[17px]">
                      {selected.groupName || labels.unassigned}
                    </span>
                  )}
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

  const searchBar = (
    <div className="z-30 flex-none border-b border-[var(--app-line)] bg-white/92 px-4 backdrop-blur-xl">
      <div className="directory-search flex min-h-11 items-center gap-3 px-1">
        <Search className="size-5 shrink-0 text-slate-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={copy.searchPlaceholder}
          aria-label={copy.searchPlaceholder}
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
        <div ref={filterRef} className="relative shrink-0">
          <button
            ref={filterButtonRef}
            aria-label={`${labels.filters}${activeFilterCount ? ` (${activeFilterCount})` : ""}`}
            aria-expanded={filtersOpen}
            aria-controls="badge-filters"
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={`relative grid size-11 place-items-center ${activeFilterCount ? "text-[var(--app-brand)]" : "text-slate-400"}`}
          >
            <ListFilter className="size-5" />
            {!!activeFilterCount && (
              <span
                aria-hidden
                className="absolute right-0.5 top-0.5 grid size-4 place-items-center rounded-full bg-[var(--app-brand)] text-[10px] text-white"
              >
                {activeFilterCount}
              </span>
            )}
          </button>
          {filtersOpen && (
            <section
              id="badge-filters"
              aria-label={labels.filters}
              className="absolute right-0 top-full z-40 mt-1 w-[min(17rem,calc(100vw-2rem))] rounded-2xl border border-[var(--app-line)] bg-white p-4 shadow-xl"
            >
              <h2 className="text-sm font-semibold">{labels.filters}</h2>
              <p className="mt-1 text-xs text-[var(--app-muted)]">
                {labels.filterHint}
              </p>
              {(["widowed", "orphan"] as const).map((badge) => (
                <label
                  key={badge}
                  className="flex min-h-11 items-center gap-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={badgeFilters[badge]}
                    onChange={(event) =>
                      setBadgeFilters({
                        ...badgeFilters,
                        [badge]: event.target.checked,
                      })
                    }
                    className="size-5 accent-[var(--app-brand)]"
                  />
                  {labels[badge]}
                </label>
              ))}
              <button
                onClick={() =>
                  setBadgeFilters({ widowed: false, orphan: false })
                }
                className="min-h-11 text-sm text-[var(--app-muted)]"
              >
                {labels.clearFilters}
              </button>
            </section>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <main className="fixed inset-0 h-dvh overflow-hidden overscroll-none bg-[var(--app-bg)] sm:p-6">
      <section className="native-enter native-shadow relative mx-auto flex h-full max-w-xl flex-col overflow-hidden bg-white sm:rounded-[2rem]">
        <div className="safe-top flex-none bg-white px-4 pb-1">
          <h1 className="sr-only">
            {deaconGroups ? labels.myGroups : copy.memberDirectory}
          </h1>
          {deaconGroups && (
            <Link
              href="/groups"
              aria-label={labels.backToGroups}
              className="flex min-h-11 w-fit items-center gap-2 text-sm text-[var(--app-brand)]"
            >
              <span aria-hidden className="text-xl">
                ←
              </span>
              {labels.browseGroups}
            </Link>
          )}
        </div>
        {!deaconGroups && searchBar}
        <div
          ref={listRef}
          className="native-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white"
        >
          {deaconGroups && (
            <div className="space-y-5 px-4 py-4">
              {!deaconGroups.length && (
                <p className="py-6 text-center text-sm text-[var(--app-muted)]">
                  {labels.noGroups}
                </p>
              )}
              {scopeGroups?.map((group) => (
                <section key={group.id}>
                  <h2 className="break-words text-xl font-semibold leading-tight">
                    {group.name}
                  </h2>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
                    {labels.responsibleDeacons}
                  </p>
                  {group.deacons.map((deacon) => (
                    <button
                      key={deacon.id}
                      disabled={deacon.status !== "active"}
                      onClick={() => {
                        const person = members.find(
                          (person) => person.id === deacon.personId,
                        );
                        if (person) openMember(person);
                        else {
                          savedScroll.current = listRef.current?.scrollTop ?? 0;
                          setUnlinkedDeacon(deacon.name);
                        }
                      }}
                      className="flex min-h-14 w-full items-center justify-between gap-3 py-2 text-left text-sm disabled:text-[var(--app-muted)]"
                    >
                      <span>
                        {deacon.name}
                        {deacon.status !== "active" && (
                          <span> — {labels.inactive}</span>
                        )}
                      </span>
                      {deacon.status === "active" && (
                        <ChevronRight className="size-5 shrink-0 text-slate-300" />
                      )}
                    </button>
                  ))}
                  {group.deacons.length < 2 && (
                    <div className="text-sm text-[var(--app-muted)]">
                      {Array.from(
                        { length: 2 - group.deacons.length },
                        (_, index) => (
                          <p key={index} className="flex min-h-11 items-center">
                            {labels.deacon}: {labels.none}
                          </p>
                        ),
                      )}
                    </div>
                  )}
                </section>
              ))}
              <div className="-mx-4">
                {deaconGroups && showBirthdays && (
                  <div className="pb-1">
                    <div
                      className="mx-4 flex rounded-xl bg-[var(--app-surface-muted)] p-1"
                      aria-label={labels.myGroups}
                    >
                      {(["members", "birthdays"] as const).map((tab) => (
                        <button
                          key={tab}
                          aria-pressed={view === tab}
                          onClick={() => setView(tab)}
                          className={`flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-2 transition-colors ${view === tab ? "bg-white text-[var(--app-brand)] shadow-sm" : "text-[var(--app-muted)]"}`}
                        >
                          {tab === "members" ? (
                            <UsersRound
                              aria-hidden="true"
                              className="size-4 shrink-0"
                            />
                          ) : (
                            <Cake
                              aria-hidden="true"
                              className="size-4 shrink-0"
                            />
                          )}
                          <span className="text-sm font-medium">
                            {tab === "members"
                              ? labels.membersTab
                              : labels.birthdays}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {searchBar}
              </div>
              {!!deaconGroups.length &&
                showBirthdays &&
                view === "birthdays" && (
                  <section>
                    {birthdayNotificationKey && (
                      <BirthdayNotificationDemo
                        preferenceKey={birthdayNotificationKey}
                        locale={locale}
                      />
                    )}
                    <h2 className="font-semibold">{labels.upcoming}</h2>
                    <p className="mt-1 text-xs text-[var(--app-muted)]">
                      {labels.next30}
                    </p>
                    {visibleBirthdays.map((birthday) => {
                      const person = members.find(
                        (member) => member.id === birthday.id,
                      )!;
                      return (
                        <button
                          key={birthday.id}
                          onClick={() => openMember(person)}
                          className="flex min-h-11 w-full items-center justify-between gap-3 text-left text-sm"
                        >
                          <span>
                            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              {person.name}
                              {ministryBadges(person)}
                            </span>
                            {badges(person)}
                          </span>
                          <span className="shrink-0 text-[var(--app-muted)]">
                            {new Intl.DateTimeFormat(dateLocale, {
                              month: "short",
                              day: "numeric",
                              timeZone: "UTC",
                            }).format(new Date(birthday.date + "T00:00:00Z"))}
                          </span>
                        </button>
                      );
                    })}
                    {!visibleBirthdays.length && (
                      <p className="mt-3 text-sm text-[var(--app-muted)]">
                        {labels.noBirthdays}
                      </p>
                    )}
                  </section>
                )}
            </div>
          )}
          {view === "members" && (
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
                        onClick={() => openMember(person)}
                        className="flex min-h-[68px] w-full items-center gap-3 py-2.5 pr-2 text-left hover:bg-[var(--app-brand-soft)] active:bg-[#d9e9f3]"
                      >
                        <Avatar person={person} />
                        <span className="min-w-0 flex-1 text-[17px] font-medium text-[var(--app-ink)]">
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span>
                              {person.firstName}{" "}
                              <span className="font-semibold">
                                {person.lastName}
                              </span>
                            </span>
                            {ministryBadges(person)}
                          </span>
                          {badges(person)}
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
          )}
          {view === "members" && !results.length && (
            <div className="px-5 py-16 text-center text-[var(--app-muted)]">
              {copy.noMembers}
            </div>
          )}
          <dl className="mx-4 my-5 grid grid-cols-3 gap-2 rounded-xl bg-[var(--app-surface-muted)] px-2 py-4 text-center">
            {memberCounts.map(({ label, count }) => (
              <div key={label} className="flex min-w-0 flex-col gap-1">
                <dt className="text-xs text-[var(--app-muted)]">{label}</dt>
                <dd className="order-first text-lg font-semibold tabular-nums text-[var(--app-ink)]">
                  {count}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <BottomNavigation
          role={role}
          isDeacon={isDeacon}
          isPastor={isPastor}
          locale={locale}
        />
      </section>
    </main>
  );
}
