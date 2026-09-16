import type { AccountProfile } from "@/lib/auth";
import type { createClient } from "@/lib/supabase/server";
import { loadVisitPhotos } from "@/lib/visit-photos";

export type NavigationUser = {
  name: string;
  email: string;
  personId: string | null;
  photoPath: string | null;
};

export async function loadNavigationUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profile: AccountProfile,
): Promise<NavigationUser> {
  const { data: person } = profile.person_id
    ? await supabase
        .from("people")
        .select("id,first_name,last_name")
        .eq("id", profile.person_id)
        .is("archived_at", null)
        .maybeSingle()
    : { data: null };
  const photos = person
    ? await loadVisitPhotos(supabase, [person.id])
    : new Map();
  return {
    name: person
      ? `${person.first_name} ${person.last_name}`.trim()
      : profile.display_name || profile.email,
    email: profile.email,
    personId: person?.id ?? null,
    photoPath: photos.get(person?.id) || profile.avatar_url || null,
  };
}
