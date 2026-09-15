import { notFound, redirect } from "next/navigation";
import { requireActiveProfile } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { visitCopy, type Visit } from "@/lib/visitation";
import VisitForm from "@/components/visit-form";
import VisitBack from "@/components/visit-back";
import { loadVisitIdentities } from "@/lib/member-profile-data";
export default async function EditVisit({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, profile } = await requireActiveProfile();
  const { data, error } = await supabase
    .from("visit_requests")
    .select("*,visit_recipients(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Unable to load visit");
  if (!data || data.pastor_id !== profile.id) notFound();
  const [v] = await loadVisitIdentities(supabase, [data as Visit]);
  if (v.status !== "open") redirect("/visitation/" + id);
  const locale = await getLocale();
  return (
    <>
      <VisitBack locale={locale} href={`/visitation/${id}`} />
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">
        {visitCopy(locale).edit}
      </h1>
      <VisitForm
        member={{
          id: v.person_id,
          name: v.member_name,
          address: v.member_address,
          groupId: null,
          photoPath: v.member_photo,
          available: v.member_available,
        }}
        visit={v}
        deacons={[]}
        locale={locale}
        submission=""
      />
    </>
  );
}
