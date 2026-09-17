import type { Database, Json, PersonRow } from "@/lib/database";
import { canManageAccounts, canManageDirectory } from "@/lib/permissions";
import { activeAccount, privatePhotoSources, unwrap } from "@/lib/repository-helpers";
import { isBackendConfigured, requireSupabase } from "@/lib/supabase";
import { initialManagementState, managementReducer } from "./model";
import type { GroupManagementState, ManagedDeacon, ManagedGroup, ManagedMember, ManagedMinistry, ManagementAction, ManagementState } from "./model";

const reservedDesignationNames = new Set(["pastor", "deacon", "пастор", "диякон"]);
export const isDesignationMinistry = (name: string) => reservedDesignationNames.has(name.trim().toLocaleLowerCase());

export class SupabaseManagementRepository {
  async load(): Promise<ManagementState> {
    const actor = activeAccount();
    if (!canManageDirectory(actor)) throw new Error("Directory management is unavailable for this account.");
    const client = requireSupabase();
    const [peopleResult, groupsResult, accountsResult] = await Promise.all([
      client.from("people").select("*").order("name"),
      client.from("deacon_groups").select("*"),
      canManageAccounts(actor) ? client.rpc("management_accounts", {}) : Promise.resolve({ data: [], error: null }),
    ]);
    const people = unwrap(peopleResult), groups = unwrap(groupsResult);
    const accounts = unwrap(accountsResult);
    // Photos enrich the list but must never prevent an administrator from reaching
    // account approval or directory-management controls.
    const photos = await privatePhotoSources(people.map((row) => row.photo_path)).catch(() => new Map());
    return { members: people.map((row) => ({ id: row.id, name: row.name, group: groups.find((group) => group.id === row.membership_group_id)?.name ?? "", archived: Boolean(row.archived_at), revision: row.revision, phone: row.phone, photoPath: row.photo_path, photo: row.photo_path ? photos.get(row.photo_path) : undefined })),
      accounts: accounts.map((row) => ({ id: row.id, name: row.display_name, email: row.email ?? "", status: row.status, role: row.role, designation: row.designation, personId: row.person_id, revision: row.revision, createdAt: row.created_at })),
    };
  }
  async loadAccount(accountId: string): Promise<ManagementState> {
    const actor = activeAccount();
    if (!canManageAccounts(actor)) throw new Error("Account management is unavailable for this account.");
    const client = requireSupabase();
    const accounts = unwrap(await client.rpc("management_accounts", {})).map((row) => ({ id: row.id, name: row.display_name, email: row.email ?? "", status: row.status, role: row.role, designation: row.designation, personId: row.person_id, revision: row.revision, createdAt: row.created_at }));
    const account = accounts.find((candidate) => candidate.id === accountId);
    if (!account?.personId) return { accounts, members: [] };
    const [personResult, groupsResult] = await Promise.all([
      client.from("people").select("*").eq("id", account.personId).maybeSingle(),
      client.from("deacon_groups").select("*"),
    ]);
    if (personResult.error) throw new Error(personResult.error.message);
    if (!personResult.data) return { accounts, members: [] };
    const row = personResult.data;
    const groups = unwrap(groupsResult);
    const photos = await privatePhotoSources([row.photo_path]).catch(() => new Map());
    return { accounts, members: [{ id: row.id, name: row.name, group: groups.find((group) => group.id === row.membership_group_id)?.name ?? "", archived: Boolean(row.archived_at), revision: row.revision, phone: row.phone, photoPath: row.photo_path, photo: row.photo_path ? photos.get(row.photo_path) : undefined }] };
  }
  async loadMember(id: string): Promise<ManagedMember | null> {
    if (!canManageDirectory(activeAccount())) throw new Error("Not authorized.");
    const client = requireSupabase();
    const [personResult, groupsResult, detailsResult] = await Promise.all([
      client.from("people").select("*").eq("id", id).maybeSingle(),
      client.from("deacon_groups").select("*"),
      client.rpc("management_member_details", { p_person_id: id }),
    ]);
    if (personResult.error) throw new Error(personResult.error.message);
    if (!personResult.data) return null;
    const row = personResult.data;
    const groups = unwrap(groupsResult);
    const details = unwrap(detailsResult)[0];
    const photos = await privatePhotoSources([row.photo_path]);
    return { id: row.id, name: row.name, group: groups.find((group) => group.id === row.membership_group_id)?.name ?? "", archived: Boolean(row.archived_at), revision: row.revision, birthday: details?.birth_date ?? null, address: details?.address ?? null, ministryIds: details?.ministry_ids ?? [], phone: row.phone, photoPath: row.photo_path, photo: row.photo_path ? photos.get(row.photo_path) : undefined };
  }
  async apply(state: ManagementState, action: ManagementAction): Promise<ManagementState> {
    const actor = activeAccount();
    if (action.type === "toggle-member-archive") {
      if (!canManageDirectory(actor)) throw new Error("Not authorized.");
      const snapshot = state.members.find((item) => item.id === action.memberId);
      if (snapshot?.revision == null) throw new Error("Reload this member before making changes.");
      const currentResult = await requireSupabase().from("people").select("*").eq("id", snapshot.id).single();
      const current = unwrap(currentResult);
      await this.saveMember(current.id, snapshot.revision, { ...personData(current), archived: !snapshot.archived });
    } else {
      if (!canManageAccounts(actor)) throw new Error("Not authorized.");
      const snapshot = state.accounts.find((item) => item.id === action.accountId);
      if (snapshot?.revision == null) throw new Error("Reload this account before making changes.");
      unwrap(await requireSupabase().rpc("update_account", {
        p_id: snapshot.id,
        p_revision: snapshot.revision,
        p_status: action.type === "unlink-account" ? "pending" : action.type === "set-account-status" ? action.status : snapshot.status,
        p_role: action.type === "set-account-role" ? action.role : snapshot.role,
        p_designation: action.type === "unlink-account" ? "none" : action.type === "set-account-designation" ? action.designation : snapshot.designation ?? "none",
        p_person_id: action.type === "unlink-account" ? null : action.type === "link-account" ? action.personId : snapshot.personId ?? null,
      }));
    }
    return action.type === "toggle-member-archive" ? this.load() : this.loadAccount(action.accountId);
  }
  async saveMember(id: string | null, revision: number | null, data: Json) {
    if (!canManageDirectory(activeAccount())) throw new Error("Not authorized.");
    return unwrap(await requireSupabase().rpc("save_person", { p_id: id, p_revision: revision, p_data: data }));
  }
  async listMinistries(): Promise<ManagedMinistry[]> {
    if (!canManageDirectory(activeAccount())) throw new Error("Not authorized.");
    const rows = unwrap(await requireSupabase().from("ministries").select("*").order("name"));
    return rows.filter((row) => !isDesignationMinistry(row.name) && !isDesignationMinistry(row.name_uk ?? "")).map((row) => ({ id: row.id, name: row.name, nameUk: null, archived: Boolean(row.archived_at), revision: row.revision }));
  }
  async saveMinistry(ministry: { id?: string | null; revision?: number | null; name: string; nameUk?: string | null; archived?: boolean }) {
    if (!canManageDirectory(activeAccount())) throw new Error("Not authorized.");
    if (isDesignationMinistry(ministry.name)) throw new Error("Pastor and Deacon are account designations, not ministries.");
    return unwrap(await requireSupabase().rpc("save_ministry", { p_id: ministry.id ?? null, p_revision: ministry.revision ?? null, p_name: ministry.name, p_name_uk: null, p_archived: ministry.archived ?? false }));
  }
  async saveMemberDetails(member: { id?: string | null; revision?: number | null; name: string; birthday?: string | null; ministryIds?: string[]; phone?: string | null; address?: string | null }) {
    if (!canManageDirectory(activeAccount())) throw new Error("Not authorized.");
    return unwrap(await requireSupabase().rpc("save_person", { p_id: member.id ?? null, p_revision: member.revision ?? null, p_data: { name: member.name, birth_date: member.birthday ?? null, ministry_ids: member.ministryIds ?? [], phone: member.phone ?? null, address: member.address ?? null } }));
  }
  async saveAccount(args: Database["public"]["Functions"]["update_account"]["Args"]) {
    if (!canManageAccounts(activeAccount())) throw new Error("Not authorized.");
    return unwrap(await requireSupabase().rpc("update_account", args));
  }
  async listGroups() {
    if (!canManageDirectory(activeAccount())) throw new Error("Not authorized.");
    return unwrap(await requireSupabase().from("deacon_groups").select("*").order("name"));
  }
  async loadGroupManagement(): Promise<GroupManagementState> {
    if (!canManageDirectory(activeAccount())) throw new Error("Not authorized.");
    const client = requireSupabase();
    const [groupsResult, peopleResult, responsibilityMembersResult, assignmentsResult, accountsResult] = await Promise.all([
      client.from("deacon_groups").select("*").is("archived_at", null).order("name"),
      client.from("people").select("id,name,photo_path,membership_group_id").is("archived_at", null),
      client.from("deacon_group_members").select("*"),
      client.from("deacon_group_deacons").select("*").order("slot"),
      client.from("ministry_accounts").select("*").eq("designation", "deacon"),
    ]);
    const groups = unwrap(groupsResult), people = unwrap(peopleResult), responsibilityMembers = unwrap(responsibilityMembersResult), assignments = unwrap(assignmentsResult), accounts = unwrap(accountsResult);
    const linkedIds = accounts.flatMap((account) => account.person_id ? [account.person_id] : []);
    const linkedPeople = people.filter((person) => linkedIds.includes(person.id));
    const photos = await privatePhotoSources(linkedPeople.map((person) => person.photo_path)).catch(() => new Map());
    const managedGroups: ManagedGroup[] = groups.map((group) => ({
      id: group.id,
      name: group.name,
      kind: group.kind,
      archived: Boolean(group.archived_at),
      revision: group.revision,
      memberIds: group.kind === "membership" ? people.filter((person) => person.membership_group_id === group.id).map((person) => person.id) : responsibilityMembers.filter((member) => member.group_id === group.id).map((member) => member.person_id),
      deaconIds: assignments.filter((assignment) => assignment.group_id === group.id).sort((left, right) => left.slot - right.slot).map((assignment) => assignment.account_id),
    }));
    const deacons: ManagedDeacon[] = accounts.flatMap((account) => {
      const person = account.person_id ? linkedPeople.find((candidate) => candidate.id === account.person_id) : null;
      if (!person) return [];
      return [{ accountId: account.id, personId: person.id, name: person.name, currentGroupId: assignments.find((assignment) => assignment.account_id === account.id)?.group_id ?? null, photo: person.photo_path ? photos.get(person.photo_path) : undefined }];
    });
    return { groups: managedGroups, deacons: deacons.sort((left, right) => left.name.localeCompare(right.name)) };
  }
  async saveGroup(args: Database["public"]["Functions"]["save_group"]["Args"]) {
    if (!canManageDirectory(activeAccount())) throw new Error("Not authorized.");
    return unwrap(await requireSupabase().rpc("save_group", args));
  }
  async deleteGroup(id: string, revision: number) {
    if (!canManageDirectory(activeAccount())) throw new Error("Not authorized.");
    const { error } = await requireSupabase().rpc("delete_group", { p_id: id, p_revision: revision });
    if (error) throw new Error(error.message);
  }
  async replacePhoto(person: { id: string; revision: number; photo_path?: string | null; photoPath?: string | null }, bytes: ArrayBuffer | null, mimeType?: "image/jpeg" | "image/png" | "image/webp") {
    if (!canManageDirectory(activeAccount())) throw new Error("Not authorized.");
    const client = requireSupabase();
    let path: string | null = null;
    if (bytes) {
      if (!mimeType || bytes.byteLength === 0 || bytes.byteLength > 5 * 1024 * 1024) throw new Error("Choose a JPEG, PNG or WebP photo smaller than 5 MB.");
      const extension = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/png" ? "png" : "webp";
      path = `${person.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
      const { error } = await client.storage.from("member-photos").upload(path, bytes, { contentType: mimeType, upsert: false });
      if (error) throw new Error(error.message);
    }
    const result = await client.rpc("set_person_photo", { p_id: person.id, p_revision: person.revision, p_path: path });
    if (result.error) {
      if (path) await client.storage.from("member-photos").remove([path]);
      throw new Error(result.error.message);
    }
    const previous = person.photo_path ?? person.photoPath ?? null;
    let cleanupWarning: string | null = null;
    if (previous && previous !== path) {
      const { error } = await client.storage.from("member-photos").remove([previous]);
      if (error) cleanupWarning = "The previous photo could not be removed. Please contact an administrator.";
    }
    return { person: unwrap(result), cleanupWarning };
  }
}
function personData(person: PersonRow) {
  return { name: person.name, ministry: person.ministry, ministry_uk: person.ministry_uk, phone: person.phone, email: person.email, membership_group_id: person.membership_group_id, archived: Boolean(person.archived_at) };
}
class InMemoryManagementRepository {
  private state = structuredClone(initialManagementState);
  async load() { return structuredClone(this.state); }
  async loadAccount(accountId: string) { return structuredClone({ accounts: this.state.accounts, members: this.state.members.filter((member) => member.id === this.state.accounts.find((account) => account.id === accountId)?.personId) }); }
  async loadMember(id: string) { return structuredClone(this.state.members.find((member) => member.id === id) ?? null); }
  async saveMember(id: string | null, _revision: number | null, data: Json) {
    if (id) return this.load();
    const name = typeof data === "object" && data !== null && !Array.isArray(data) && typeof data.name === "string" ? data.name : "";
    this.state.members.push({ id: `member-${Date.now()}`, name, group: "", archived: false, revision: 1 });
    return this.load();
  }
  private ministries: ManagedMinistry[] = [{ id: "ministry-worship", name: "Worship", nameUk: "Служіння прославлення", archived: false, revision: 1 }, { id: "ministry-youth", name: "Youth", nameUk: "Молодь", archived: false, revision: 1 }];
  private groupManagement: GroupManagementState = {
    groups: [{ id: "group-one", name: "Група один", kind: "membership", archived: false, revision: 1, memberIds: ["maria-ivanova"], deaconIds: ["deacon-slav", "deacon-alina"] }],
    deacons: [{ accountId: "deacon-slav", personId: "yaroslav-salo", name: "Yaroslav Salo", currentGroupId: "group-one" }, { accountId: "deacon-alina", personId: "alina-belashov", name: "Alina Belashov", currentGroupId: "group-one" }],
  };
  async listMinistries() { return structuredClone(this.ministries); }
  async saveMinistry(ministry: { id?: string | null; revision?: number | null; name: string; nameUk?: string | null; archived?: boolean }) { const item = ministry.id ? this.ministries.find((m) => m.id === ministry.id) : undefined; if (item) Object.assign(item, { name: ministry.name, nameUk: ministry.nameUk ?? null, archived: ministry.archived ?? false, revision: (item.revision ?? 0) + 1 }); else this.ministries.push({ id: `ministry-${Date.now()}`, name: ministry.name, nameUk: ministry.nameUk ?? null, archived: false, revision: 1 }); return item ?? this.ministries.at(-1); }
  async saveMemberDetails(member: { id?: string | null; revision?: number | null; name: string; birthday?: string | null; ministryIds?: string[]; phone?: string | null; address?: string | null }) { let saved = member.id ? this.state.members.find((m) => m.id === member.id) : undefined; if (saved) Object.assign(saved, { name: member.name, birthday: member.birthday ?? null, ministryIds: member.ministryIds ?? [], phone: member.phone ?? null, address: member.address ?? null, revision: (saved.revision ?? 0) + 1 }); else { saved = { id: `member-${Date.now()}`, name: member.name, group: "", archived: false, revision: 1, birthday: member.birthday ?? null, ministryIds: member.ministryIds ?? [], phone: member.phone ?? null, address: member.address ?? null, photoPath: null }; this.state.members.push(saved); } return structuredClone(saved); }
  async loadGroupManagement() { return structuredClone(this.groupManagement); }
  async listGroups() { return structuredClone(this.groupManagement.groups); }
  async saveGroup(args: Database["public"]["Functions"]["save_group"]["Args"]) { const group = this.groupManagement.groups.find((item) => item.id === args.p_id); if (!group) throw new Error("Group not found."); const selected = args.p_deacon_ids; this.groupManagement.groups.forEach((item) => { item.deaconIds = item.id === group.id ? [...selected] : item.deaconIds.filter((id) => !selected.includes(id)); }); this.groupManagement.deacons.forEach((deacon) => { deacon.currentGroupId = selected.includes(deacon.accountId) ? group.id : deacon.currentGroupId === group.id ? null : deacon.currentGroupId; }); group.revision += 1; return structuredClone(group); }
  async replacePhoto(person: { id: string; revision: number; photo_path?: string | null; photoPath?: string | null }, bytes: ArrayBuffer | null, mimeType?: "image/jpeg" | "image/png" | "image/webp") { if (bytes && (!mimeType || bytes.byteLength === 0 || bytes.byteLength > 5 * 1024 * 1024)) throw new Error("Choose a JPEG, PNG or WebP photo smaller than 5 MB."); const member = this.state.members.find((item) => item.id === person.id); if (member) member.photoPath = bytes ? `local:${Date.now()}` : null; return { person: structuredClone(member), cleanupWarning: null }; }
  async apply(state: ManagementState, action: ManagementAction) { this.state = managementReducer(state, action); return this.load(); }
}
export const managementRepository = isBackendConfigured ? new SupabaseManagementRepository() : new InMemoryManagementRepository();
