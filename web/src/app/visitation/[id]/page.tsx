import { notFound } from "next/navigation";
import Link from "@/components/navigation-link";
import { requireActiveProfile } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { visitCopy, type Visit } from "@/lib/visitation";
import VisitControls from "@/components/visit-controls";
export default async function VisitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, profile } = await requireActiveProfile(),
    locale = await getLocale(),
    c = visitCopy(locale);
  const { data, error } = await supabase
    .from("visit_requests")
    .select("*,visit_recipients(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Unable to load visit");
  if (!data) notFound();
  const v = data as Visit,
    zone = process.env.CHURCH_TIMEZONE || "America/Los_Angeles";
  const r = v.visit_recipients.find((r) => r.deacon_id === profile.id);
  // Request-time UI hint only; close_visit enforces the current time atomically in PostgreSQL.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  return (
    <>
      <Link href="/visitation" className="inline-flex min-h-11 items-center">
        {c.back}
      </Link>
      <h1 className="mb-4 break-words text-2xl font-semibold">
        {v.member_name}
      </h1>
      {r && v.revision > 1 && r.last_viewed_revision < v.revision && (
        <p
          role="status"
          className="mb-4 rounded-xl bg-[var(--app-brand-soft)] p-3"
        >
          {c.changed}
        </p>
      )}
      <p className="mb-4">
        {c.requester}: {v.pastor_name} · {c[v.status]}
      </p>
      <dl className="mb-5 space-y-4 rounded-2xl bg-[var(--app-surface-muted)] p-4">
        {[
          [c.address, v.member_address || c.missing],
          [c.location, v.location],
          [
            c.time,
            new Intl.DateTimeFormat(locale, {
              dateStyle: "full",
              timeStyle: "short",
              timeZone: zone,
            }).format(new Date(v.scheduled_at)) +
              " (" +
              zone +
              ")",
          ],
          [c.notes, v.notes || c.missing],
        ].map(([label, text]) => (
          <div key={label}>
            <dt className="text-sm text-[var(--app-muted)]">
              {label}
              {r &&
                r.last_viewed_revision < v.revision &&
                v.updated_fields.includes(
                  label === c.location
                    ? "location"
                    : label === c.time
                      ? "scheduled_at"
                      : label === c.notes
                        ? "notes"
                        : "",
                ) && (
                  <span className="ml-2 font-semibold text-[var(--app-brand)]">
                    {c.updated}
                  </span>
                )}
            </dt>
            <dd className="select-text whitespace-pre-wrap break-words">
              {text}
            </dd>
          </div>
        ))}
      </dl>
      <section className="mb-5">
        <h2 className="mb-2 font-semibold">{c.recipients}</h2>
        {v.visit_recipients.map((r) => (
          <p key={r.deacon_id} className="mb-2 break-words">
            {r.deacon_name} — {c[r.response]}
            {r.decline_reason && (
              <span className="block text-sm">{r.decline_reason}</span>
            )}
          </p>
        ))}
      </section>
      {v.status === "open" && v.pastor_id === profile.id && (
        <Link
          href={"/visitation/" + v.id + "/edit"}
          className="mb-4 inline-flex min-h-12 items-center font-semibold text-[var(--app-brand)]"
        >
          {c.edit}
        </Link>
      )}
      <VisitControls
        visit={v}
        userId={profile.id}
        locale={locale}
        canComplete={
          new Date(v.scheduled_at).getTime() <= now &&
          v.visit_recipients.some((r) => r.response === "accepted")
        }
      />
    </>
  );
}
