import { notFound } from "next/navigation";
import VisitBack from "@/components/visit-back";
import { requireActiveProfile } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { type Visit } from "@/lib/visitation";
import VisitControls from "@/components/visit-controls";
import VisitDetails from "@/components/visit-details";
import { loadVisitPhotos } from "@/lib/visit-photos";

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
  v.member_photo = (await loadVisitPhotos(supabase, [v.person_id])).get(
    v.person_id,
  );
  return (
    <>
      <VisitBack locale={locale} />
      <VisitDetails visit={v} locale={locale} userId={profile.id} />
      <VisitControls visit={v} userId={profile.id} locale={locale} />
    </>
  );
}
