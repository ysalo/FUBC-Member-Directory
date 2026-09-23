import { activeAccount, privatePhotoSources, unwrap } from "@/lib/repository-helpers";
import { requireSupabase } from "@/lib/supabase";
import type { AuthorizedBirthday, GroupDetail, GroupSummary, GroupsRepository, MinistryGroup } from "./groups-repository";

const memberSummaryBatchSize = 100;

export class SupabaseGroupsRepository implements GroupsRepository {
  async listGroups(): Promise<MinistryGroup[]> {
    activeAccount();
    const client = requireSupabase();
    const [groupsResult, peopleResult, membersResult, deaconsResult, deaconAccountsResult] = await Promise.all([
      client.from("deacon_groups").select("*").eq("kind", "membership").is("archived_at", null).order("name"),
      client.from("people").select("id,name,photo_path,membership_group_id").is("archived_at", null),
      client.from("deacon_group_members").select("*"),
      client.from("deacon_group_deacons").select("*").order("slot"),
      client.from("ministry_accounts").select("id,person_id").eq("leadership_ministry", "deacon"),
    ]);
    const groups = unwrap(groupsResult), people = unwrap(peopleResult), members = unwrap(membersResult), deacons = unwrap(deaconsResult), deaconAccounts = unwrap(deaconAccountsResult);
    const activeIds = new Set(people.map((person) => person.id));
    const assignedDeaconPersonIds = new Set(deacons.map((assignment) => assignment.person_id));
    const deaconPeople = people.filter((person) => assignedDeaconPersonIds.has(person.id));
    const photos = await privatePhotoSources(deaconPeople.map((person) => person.photo_path)).catch(() => new Map());
    return groups.map((group) => ({ id: group.id, name: group.name, nameUk: group.name, description: "", descriptionUk: "", kind: group.kind,
      responsibleDeaconIds: deacons.filter((item) => item.group_id === group.id).flatMap((item) => {
        const account = deaconAccounts.find((candidate) => candidate.person_id === item.person_id);
        return account ? [account.id] : [];
      }),
      memberIds: group.kind === "membership" ? people.filter((person) => person.membership_group_id === group.id).map((person) => person.id) : members.filter((item) => item.group_id === group.id && activeIds.has(item.person_id)).map((item) => item.person_id),
      responsibleDeacons: deacons.filter((item) => item.group_id === group.id).flatMap((item) => {
        const person = people.find((candidate) => candidate.id === item.person_id);
        return person ? [{ id: person.id, name: person.name, photo: person.photo_path ? photos.get(person.photo_path) : undefined, leadershipMinistry: "deacon" as const }] : [];
      }),
    }));
  }
  async getGroup(groupId: string): Promise<GroupDetail | null> {
    const group = (await this.listGroups()).find((candidate) => candidate.id === groupId);
    if (!group) return null;
    const client = requireSupabase();
    const members = group.memberIds.length ? unwrap(await client.from("people").select("id,name,photo_path").eq("membership_group_id", group.id).is("archived_at", null).order("name")) : [];
    const batches = Array.from({ length: Math.ceil(members.length / memberSummaryBatchSize) }, (_, index) =>
      members.slice(index * memberSummaryBatchSize, (index + 1) * memberSummaryBatchSize).map((member) => member.id));
    const summaries = (await Promise.all(batches.map(async (ids) => unwrap(await client.rpc("directory_active_members", {})
      .select("id,leadership_ministry,is_orphan,is_widow").in("id", ids))))).flat();
    const summaryById = new Map(summaries.map((summary) => [summary.id, summary]));
    const photos = await privatePhotoSources(members.map((person) => person.photo_path));
    const responsibleDeacons = group.responsibleDeacons ?? [];
    return { ...group, members: members.map((member) => {
      const summary = summaryById.get(member.id);
      return { id: member.id, name: member.name, photo: member.photo_path ? photos.get(member.photo_path) : undefined,
        leadershipMinistry: summary?.leadership_ministry ?? undefined, isOrphan: summary?.is_orphan ?? undefined, isWidow: summary?.is_widow ?? false };
    }), responsibleDeacons };
  }
  async getAuthorizedBirthdays(groupId: string): Promise<AuthorizedBirthday[]> {
    const actor = activeAccount();
    if (actor.leadershipMinistry !== "deacon" && actor.leadershipMinistry !== "pastor") return [];
    // The RPC repeats authorization; the client check only avoids an expected forbidden error.
    const group = (await this.listGroups()).find((candidate) => candidate.id === groupId);
    if (!group || (actor.leadershipMinistry === "deacon" && !group.responsibleDeaconIds.includes(actor.id))) return [];
    const rows = unwrap(await requireSupabase().rpc("group_birthdays", { p_group_id: groupId }));
    const photoRows = rows.length ? unwrap(await requireSupabase().from("people").select("id,photo_path").in("id", rows.map((row) => row.person_id))) : [];
    const photos = await privatePhotoSources(photoRows.map((person) => person.photo_path));
    return rows.map((row) => ({ id: row.person_id, name: row.name, photo: photoRows.find((person) => person.id === row.person_id)?.photo_path ? photos.get(photoRows.find((person) => person.id === row.person_id)?.photo_path as string) : undefined, month: row.month, day: row.day }));
  }
  async getBirthdayNotificationsEnabled(groupId: string) {
    activeAccount();
    const rows = unwrap(await requireSupabase().rpc("group_birthday_notification_setting", { p_group_id: groupId }));
    return Boolean(rows);
  }
  async setBirthdayNotificationsEnabled(groupId: string, enabled: boolean) {
    activeAccount();
    const { error } = await requireSupabase().rpc("set_group_birthday_notifications", { p_group_id: groupId, p_enabled: enabled });
    if (error) throw new Error(error.message);
  }
  async getSummary(groupId: string): Promise<GroupSummary> {
    activeAccount();
    const row = unwrap(await requireSupabase().rpc("group_summary_counts", { p_group_id: groupId }))[0];
    return { total: row?.total ?? 0, orphans: row?.orphans ?? 0, widows: row?.widows ?? 0 };
  }
}
