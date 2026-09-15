import Link from "@/components/navigation-link";
import { requireActiveProfile } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { visitCopy, formatVisitDate, type Visit } from "@/lib/visitation";
import { CalendarDays, ChevronRight } from "lucide-react";
export default async function VisitationPage() {
  const { supabase, profile } = await requireActiveProfile(),
    locale = await getLocale(),
    c = visitCopy(locale);
  const { data, error } = await supabase
    .from("visit_requests")
    .select("*,visit_recipients(*)")
    .order("scheduled_at");
  if (error) throw new Error("Unable to load visitation");
  const visits = (data ?? []) as Visit[];
  return (
    <>
      <h1 className="py-5 text-2xl font-semibold">{c.title}</h1>
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
              <p className="text-[var(--app-muted)]">{c.empty}</p>
            )}
            <div className="space-y-3">
              {g.items.map((v) => {
                const r = v.visit_recipients.find(
                  (r) => r.deacon_id === profile.id,
                );
                return (
                  <Link
                    key={v.id}
                    href={"/visitation/" + v.id}
                    className="relative block rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4 pr-9 hover:bg-[var(--app-brand-soft)]"
                  >
                    <span className="block break-words text-lg font-semibold">
                      {v.member_name}
                    </span>
                    <span className="my-2 flex items-center gap-2 text-sm font-medium">
                      <CalendarDays
                        aria-hidden="true"
                        className="size-4 shrink-0 text-[var(--app-brand)]"
                      />
                      {formatVisitDate(v.scheduled_at, locale)}
                    </span>
                    <ChevronRight
                      aria-hidden="true"
                      className="absolute right-3 top-5 size-4 text-[var(--app-muted)]"
                    />
                    <span className="block break-words text-sm text-[var(--app-muted)]">
                      {c[v.status]} ·{" "}
                      {v.visit_recipients
                        .map((r) => r.deacon_name + ": " + c[r.response])
                        .join(" · ")}
                    </span>
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
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
    </>
  );
}
