"use client";

import { useState } from "react";
import { ChevronRight, Search, UsersRound } from "lucide-react";
import Link from "@/components/navigation-link";
import { groupCopy, type DeaconGroup } from "@/lib/group-copy";
import type { Locale } from "@/lib/i18n";
import type { DirectoryPerson } from "@/components/directory-client";
import MemberPhoto from "@/components/member-photo";

export default function GroupsBrowser({
  groups,
  ledGroupId,
  isDeacon,
  locale,
  deacons,
}: {
  groups: DeaconGroup[];
  ledGroupId?: string;
  isDeacon: boolean;
  locale: Locale;
  deacons: DirectoryPerson[];
}) {
  const [search, setSearch] = useState("");
  const copy = groupCopy(locale);
  const led = groups.find((group) => group.id === ledGroupId);
  const normalize = (value: string) =>
    value.normalize("NFKC").toLocaleLowerCase(locale).trim();
  const others = groups.filter(
    (group) =>
      group.id !== ledGroupId &&
      normalize(group.name).includes(normalize(search)),
  );
  const uk = locale === "uk";
  const deaconLinks = (group: DeaconGroup) => (
    <div className="mt-3 space-y-1">
      {group.deacons.length ? (
        group.deacons.map((deacon) => {
          const person = deacons.find(
            (person) => person.id === deacon.personId,
          );
          const content = (
            <>
              <MemberPhoto
                name={person?.name || deacon.name}
                photoPath={person?.photoPath}
              />
              <span className="min-w-0 flex-1 break-words">
                <span className="block font-medium">
                  {person?.name || deacon.name}
                </span>
                <span className="block text-xs text-[var(--app-muted)]">
                  {copy.deacon}
                  {deacon.status !== "active" ? ` · ${copy.inactive}` : ""}
                  {!person
                    ? ` · ${uk ? "Профіль не пов’язано" : "Profile not linked"}`
                    : ""}
                </span>
              </span>
            </>
          );
          return person ? (
            <Link
              key={deacon.id}
              href={`/members/${person.id}?group=${group.id}`}
              className="flex min-h-14 items-center gap-3 rounded-xl px-2 py-2 text-sm hover:bg-[var(--app-surface-muted)]"
            >
              {content}
              <ChevronRight
                aria-hidden="true"
                className="size-4 shrink-0 text-[var(--app-muted)]"
              />
            </Link>
          ) : (
            <div
              key={deacon.id}
              className="flex min-h-14 items-center gap-3 px-2 py-2 text-sm"
            >
              {content}
            </div>
          );
        })
      ) : (
        <p className="text-sm text-[var(--app-muted)]">{copy.none}</p>
      )}
    </div>
  );
  return (
    <div className="native-scroll min-h-0 flex-1 overflow-y-auto">
      {led && (
        <section className="px-5 pt-2 pb-8">
          <h2 className="mb-3 text-2xl font-bold tracking-tight">
            {copy.myGroups}
          </h2>
          <div className="rounded-3xl border border-[var(--app-line)] bg-[var(--app-brand-soft)] p-5 text-[var(--app-ink)]">
            <Link
              href={`/groups/${led.id}`}
              className="flex min-h-20 items-center gap-4"
            >
              <span className="min-w-0 flex-1">
                <UsersRound
                  className="mb-3 size-7 text-[var(--app-brand)]"
                  strokeWidth={1.5}
                />
                <span className="block break-words text-2xl font-semibold leading-tight">
                  {led.name}
                </span>
              </span>
              <ChevronRight className="size-6 shrink-0 text-[var(--app-brand)]" />
            </Link>
            {deaconLinks(led)}
          </div>
        </section>
      )}
      {isDeacon && !led && (
        <p className="px-5 pb-6 text-sm text-[var(--app-muted)]">
          {copy.noGroups}
        </p>
      )}
      <section className="pb-6">
        <h2 className="px-5 text-sm font-semibold text-[var(--app-muted)]">
          {led ? copy.otherGroups : copy.browseGroups}
        </h2>
        <label className="directory-search mx-5 mt-2 mb-2 flex min-h-11 items-center gap-2 text-[var(--app-muted)]">
          <Search className="size-5 shrink-0" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={uk ? "Пошук груп" : "Search groups"}
            aria-label={uk ? "Пошук груп за назвою" : "Search groups by name"}
            className="min-h-11 w-full min-w-0 bg-transparent text-base text-[var(--app-ink)] outline-none"
          />
        </label>
        {others.map((group) => (
          <article
            key={group.id}
            className="mx-5 border-b border-[var(--app-line)] py-4"
          >
            <Link
              href={`/groups/${group.id}`}
              className="flex min-h-11 items-center gap-3 rounded-xl hover:bg-[var(--app-surface-muted)]"
            >
              <UsersRound
                className="size-5 shrink-0 text-[var(--app-muted)]"
                strokeWidth={1.5}
              />
              <span className="min-w-0 flex-1">
                <span className="block break-words font-medium">
                  {group.name}
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-[var(--app-muted)]" />
            </Link>
            {deaconLinks(group)}
          </article>
        ))}
        {!others.length && (
          <p className="px-5 py-8 text-center text-sm text-[var(--app-muted)]">
            {search
              ? uk
                ? "Груп за вашим запитом не знайдено."
                : "No groups match your search."
              : groups.length
                ? uk
                  ? "Інших груп поки немає."
                  : "No other groups yet."
                : copy.noGroupList}
          </p>
        )}
      </section>
    </div>
  );
}
