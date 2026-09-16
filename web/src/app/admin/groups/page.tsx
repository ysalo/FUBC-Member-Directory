import BackButton from "@/components/back-button";
import GroupManagement from "@/components/group-management";
import { requireEditor } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { loadDeaconGroups } from "@/lib/directory-data";
import { groupCopy } from "@/lib/group-copy";
import { loadMemberProfileIds } from "@/lib/member-profile-data";
import { loadVisitPhotos } from "@/lib/visit-photos";

export default async function GroupsAdminPage() {
  const { supabase } = await requireEditor();
  const locale = await getLocale();
  const copy = groupCopy(locale);
  const [
    groups,
    { data: people, error },
    { data: eligible, error: deaconError },
  ] = await Promise.all([
    loadDeaconGroups(supabase),
    supabase
      .from("people")
      .select("id, first_name, last_name, archived_at")
      .order("last_name")
      .order("first_name"),
    supabase.rpc("list_eligible_deacons"),
  ]);
  if (error || deaconError) throw new Error("Unable to load group management.");
  const identities = await loadMemberProfileIds(supabase, [
    ...(eligible ?? []).map((deacon: { id: string }) => deacon.id),
    ...groups.flatMap((group) => group.deacons.map((deacon) => deacon.id)),
  ]);
  const photos = await loadVisitPhotos(
    supabase,
    (people ?? []).map((person) => person.id),
  );
  return (
    <main className="safe-page min-h-dvh p-4 sm:p-8">
      <section className="native-enter mx-auto max-w-5xl">
        <header className="flex items-center gap-3">
          <BackButton
            href="/admin"
            label={locale === "uk" ? "До керування" : "Back to management"}
          />
          <h1 className="text-2xl font-bold">{copy.groups}</h1>
        </header>
        <GroupManagement
          groups={groups}
          people={(people ?? []).map((person) => ({
            ...person,
            photoPath: photos.get(person.id),
          }))}
          eligible={eligible ?? []}
          memberProfiles={Object.fromEntries(
            [...identities].map(([profileId, personId]) => [
              profileId,
              { personId, photoPath: photos.get(personId) },
            ]),
          )}
          locale={locale}
        />
      </section>
    </main>
  );
}
