import { redirect } from "next/navigation";
import DirectoryClient from "@/components/directory-client";
import { requireActiveProfile } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { loadDirectory, loadDeaconGroups } from "@/lib/directory-data";
import { churchToday } from "@/lib/birthdays";

export default async function MyGroupsPage() {
  const { supabase, profile } = await requireActiveProfile();
  if (!profile.ministry_roles.includes("deacon")) redirect("/");
  const locale = await getLocale();
  const groups = await loadDeaconGroups(supabase, profile.id);
  const members = await loadDirectory(
    supabase,
    groups.flatMap((group) => group.memberIds),
  );
  const activeIds = new Set(members.map((person) => person.id));
  const activeGroups = groups.map((group) => ({
    ...group,
    memberIds: group.memberIds.filter((id) => activeIds.has(id)),
  }));
  return (
    <DirectoryClient
      members={members}
      role={profile.role}
      locale={locale}
      isDeacon
      deaconGroups={activeGroups}
      today={churchToday()}
    />
  );
}
