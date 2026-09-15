import DirectoryClient from "@/components/directory-client";
import { requireActiveProfile } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { loadDirectory } from "@/lib/directory-data";

export default async function DirectoryPage() {
  const { supabase, profile } = await requireActiveProfile();
  const locale = await getLocale();
  const members = await loadDirectory(supabase);
  return (
    <DirectoryClient
      members={members}
      role={profile.role}
      locale={locale}
      isDeacon={profile.ministry_roles.includes("deacon")}
    />
  );
}
