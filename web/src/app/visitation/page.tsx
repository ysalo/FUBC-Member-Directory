import Link from "@/components/navigation-link";
import { requireActiveProfile } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { visitCopy, formatVisitDate, type Visit } from "@/lib/visitation";
import { CalendarDays, Check, Clock, Search, X } from "lucide-react";
import VisitMemberLink from "@/components/visit-member-link";
import { loadVisitIdentities } from "@/lib/member-profile-data";
import VisitBulkArchive, {
  VisitArchiveCheckbox,
} from "@/components/visit-bulk-archive";
export default async function VisitationPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { supabase, profile } = await requireActiveProfile(),
    locale = await getLocale(),
    c = visitCopy(locale);
  const params = await searchParams;
  const archived = params.tab === "archive";
  let visitQuery = supabase
    .from("visit_requests")
    .select("*,visit_recipients(*)")
    .order("scheduled_at", { ascending: !archived });
  visitQuery = archived
    ? visitQuery.not("archived_at", "is", null)
    : visitQuery.is("archived_at", null);
  const { data, error } = await visitQuery;
  if (error) throw new Error("Unable to load visitation");
  const query = params.q?.trim() ?? "";
  const filteredVisits = ((data ?? []) as Visit[]).filter((v) =>
    [
      v.member_name,
      v.pastor_name,
      v.location,
      c[v.status],
      ...v.visit_recipients.map((r) => r.deacon_name),
    ]
      .join(" ")
      .toLocaleLowerCase(locale)
      .includes(query.toLocaleLowerCase(locale)),
  );
  const visits = await loadVisitIdentities(supabase, filteredVisits);
  const canManage = profile.ministry_roles.includes("pastor");
  const archivableVisits =
    archived || !canManage
      ? []
      : visits
          .filter((visit) => visit.pastor_id === profile.id)
          .map((visit) => ({
            id: visit.id,
            revision: visit.revision,
            memberName: visit.member_name,
          }));
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 py-5">
        <h1 className="text-2xl font-semibold">{c.title}</h1>
      </div>
      {canManage && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-xl justify-end px-5 pb-2">
          <Link
            href="/visitation/new"
            className="pointer-events-auto inline-flex min-h-12 items-center rounded-xl bg-[var(--app-brand)] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-black/20"
          >
            {c.request}
          </Link>
        </div>
      )}
      <nav
        aria-label={
          locale === "uk" ? "Розділи відвідувань" : "Visitation sections"
        }
        className="mb-5 grid grid-cols-2 rounded-xl bg-[var(--app-surface-muted)] p-1"
      >
        {[
          { archive: false, label: c.activeTab },
          { archive: true, label: c.archiveTab },
        ].map((tab) => (
          <Link
            key={tab.label}
            href={tab.archive ? "/visitation?tab=archive" : "/visitation"}
            aria-current={archived === tab.archive ? "page" : undefined}
            className={`flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-semibold ${archived === tab.archive ? "bg-[var(--app-surface)] text-[var(--app-ink)] shadow-sm" : "text-[var(--app-muted)]"}`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <form
        className="directory-search mb-6 flex min-h-11 min-w-0 items-center gap-3 border-b border-[var(--app-line)] px-1"
        role="search"
      >
        {archived && <input type="hidden" name="tab" value="archive" />}
        <Search aria-hidden="true" className="size-5 shrink-0 text-slate-400" />
        <label className="min-w-0 flex-1">
          <span className="sr-only">{c.searchVisits}</span>
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder={c.searchVisits}
            className="min-h-11 min-w-0 w-full bg-transparent py-2 text-base outline-none placeholder:text-slate-400"
          />
        </label>
        {query && (
          <Link
            href={archived ? "/visitation?tab=archive" : "/visitation"}
            aria-label={locale === "uk" ? "Очистити пошук" : "Clear search"}
            className="grid size-11 shrink-0 place-items-center text-slate-400 hover:text-slate-700"
          >
            <X aria-hidden="true" className="size-5" />
          </Link>
        )}
        <button className="sr-only">
          {locale === "uk" ? "Пошук" : "Search"}
        </button>
      </form>
      <VisitBulkArchive items={archivableVisits} locale={locale}>
        {[
          {
            title: c.mine,
            show: canManage,
            bulkSelectable: true,
            items: visits.filter((v) => v.pastor_id === profile.id),
          },
          {
            title: c.invitations,
            show: profile.ministry_roles.includes("deacon"),
            bulkSelectable: false,
            items: visits.filter((v) =>
              v.visit_recipients.some((r) => r.deacon_id === profile.id),
            ),
          },
        ]
          .filter((g) => g.show)
          .map((g) => (
            <section key={g.title} className="mb-7">
              <h2 className="mb-3 text-lg font-semibold">{g.title}</h2>
              {!g.items.length && (
                <p className="text-[var(--app-muted)]">
                  {query ? c.noResults : archived ? c.archiveEmpty : c.empty}
                </p>
              )}
              <div className="space-y-3">
                {g.items.map((v) => {
                  const r = v.visit_recipients.find(
                    (r) => r.deacon_id === profile.id,
                  );
                  return (
                    <article
                      key={v.id}
                      className={`relative rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4 hover:border-[var(--app-brand)] ${g.bulkSelectable && !archived ? "pr-14" : ""}`}
                    >
                      {g.bulkSelectable && !archived && (
                        <VisitArchiveCheckbox
                          id={v.id}
                          memberName={v.member_name}
                          locale={locale}
                        />
                      )}
                      <Link
                        href={"/visitation/" + v.id}
                        aria-label={`${c.title}: ${v.member_name}`}
                        className="absolute inset-0 z-0 rounded-2xl"
                      />
                      <div className="pointer-events-none relative z-10">
                        <h3 className="text-lg font-semibold">
                          <span className="pointer-events-auto">
                            <VisitMemberLink
                              personId={v.member_available ? v.person_id : null}
                              name={v.member_name}
                              photoPath={v.member_photo}
                              showPhoto
                              locale={locale}
                            />
                          </span>
                        </h3>
                        {v.member_phone && (
                          <p className="mt-1 text-sm text-[var(--app-muted)]">
                            {v.member_phone}
                          </p>
                        )}
                        <p className="my-2 flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--app-brand)]">
                          <CalendarDays
                            aria-hidden="true"
                            className="size-4 shrink-0"
                          />
                          {formatVisitDate(v.scheduled_at, locale)}
                        </p>
                        <p className="text-sm text-[var(--app-muted)]">
                          {c.requester}:{" "}
                          <span className="pointer-events-auto">
                            <VisitMemberLink
                              personId={v.pastor_person_id}
                              name={v.pastor_name}
                              locale={locale}
                            />
                          </span>
                        </p>
                        <p className="mt-2 text-sm font-medium text-[var(--app-muted)]">
                          {c[archived ? "completed" : v.status]}
                        </p>
                        <ul className="mt-3 space-y-2 border-t border-[var(--app-line)] pt-3 text-sm">
                          {v.visit_recipients.map((recipient) => {
                            const ResponseIcon =
                              recipient.response === "accepted" ? Check : Clock;
                            return (
                              <li
                                key={recipient.deacon_id}
                                className="flex min-w-0 items-center justify-between gap-3"
                              >
                                <span className="pointer-events-auto min-w-0 text-[var(--app-muted)]">
                                  <VisitMemberLink
                                    personId={recipient.deacon_person_id}
                                    name={recipient.deacon_name}
                                    locale={locale}
                                  />
                                </span>
                                <span
                                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${recipient.response === "accepted" ? "bg-[var(--app-brand-soft)] text-[var(--app-brand)]" : recipient.response === "declined" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}
                                >
                                  {recipient.response === "declined" ? (
                                    <X aria-hidden="true" className="size-3.5" />
                                  ) : (
                                    <ResponseIcon
                                      aria-hidden="true"
                                      className="size-3.5"
                                    />
                                  )}
                                  {c[recipient.response]}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                        {r &&
                          v.revision > 1 &&
                          r.last_viewed_revision < v.revision && (
                            <span className="mt-2 block font-semibold text-[var(--app-brand)]">
                              {c.updated}
                            </span>
                          )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
      </VisitBulkArchive>
    </>
  );
}
