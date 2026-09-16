"use client";

import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import { mutateGroup } from "@/app/admin/groups/actions";
import { groupCopy, type DeaconGroup } from "@/lib/group-copy";
import { dictionaries, type Locale } from "@/lib/i18n";
import VisitMemberLink from "@/components/visit-member-link";

type Person = {
  id: string;
  first_name: string;
  last_name: string;
  archived_at: string | null;
  photoPath?: string;
};
type Eligible = { id: string; display_name: string; group_id: string | null };
type MemberProfiles = Record<string, { personId: string; photoPath?: string }>;
const field =
  "min-h-11 w-full min-w-0 rounded-lg border border-[var(--app-line)] bg-white px-3";
const button =
  "min-h-11 rounded-lg bg-[var(--app-brand)] px-4 text-sm font-semibold text-white disabled:opacity-50";

function GroupEditor({
  group,
  eligible,
  locale,
  memberProfiles,
}: {
  group?: DeaconGroup;
  eligible: Eligible[];
  locale: Locale;
  memberProfiles: MemberProfiles;
}) {
  const copy = groupCopy(locale);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState([
    group?.deacons[0]?.id ?? "",
    group?.deacons[1]?.id ?? "",
  ]);
  const options = [
    ...eligible.filter(
      (deacon) => !deacon.group_id || deacon.group_id === group?.id,
    ),
    ...(group?.deacons
      .filter((d) => !eligible.some((e) => e.id === d.id))
      .map((d) => ({
        id: d.id,
        display_name: `${d.name} — ${copy.inactive}`,
      })) ?? []),
  ];
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const element = event.currentTarget;
        const form = new FormData(element);
        start(async () => {
          setMessage("");
          try {
            const result = await mutateGroup("save", form);
            setMessage(result.error ?? copy.saved);
            if (!result.error && !group) {
              element.reset();
              setSelected(["", ""]);
            }
          } catch {
            setMessage(copy.failed);
          }
        });
      }}
      className="space-y-3"
    >
      <input type="hidden" name="groupId" value={group?.id ?? ""} />
      <label className="block text-sm font-medium">
        {copy.groupName}
        <input
          name="name"
          required
          maxLength={100}
          defaultValue={group?.name ?? ""}
          className={field + " mt-1"}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        {["firstDeacon", "secondDeacon"].map((name, index) => (
          <div key={name} className="min-w-0 text-sm font-medium">
            <label>
              {index ? copy.secondDeacon : copy.firstDeacon}
              <select
                name={name}
                value={selected[index]}
                onChange={(event) =>
                  setSelected(
                    selected.map((id, i) =>
                      i === index ? event.target.value : id,
                    ),
                  )
                }
                className={field + " mt-1"}
              >
                <option value="">{copy.none}</option>
                {options.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.display_name}
                  </option>
                ))}
              </select>
            </label>
            {selected[index] && (
              <div className="mt-2">
                <VisitMemberLink
                  personId={memberProfiles[selected[index]]?.personId}
                  name={
                    options.find((option) => option.id === selected[index])
                      ?.display_name ?? copy.inactive
                  }
                  photoPath={memberProfiles[selected[index]]?.photoPath}
                  showPhoto
                  locale={locale}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className={button}>
          {pending ? copy.saving : group ? copy.save : copy.create}
        </button>
        <p role="status" className="text-sm text-[var(--app-muted)]">
          {message}
        </p>
      </div>
    </form>
  );
}

function MemberAssignment({
  person,
  original,
  groups,
  locale,
}: {
  person: Person;
  original: string;
  groups: DeaconGroup[];
  locale: Locale;
}) {
  const copy = groupCopy(locale);
  const [target, setTarget] = useState(original);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        if (
          original &&
          original !== target &&
          !window.confirm(target ? copy.transfer : copy.removeConfirm)
        )
          return;
        start(async () => {
          setError("");
          try {
            const result = await mutateGroup("assign", form);
            setError(result.error ?? "");
          } catch {
            setError(copy.failed);
          }
        });
      }}
      className="space-y-2 border-b border-[var(--app-line)] py-4"
    >
      <input type="hidden" name="personId" value={person.id} />
      <input type="hidden" name="expectedGroup" value={original} />
      <p className="font-medium">
        <VisitMemberLink
          personId={person.archived_at ? null : person.id}
          name={`${person.first_name} ${person.last_name}`}
          photoPath={person.photoPath}
          showPhoto
          locale={locale}
        />
        {person.archived_at && (
          <span className="ml-2 text-xs text-[var(--app-muted)]">
            {copy.archived}
          </span>
        )}
      </p>
      <div className="flex gap-2">
        <select
          aria-label={`${person.first_name} ${person.last_name} — ${copy.groups}`}
          name="groupId"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className={field + " flex-1"}
        >
          <option value="">{copy.unassigned}</option>
          {!person.archived_at &&
            groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          {person.archived_at && original && (
            <option value={original}>
              {groups.find((g) => g.id === original)?.name}
            </option>
          )}
        </select>
        <button disabled={pending || target === original} className={button}>
          {pending ? copy.saving : copy.save}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-[var(--app-danger)]">
          {error}
        </p>
      )}
    </form>
  );
}

