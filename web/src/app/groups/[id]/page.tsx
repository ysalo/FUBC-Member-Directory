import { notFound } from "next/navigation";
import DirectoryClient from "@/components/directory-client";
import { requireActiveProfile } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { loadDirectory, loadDeaconGroups } from "@/lib/directory-data";
import { churchToday } from "@/lib/birthdays";

export default async function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { supabase, profile } = await requireActiveProfile();
  const { id } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    notFound();
  const locale = await getLocale();
  const groups = await loadDeaconGroups(supabase);
  const group = groups.find((group) => group.id === id);
  if (!group) notFound();
  const members = await loadDirectory(supabase, [
    ...new Set([
      ...group.memberIds,
      ...group.deacons.flatMap((deacon) =>
        deacon.personId ? [deacon.personId] : [],
      ),
    ]),
  ]);
  const activeIds = new Set(members.map((person) => person.id));
  const isDeacon = profile.ministry_roles.includes("deacon");
  const leadsGroup =
    isDeacon && group.deacons.some((deacon) => deacon.id === profile.id);
  return (
    <DirectoryClient
      key={group.id}
      members={members}
      role={profile.role}
      locale={locale}
      isDeacon={isDeacon}
      isPastor={profile.ministry_roles.includes("pastor")}
      deaconGroups={[
        {
          ...group,
          memberIds: group.memberIds.filter((id) => activeIds.has(id)),
        },
      ]}
      today={churchToday()}
      showBirthdays={leadsGroup}
      birthdayNotificationKey={
        leadsGroup
          ? `directory-birthday-demo:${profile.id}:${group.id}`
          : undefined
      }
    />
  );
}
