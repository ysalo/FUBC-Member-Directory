import type { Member } from "./members";
import { members } from "./members";
import { activeAccount, privatePhotoSources, unwrap } from "@/lib/repository-helpers";
import { createSessionCache } from "@/lib/session-cache";
import type { Database } from "@/lib/database";
import { isBackendConfigured, requireSupabase } from "@/lib/supabase";

const directoryCache = createSessionCache<Database["public"]["Functions"]["directory_active_members"]["Returns"]>(["directory"]);
const visitCountCache = createSessionCache<number>(["visits"]);

export async function listDirectory(options: { fresh?: boolean } = {}): Promise<Member[]> {
  if (!isBackendConfigured) return members;
  activeAccount();
  const people = await directoryCache.load("members", async () => {
    const client = requireSupabase();
    const peopleResult = await client.rpc("directory_active_members", {}).order("name");
    return unwrap(peopleResult);
  }, options.fresh);
  const photos = await privatePhotoSources(people.map((person) => person.photo_path));
  return people.map((person) => ({ id: person.id, name: person.name, patronymic: person.patronymic, ministry: person.ministry, ministryUk: person.ministry_uk || person.ministry, avatar: person.photo_path ? photos.get(person.photo_path) ?? {} : {}, phone: person.phone, leadershipMinistry: person.leadership_ministry, isOrphan: Boolean(person.is_orphan), isWidow: Boolean(person.is_widow) }));
}

export async function getDirectoryVisitCount(options: { fresh?: boolean } = {}): Promise<number> {
  if (!isBackendConfigured) return 0;
  activeAccount();
  return visitCountCache.load("visits", async () => unwrap(await requireSupabase().rpc("directory_visible_visit_count", {})), options.fresh);
}
