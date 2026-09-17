import { activeAccount, privatePhotoSources, unwrap } from "@/lib/repository-helpers";
import { requireSupabase } from "@/lib/supabase";
import type { AuthorizedBirthday, GroupDetail, GroupSummary, GroupsRepository, MinistryGroup } from "./groups-repository";

export class SupabaseGroupsRepository implements GroupsRepository {
  async listGroups(): Promise<MinistryGroup[]> {
    activeAccount();
    const client = requireSupabase();
    const [groupsResult, peopleResult, membersResult, deaconsResult, deaconAccountsResult] = await Promise.all([
      client.from("deacon_groups").select("*").eq("kind", "membership").is("archived_at", null).order("name"),
      client.from("people").select("id,name,photo_path,membership_group_id").is("archived_at", null),
      client.from("deacon_group_members").select("*"),
      client.from("deacon_group_deacons").select("*").order("slot"),
      client.from("ministry_accounts").select("id,person_id").eq("designation", "deacon"),
    ]);
    const groups = unwrap(groupsResult), people = unwrap(peopleResult), members = unwrap(membersResult), deacons = unwrap(deaconsResult), deaconAccounts = unwrap(deaconAccountsResult);
    const activeIds = new Set(people.map((person) => person.id));
    const deaconPeople = people.filter((person) => deaconAccounts.some((account) => account.person_id === person.id));
    const photos = await privatePhotoSources(deaconPeople.map((person) => person.photo_path)).catch(() => new Map());
    return groups.map((group) => ({ id: group.id, name: group.name, nameUk: group.name, description: "", descriptionUk: "", kind: group.kind,
      responsibleDeaconIds: deacons.filter((item) => item.group_id === group.id).map((item) => item.account_id),
      memberIds: group.kind === "membership" ? people.filter((person) => person.membership_group_id === group.id).map((person) => person.id) : members.filter((item) => item.group_id === group.id && activeIds.has(item.person_id)).map((item) => item.person_id),
      responsibleDeacons: deacons.filter((item) => item.group_id === group.id).flatMap((item) => {
        const account = deaconAccounts.find((candidate) => candidate.id === item.account_id);
        const person = account?.person_id ? people.find((candidate) => candidate.id === account.person_id) : null;
        return person ? [{ id: person.id, name: person.name, photo: person.photo_path ? photos.get(person.photo_path) : undefined, designation: "deacon" as const }] : [];
      }),
    }));
  }
  async getGroup(groupId: string): Promise<GroupDetail | null> {
    const group = (await this.listGroups()).find((candidate) => candidate.id === groupId);
    if (!group) return null;
    const members = group.memberIds.length ? unwrap(await requireSupabase().from("people").select("id,name,photo_path").in("id", group.memberIds).is("archived_at", null).order("name")) : [];
    const [details, designations] = await Promise.all([
      Promise.all(members.map(async (member) => unwrap(await requireSupabase().rpc("member_profile_details", { p_person_id: member.id }))[0])),
      members.length ? requireSupabase().from("ministry_accounts").select("person_id,designation").in("person_id", members.map((member) => member.id)) : Promise.resolve({ data: [], error: null }),
    ]);
    const memberDesignations = unwrap(designations);
    const deaconAccounts = group.responsibleDeaconIds.length ? unwrap(await requireSupabase().from("ministry_accounts").select("*").in("id", group.responsibleDeaconIds)) : [];
    const deaconPersonIds = deaconAccounts.flatMap((account) => account.person_id ? [account.person_id] : []);
    const deaconPeople = deaconPersonIds.length ? unwrap(await requireSupabase().from("people").select("id,name,photo_path").in("id", deaconPersonIds).is("archived_at", null)) : [];
    const photos = await privatePhotoSources([...members, ...deaconPeople].map((person) => person.photo_path));
    const responsibleDeacons = group.responsibleDeaconIds.flatMap((accountId) => {
      const account = deaconAccounts.find((candidate) => candidate.id === accountId);
      const person = account?.person_id ? deaconPeople.find((candidate) => candidate.id === account.person_id) : null;
      return person ? [{ id: person.id, name: person.name, photo: person.photo_path ? photos.get(person.photo_path) : undefined, designation: "deacon" as const }] : [];
    });
    return { ...group, members: members.map((member, index) => { const designation = memberDesignations.find((account) => account.person_id === member.id)?.designation; return { id: member.id, name: member.name, photo: member.photo_path ? photos.get(member.photo_path) : undefined, designation: designation === "pastor" || designation === "deacon" ? designation : undefined, isOrphan: details[index]?.orphan_status ?? undefined, isWidow: ["widowed", "widow", "вдова", "вдівець", "вдівець/вдова"].includes((details[index]?.marital_status ?? "").toLocaleLowerCase()) }; }), responsibleDeacons };
  }
  async getAuthorizedBirthdays(groupId: string): Promise<AuthorizedBirthday[]> {
    const actor = activeAccount();
    if (actor.designation !== "deacon" && actor.designation !== "pastor") return [];
    // The RPC repeats authorization; the client check only avoids an expected forbidden error.
    const group = (await this.listGroups()).find((candidate) => candidate.id === groupId);
    if (!group || (actor.designation === "deacon" && !group.responsibleDeaconIds.includes(actor.id))) return [];
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
