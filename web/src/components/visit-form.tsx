"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { mutateVisit } from "@/app/visitation/actions";
import {
  localVisitTime,
  visitCopy,
  type Visit,
  type VisitDeacon,
} from "@/lib/visitation";
import type { Locale } from "@/lib/i18n";
type VisitMember = {
  id: string;
  name: string;
  address: string;
  groupId: string | null;
};
export default function VisitForm({
  member,
  deacons,
  visit,
  locale,
  submission,
  members = [],
}: {
  member?: VisitMember;
  members?: VisitMember[];
  deacons: VisitDeacon[];
  visit?: Visit;
  locale: Locale;
  submission: string;
}) {
  const c = visitCopy(locale),
    router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [person, setPerson] = useState(member);
  const [choosing, setChoosing] = useState(!member);
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState(
    visit?.location ?? member?.address ?? "",
  );
  const [selected, setSelected] = useState(
    visit
      ? visit.visit_recipients.map((r) => r.deacon_id)
      : deacons
          .filter((d) => member?.groupId && d.group_id === member.groupId)
          .map((d) => d.id),
  );
  const input =
    "mt-2 block min-h-12 min-w-0 w-full max-w-full rounded-xl border border-[var(--app-line)] bg-[var(--app-surface)] p-3 text-[var(--app-ink)]";
  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const data = new FormData(e.currentTarget);
        try {
          const result = await mutateVisit("save", data);
          if (result.error) setError(result.error);
          else {
            window.dispatchEvent(new Event("visitation-updated"));
            router.push("/visitation/" + (result.id || visit?.id));
            router.refresh();
          }
        } catch {
          setError(c.failed);
        } finally {
          setBusy(false);
        }
      }}
    >
      <input type="hidden" name="id" value={visit?.id || ""} />
      <input type="hidden" name="revision" value={visit?.revision || ""} />
      <input type="hidden" name="personId" value={person?.id ?? ""} />
      <input type="hidden" name="submission" value={submission} />
      <fieldset disabled={busy} className="min-w-0 space-y-5">
        <label className="block font-medium">
          {c.time}
          <input
            type="datetime-local"
            name="time"
            required
            defaultValue={visit ? localVisitTime(visit.scheduled_at) : ""}
            className={`${input} visit-date-input`}
          />
        </label>
        {!member && !visit ? (
          <section className="min-w-0" aria-label={c.person}>
            <h2 className="font-medium">{c.person}</h2>
            <button
              type="button"
              aria-expanded={choosing}
              onClick={() => setChoosing(!choosing)}
              className={`${input} flex items-center justify-between gap-3 text-left`}
            >
              <span className="break-words">
                {person?.name ?? c.choosePerson}
              </span>
              <span className="shrink-0 text-sm text-[var(--app-brand)]">
                {person ? c.change : "⌄"}
              </span>
            </button>
            {choosing && (
              <div className="mt-3 rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-3">
                <label className="block text-sm font-medium">
                  {c.searchPeople}
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className={input}
                  />
                </label>
                <div className="mt-2 max-h-64 overflow-y-auto overscroll-contain">
                  {members
                    .filter((m) =>
                      m.name
                        .toLocaleLowerCase(locale)
                        .includes(query.trim().toLocaleLowerCase(locale)),
                    )
                    .map((m) => (
                      <button
                        type="button"
                        key={m.id}
                        aria-pressed={person?.id === m.id}
                        className="flex min-h-12 w-full items-center justify-between gap-3 border-b border-[var(--app-line)] px-2 py-3 text-left hover:bg-[var(--app-brand-soft)]"
                        onClick={() => {
                          setPerson(m);
                          setLocation(m.address);
                          setSelected(
                            deacons
                              .filter(
                                (d) => m.groupId && d.group_id === m.groupId,
                              )
                              .map((d) => d.id),
                          );
                          setChoosing(false);
                          setQuery("");
                        }}
                      >
                        <span className="break-words">{m.name}</span>
                        {person?.id === m.id && (
                          <span aria-hidden="true">✓</span>
                        )}
                      </button>
                    ))}
                  {!members.some((m) =>
                    m.name
                      .toLocaleLowerCase(locale)
                      .includes(query.trim().toLocaleLowerCase(locale)),
                  ) && (
                    <p
                      role="status"
                      className="p-3 text-sm text-[var(--app-muted)]"
                    >
                      {c.noResults}
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>
        ) : (
          <section className="rounded-2xl bg-[var(--app-surface-muted)] p-4">
            <h2 className="text-xl font-semibold break-words">
              {person?.name}
            </h2>
          </section>
        )}
        {person && (
          <>
            {!visit && (
              <fieldset className="rounded-2xl border border-[var(--app-line)] p-4">
                <legend className="px-1 font-semibold">{c.recipients}</legend>
                {!deacons.length ? (
                  <p>{c.noDeacons}</p>
                ) : (
                  <>
                    {!deacons.some(
                      (d) => person.groupId && d.group_id === person.groupId,
                    ) && (
                      <p className="mb-3 text-sm text-[var(--app-muted)]">
                        {c.noGroup}
                      </p>
                    )}
                    {[...deacons]
                      .sort(
                        (a, b) =>
                          Number(b.group_id === person.groupId) -
                          Number(a.group_id === person.groupId),
                      )
                      .map((d) => (
                        <label
                          key={d.id}
                          className="flex min-h-12 items-center gap-3 break-words"
                        >
                          <input
                            type="checkbox"
                            name="deacon"
                            value={d.id}
                            checked={selected.includes(d.id)}
                            disabled={
                              !selected.includes(d.id) && selected.length >= 2
                            }
                            onChange={(e) =>
                              setSelected(
                                e.target.checked
                                  ? [...selected, d.id]
                                  : selected.filter((id) => id !== d.id),
                              )
                            }
                            className="size-5 shrink-0"
                          />
                          {d.name}
                        </label>
                      ))}
                  </>
                )}
              </fieldset>
            )}
            <label className="block font-medium">
              {c.location}
              <input
                name="location"
                required
                maxLength={1000}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className={input}
              />
            </label>
            <label className="block font-medium">
              {c.notes}{" "}
              <span className="text-sm font-normal">({c.optional})</span>
              <textarea
                name="notes"
                rows={4}
                maxLength={5000}
                defaultValue={visit?.notes || ""}
                className={input}
              />
            </label>
          </>
        )}
        <button
          disabled={!person || (!visit && !selected.length)}
          className="min-h-12 w-full rounded-xl bg-[var(--app-brand)] px-4 py-3 font-semibold text-white disabled:opacity-50"
        >
          {busy ? c.saving : visit ? c.save : c.submit}
        </button>
      </fieldset>
      {error && (
        <p role="alert" className="select-text text-red-600">
          {error}
        </p>
      )}
    </form>
  );
}
