import type { Member } from "./members";
import { members } from "./members";
import { activeAccount, privatePhotoSources, unwrap } from "@/lib/repository-helpers";
import { createSessionCache } from "@/lib/session-cache";
import type { Database } from "@/lib/database";
import { isBackendConfigured, requireSupabase } from "@/lib/supabase";

type DirectoryMemberRow = Database["public"]["Functions"]["directory_active_members"]["Returns"][number];
const directoryCache = createSessionCache<Array<DirectoryMemberRow & { membership_group_id: string | null }>>(["directory"]);
const visitCountCache = createSessionCache<number>(["visits"]);

export async function listDirectory(options: { fresh?: boolean } = {}): Promise<Member[]> {
  if (!isBackendConfigured) return members;
  activeAccount();
  const people = await directoryCache.load("members", async () => {
    const client = requireSupabase();
    const [peopleResult, membershipResult] = await Promise.all([
      client.rpc("directory_active_members", {}).order("name"),
      client.from("people").select("id,membership_group_id").is("archived_at", null),
    ]);
    const activePeople = unwrap(peopleResult);
    const memberships = unwrap(membershipResult);
    const membershipByPerson = new Map(memberships.map((person) => [person.id, person.membership_group_id]));
    return activePeople.map((person) => ({ ...person, membership_group_id: membershipByPerson.get(person.id) ?? null }));
  }, options.fresh);
  // Fetch presence separately under RLS; never cache note bodies in directory data.
  const visibleNotes = unwrap(await requireSupabase().from("member_notes").select("person_id"));
  const noteIds = new Set(visibleNotes.map(note => note.person_id));
  const photos = await privatePhotoSources(people.map((person) => person.photo_path));
  return people.map((person) => ({ id: person.id, hasNote: noteIds.has(person.id), name: (person.first_name !== undefined && person.last_name !== undefined ? [person.first_name, person.last_name].join(" ") : person.name), first_name: person.first_name, last_name: person.last_name, patronymic: person.patronymic, gender: person.gender, ministry: person.ministry, ministryUk: person.ministry_uk || person.ministry, membershipGroupId: person.membership_group_id, avatar: person.photo_path ? photos.get(person.photo_path) ?? {} : {}, phone: person.phone, leadershipMinistry: person.leadership_ministry, isOrphan: Boolean(person.is_orphan), isWidow: Boolean(person.is_widow) }));
}

export async function getDirectoryVisitCount(options: { fresh?: boolean } = {}): Promise<number> {
  if (!isBackendConfigured) return 0;
  activeAccount();
  return visitCountCache.load("visits", async () => unwrap(await requireSupabase().rpc("directory_visible_visit_count", {})), options.fresh);
}