function DeleteGroup({
  group,
  locale,
}: {
  group: DeaconGroup;
  locale: Locale;
}) {
  const copy = groupCopy(locale);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <div className="mt-3">
      <button
        disabled={pending}
        className="min-h-11 text-sm text-[var(--app-danger)]"
        onClick={() => {
          if (!window.confirm(copy.deleteConfirm)) return;
          const form = new FormData();
          form.set("groupId", group.id);
          start(async () => {
            try {
              const result = await mutateGroup("delete", form);
              setError(result.error ?? "");
            } catch {
              setError(copy.failed);
            }
          });
        }}
      >
        {copy.delete}
      </button>
      {error && (
        <p role="alert" className="text-sm text-[var(--app-danger)]">
          {error}
        </p>
      )}
    </div>
  );
}

export default function GroupManagement({
  groups,
  people,
  eligible,
  locale,
  memberProfiles,
}: {
  groups: DeaconGroup[];
  people: Person[];
  eligible: Eligible[];
  locale: Locale;
  memberProfiles: MemberProfiles;
}) {
  const copy = groupCopy(locale);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const assignment = new Map(
    groups.flatMap((group) =>
      group.memberIds.map((id) => [id, group.id] as const),
    ),
  );
  const members = people.filter(
    (person) =>
      (!person.archived_at || assignment.has(person.id)) &&
      `${person.first_name} ${person.last_name} ${person.last_name} ${person.first_name}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()) &&
      (filter === "all" ||
        (filter === "unassigned"
          ? !assignment.has(person.id)
          : assignment.get(person.id) === filter)),
  );
  return (
    <div className="mt-6 space-y-6">
      <p className="text-sm text-[var(--app-muted)]">{copy.guideline}</p>
      <section className="rounded-2xl bg-white p-4 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold">{copy.create}</h2>
        <GroupEditor
          eligible={eligible}
          locale={locale}
          memberProfiles={memberProfiles}
        />
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((group) => (
          <section key={group.id} className="rounded-2xl bg-white p-4 sm:p-6">
            <h2 className="mb-3 text-lg font-semibold">
              {group.name}{" "}
              <span className="text-sm font-normal text-[var(--app-muted)]">
                · {group.memberIds.length} {dictionaries[locale].members}
              </span>
            </h2>
            {(group.deacons.length < 2 ||
              group.deacons.some((d) => d.status !== "active")) && (
              <p className="mb-3 text-sm text-[var(--app-muted)]">
                {copy.incomplete}
              </p>
            )}
            <GroupEditor
              key={`${group.name}:${group.deacons.map((d) => d.id).join(":")}`}
              group={group}
              eligible={eligible}
              locale={locale}
              memberProfiles={memberProfiles}
            />
            {!group.memberIds.length && !group.deacons.length && (
              <DeleteGroup group={group} locale={locale} />
            )}
          </section>
        ))}
      </div>
      <section className="rounded-2xl bg-white p-4 sm:p-6">
        <h2 className="text-lg font-semibold">{copy.assignments}</h2>
        <label className="directory-search mt-3 flex min-h-11 items-center gap-3">
          <Search className="size-5 text-[var(--app-muted)]" />
          <input
            aria-label={dictionaries[locale].searchPlaceholder}
            placeholder={dictionaries[locale].searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-h-11 min-w-0 flex-1 bg-transparent"
          />
        </label>
        <select
          aria-label={copy.groups}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className={field + " mt-3"}
        >
          <option value="all">{copy.all}</option>
          <option value="unassigned">{copy.unassigned}</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
        {members.map((person) => (
          <MemberAssignment
            key={`${person.id}:${assignment.get(person.id) ?? ""}`}
            person={person}
            original={assignment.get(person.id) ?? ""}
            groups={groups}
            locale={locale}
          />
        ))}
        {!members.length && (
          <p className="py-6 text-center text-sm text-[var(--app-muted)]">
            {copy.noMembers}
          </p>
        )}
      </section>
    </div>
  );
}
