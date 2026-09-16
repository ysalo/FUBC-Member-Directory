import Link from "@/components/navigation-link";
import { requireActiveProfile } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { visitCopy, formatVisitDate, type Visit } from "@/lib/visitation";
import { CalendarDays, ChevronRight, Search, X } from "lucide-react";
import VisitMemberLink from "@/components/visit-member-link";
import { loadVisitIdentities } from "@/lib/member-profile-data";
export default async function VisitationPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { supabase, profile } = await requireActiveProfile(),
    locale = await getLocale(),
    c = visitCopy(locale);
  const { data, error } = await supabase
    .from("visit_requests")
    .select("*,visit_recipients(*)")
    .order("scheduled_at");
  if (error) throw new Error("Unable to load visitation");
  const query = (await searchParams).q?.trim() ?? "";
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
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 py-5">
        <h1 className="text-2xl font-semibold">{c.title}</h1>
        {profile.ministry_roles.includes("pastor") && (
          <Link
            href="/visitation/new"
            className="inline-flex min-h-11 items-center rounded-xl bg-[var(--app-brand)] px-4 py-2 text-sm font-semibold text-white"
          >
            {c.request}
          </Link>
        )}
      </div>
      <form
        className="directory-search mb-6 flex min-h-11 min-w-0 items-center gap-3 border-b border-[var(--app-line)] px-1"
        role="search"
      >
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
            href="/visitation"
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
      {[
        {
          title: c.mine,
          show: profile.ministry_roles.includes("pastor"),
          items: visits.filter((v) => v.pastor_id === profile.id),
        },
        {
          title: c.invitations,
          show: profile.ministry_roles.includes("deacon"),
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
                {query ? c.noResults : c.empty}
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
                    className="relative rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4 hover:border-[var(--app-brand)]"
                  >
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
                        <ChevronRight
                          aria-hidden="true"
                          className="ml-auto size-4 shrink-0"
                        />
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
                      <p className="mt-2 text-sm text-[var(--app-muted)]">
                        {c[v.status]}
                      </p>
                      <ul className="space-y-1 text-sm text-[var(--app-muted)]">
                        {v.visit_recipients.map((recipient) => (
                          <li key={recipient.deacon_id}>
                            <span className="pointer-events-auto">
                              <VisitMemberLink
                                personId={recipient.deacon_person_id}
                                name={recipient.deacon_name}
                                locale={locale}
                              />
                            </span>
                            {": "}
                            {c[recipient.response]}
                          </li>
                        ))}
                      </ul>
                      {v.status === "open" &&
                        v.visit_recipients.some(
                          (r) => r.response === "accepted",
                        ) && <span className="block text-sm">{c.confirmed}</span>}
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
    </>
  );
}
