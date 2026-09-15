import { redirect, notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { requireActiveProfile } from "@/lib/auth";
import { loadDirectory } from "@/lib/directory-data";
import { getLocale } from "@/lib/locale";
import VisitForm from "@/components/visit-form";
import VisitBack from "@/components/visit-back";
import { visitCopy, type VisitDeacon } from "@/lib/visitation";
import { loadMemberProfileIds } from "@/lib/member-profile-data";
import { loadVisitPhotos } from "@/lib/visit-photos";
export default async function NewVisit({
  searchParams,
}: {
  searchParams: Promise<{ person?: string }>;
}) {
  const { supabase, profile } = await requireActiveProfile();
  if (!profile.ministry_roles.includes("pastor")) redirect("/visitation");
  const { person } = await searchParams;
  if (person && !/^[0-9a-f-]{36}$/i.test(person)) notFound();
  const [members, result, locale] = await Promise.all([
    loadDirectory(supabase, person ? [person] : undefined),
    supabase.rpc("list_visit_deacons"),
    getLocale(),
  ]);
  if (result.error) throw new Error("Unable to load deacons");
  const deacons = (result.data ?? []) as VisitDeacon[];
  const identities = await loadMemberProfileIds(
    supabase,
    deacons.map((deacon) => deacon.id),
  );
  const photos = await loadVisitPhotos(supabase, [...identities.values()]);
  const member = person ? members[0] : undefined;
  if (person && !member) notFound();
  return (
    <>
      <VisitBack locale={locale} />
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">
        {visitCopy(locale).request}
      </h1>
      <VisitForm
        member={member}
        members={person ? [] : members}
        deacons={deacons.map((deacon) => ({
          ...deacon,
          person_id: identities.get(deacon.id) ?? null,
          photo_path: photos.get(identities.get(deacon.id) ?? ""),
        }))}
        locale={locale}
        submission={randomUUID()}
      />
    </>
  );
}
