import { notFound } from "next/navigation";
import DirectoryClient from "@/components/directory-client";
import { requireActiveProfile } from "@/lib/auth";
import { churchToday } from "@/lib/birthdays";
import { loadDirectory } from "@/lib/directory-data";
import { getLocale } from "@/lib/locale";
import { loadNavigationUser } from "@/lib/navigation-user";

export default async function MemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ group?: string }>;
}) {
  const { supabase, profile } = await requireActiveProfile();
  const { id } = await params;
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(id)) notFound();
  const [member] = await loadDirectory(supabase, [id]);
  if (!member) notFound();
  const { group } = await searchParams;
  return (
    <DirectoryClient
      members={[member]}
      initialMember={member}
      backHref={group && uuid.test(group) ? `/groups/${group}` : "/"}
      currentUser={await loadNavigationUser(supabase, profile)}
      today={churchToday()}
      locale={await getLocale()}
      role={profile.role}
      isDeacon={profile.ministry_roles.includes("deacon")}
      isPastor={profile.ministry_roles.includes("pastor")}
    />
  );
}
