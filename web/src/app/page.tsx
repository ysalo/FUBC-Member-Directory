import DirectoryClient from "@/components/directory-client";
import { requireActiveProfile } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { loadDirectory } from "@/lib/directory-data";
import { churchToday } from "@/lib/birthdays";

export default async function DirectoryPage() {
  const { supabase, profile } = await requireActiveProfile();
  const locale = await getLocale();
  const members = await loadDirectory(supabase);
  return (
    <DirectoryClient
      members={members}
      today={churchToday()}
      role={profile.role}
      locale={locale}
      isDeacon={profile.ministry_roles.includes("deacon")}
      isPastor={profile.ministry_roles.includes("pastor")}
    />
  );
}
