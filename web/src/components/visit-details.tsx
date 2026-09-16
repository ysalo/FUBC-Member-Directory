import {
  CalendarDays,
  MapPin,
  FileText,
  Check,
  Clock,
  X,
  Phone,
} from "lucide-react";
import { formatVisitDate, visitCopy, type Visit } from "@/lib/visitation";
import type { Locale } from "@/lib/i18n";
import VisitMemberLink from "@/components/visit-member-link";

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
          {c.requester}:{" "}
          <VisitMemberLink
            personId={v.pastor_person_id}
            name={v.pastor_name}
            photoPath={v.pastor_photo}
            locale={locale}
          />
        </p>
        <div className="flex items-center gap-3">
          <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight">
            <VisitMemberLink
              personId={v.member_available === false ? null : v.person_id}
              name={v.member_name}
              photoPath={v.member_photo}
              showPhoto
              locale={locale}
            />
          </h1>
        </div>
        <span className="mt-3 inline-flex rounded-full bg-[var(--app-surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--app-muted)]">
          {v.archived_at ? c.archived : c[v.status]}
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
          {
            label: c.phone,
            value: v.member_phone || c.missing,
            field: "phone",
            Icon: Phone,
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
                {field === "location" ? (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.location)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--app-brand)] underline decoration-[var(--app-line)] underline-offset-4"
                  >
                    {value}
                  </a>
                ) : field === "phone" && v.member_phone ? (
                  <a
                    href={`tel:${v.member_phone.replace(/[^\d+]/g, "")}`}
                    className="text-[var(--app-brand)] underline decoration-[var(--app-line)] underline-offset-4"
                  >
                    {value}
                  </a>
                ) : (
                  value
                )}
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
                    <VisitMemberLink
                      personId={r.deacon_person_id}
                      name={r.deacon_name}
                      photoPath={r.deacon_photo}
                      showPhoto
                      locale={locale}
                    />
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
