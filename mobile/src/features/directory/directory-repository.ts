import type { Member } from "./members";
import { members } from "./members";
import { activeAccount, privatePhotoSources, unwrap } from "@/lib/repository-helpers";
import { isBackendConfigured, requireSupabase } from "@/lib/supabase";

export async function listDirectory(): Promise<Member[]> {
  if (!isBackendConfigured) return members;
  activeAccount();
  const client = requireSupabase();
  const peopleResult = await client.rpc("directory_active_members", {}).order("name");
  const people = unwrap(peopleResult);
  const photos = await privatePhotoSources(people.map((person) => person.photo_path));
  return people.map((person) => ({ id: person.id, name: person.name, ministry: person.ministry, ministryUk: person.ministry_uk || person.ministry, avatar: person.photo_path ? photos.get(person.photo_path) ?? {} : {}, phone: person.phone, leadershipMinistry: person.leadership_ministry, isOrphan: Boolean(person.is_orphan), isWidow: Boolean(person.is_widow) }));
}

export async function getDirectoryVisitCount(): Promise<number> {
  if (!isBackendConfigured) return 0;
  return unwrap(await requireSupabase().rpc("directory_visible_visit_count", {}));
}
