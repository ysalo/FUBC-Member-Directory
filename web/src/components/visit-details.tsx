import { CalendarDays, MapPin, FileText, Check, Clock, X } from "lucide-react";
import { formatVisitDate, visitCopy, type Visit } from "@/lib/visitation";
import type { Locale } from "@/lib/i18n";

export default function VisitDetails({
  visit: v,
  locale,
  userId,
}: {
  visit: Visit;
  locale: Locale;
  userId: string;
}) {
  const c = visitCopy(locale),
    recipient = v.visit_recipients.find((r) => r.deacon_id === userId);
  const unseen =
    !!recipient &&
    v.revision > 1 &&
    recipient.last_viewed_revision < v.revision;
  const updated = (field: string) => unseen && v.updated_fields.includes(field);
  return (
    <div className="space-y-5">
      <header>
        <p className="mb-1 text-sm text-[var(--app-muted)]">
          {c.requester}: {v.pastor_name}
        </p>
        <h1 className="break-words text-2xl font-semibold tracking-tight">
          {v.member_name}
        </h1>
        <span className="mt-3 inline-flex rounded-full bg-[var(--app-surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--app-muted)]">
          {c[v.status]}
        </span>
      </header>
      {unseen && (
        <p
          role="status"
          className="rounded-2xl bg-[var(--app-brand-soft)] p-4 text-sm text-[var(--app-ink)]"
        >
          {c.changed}
        </p>
      )}
      <dl className="divide-y divide-[var(--app-line)] overflow-hidden rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)]">
        {[
          {
            label: c.time,
            value: formatVisitDate(v.scheduled_at, locale, "full"),
            field: "scheduled_at",
            Icon: CalendarDays,
          },
          {
            label: c.location,
            value: v.location,
            field: "location",
            Icon: MapPin,
          },
        ].map(({ label, value, field, Icon }) => (
          <div key={field} className="flex gap-3 p-4">
            <Icon
              aria-hidden="true"
              className="mt-1 size-5 shrink-0 text-[var(--app-brand)]"
            />
            <div className="min-w-0">
              <dt className="mb-1 text-xs font-medium text-[var(--app-muted)]">
                {label}
                {updated(field) && (
                  <span className="ml-2 text-[var(--app-brand)]">
                    {c.updated}
                  </span>
                )}
              </dt>
              <dd className="select-text break-words font-medium leading-relaxed">
                {value}
              </dd>
            </div>
          </div>
        ))}
      </dl>
      <section className="rounded-2xl border border-[var(--app-line)] p-4">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <FileText
            aria-hidden="true"
            className="size-4 text-[var(--app-muted)]"
          />
          {c.notes}
          {updated("notes") && (
            <span className="text-xs font-medium text-[var(--app-brand)]">
              {c.updated}
            </span>
          )}
        </h2>
        <p
          className={`select-text whitespace-pre-wrap break-words text-sm leading-relaxed ${!v.notes ? "text-[var(--app-muted)]" : ""}`}
        >
          {v.notes || c.missing}
        </p>
      </section>
      <section>
        <h2 className="mb-3 text-sm font-semibold">{c.recipients}</h2>
        <div className="divide-y divide-[var(--app-line)] rounded-2xl border border-[var(--app-line)]">
          {v.visit_recipients.map((r) => {
            const Icon =
              r.response === "accepted"
                ? Check
                : r.response === "declined"
                  ? X
                  : Clock;
            return (
              <div key={r.deacon_id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 break-words font-medium">
                    {r.deacon_name}
                  </p>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${r.response === "accepted" ? "bg-[var(--app-brand-soft)] text-[var(--app-brand)]" : r.response === "declined" ? "bg-red-50 text-red-700" : "bg-[var(--app-surface-muted)] text-[var(--app-muted)]"}`}
                  >
                    <Icon aria-hidden="true" className="size-3.5" />
                    {c[r.response]}
                  </span>
                </div>
                {r.decline_reason && (
                  <p className="mt-2 select-text break-words text-sm text-[var(--app-muted)]">
                    {r.decline_reason}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
