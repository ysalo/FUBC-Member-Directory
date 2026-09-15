import { notFound } from "next/navigation";
import Link from "@/components/navigation-link";
import { requireActiveProfile } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { visitCopy, type Visit } from "@/lib/visitation";
import VisitControls from "@/components/visit-controls";
import VisitDetails from "@/components/visit-details";

export default async function VisitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, profile } = await requireActiveProfile(),
    locale = await getLocale();
  const { data, error } = await supabase
    .from("visit_requests")
    .select("*,visit_recipients(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Unable to load visit");
  if (!data) notFound();
  const v = data as Visit;
  return (
    <>
      <Link
        href="/visitation"
        className="mb-3 inline-flex min-h-11 items-center text-sm font-medium text-[var(--app-brand)]"
      >
        {visitCopy(locale).back}
      </Link>
      <VisitDetails visit={v} locale={locale} userId={profile.id} />
      <VisitControls visit={v} userId={profile.id} locale={locale} />
    </>
  );
}
