import type { Database, Json, PersonRow } from "@/lib/database";
import { canManageAccounts, canManageDirectory } from "@/lib/permissions";
import {
    activeAccount,
    privatePhotoSources,
    unwrap,
} from "@/lib/repository-helpers";
import { isBackendConfigured, requireSupabase } from "@/lib/supabase";
import { createSessionCache, invalidateData } from "@/lib/session-cache";
import { thumbnailPath } from "@/lib/photo-cache";
import { initialManagementState, managementReducer } from "./model";
import type {
    GroupManagementState,
    ManagedDeacon,
    ManagedGroup,
    ManagedGroupMember,
    ManagedMember,
    ManagedMinistry,
    ManagementAction,
    ManagementState,
} from "./model";

export type AccountChangeListener = () => void;

export class SupabaseManagementRepository {
    private readonly accountChangeListeners = new Set<AccountChangeListener>();
    private readonly pendingCountCache = createSessionCache<number>(["accounts"]);

    subscribeAccountChanges(listener: AccountChangeListener) {
        this.accountChangeListeners.add(listener);
        return () => this.accountChangeListeners.delete(listener);
    }

    private notifyAccountChanges() {
        invalidateData("directory", "groups", "duty", "visits", "accounts");
        for (const listener of this.accountChangeListeners) listener();
    }

    async loadPendingAccountCount(): Promise<number> {
        if (!canManageAccounts(activeAccount())) return 0;
        return this.pendingCountCache.load("pending", async () => {
            const accounts = unwrap(await requireSupabase().rpc("management_accounts", {}));
            return accounts.filter((account) => account.status === "pending").length;
        });
    }

    async load(): Promise<ManagementState> {
        const actor = activeAccount();
        if (!canManageDirectory(actor))
            throw new Error(
                "Directory management is unavailable for this account.",
            );
        const client = requireSupabase();
        const [peopleResult, groupsResult, accountsResult] = await Promise.all([
            client.from("people").select("*").order("name"),
            client.from("deacon_groups").select("*"),
            canManageAccounts(actor)
                ? client.rpc("management_accounts", {})
                : Promise.resolve({ data: [], error: null }),
        ]);
        const people = unwrap(peopleResult),
            groups = unwrap(groupsResult);
        const accounts = unwrap(accountsResult);
        // Photos enrich the list but must never prevent an administrator from reaching
        // account approval or directory-management controls.
        const photos = await privatePhotoSources(
            people.map((row) => row.photo_path),
        ).catch(() => new Map());
        return {
            members: people.map((row) => ({
                id: row.id,
                name: row.name,
                group:
                    groups.find((group) => group.id === row.membership_group_id)
                        ?.name ?? "",
                archived: Boolean(row.archived_at),
                leftAt: row.archived_at,
                revision: row.revision,
                phone: row.phone,
                email: row.email,
                photoPath: row.photo_path,
                photo: row.photo_path ? photos.get(row.photo_path) : undefined,
            })),
            accounts: accounts.map((row) => ({
                id: row.id,
                name: row.display_name,
                email: row.email ?? "",
                status: row.status,
                role: row.role,
                personId: row.person_id,
                revision: row.revision,
                createdAt: row.created_at,
            })),
        };
    }
    async loadAccount(accountId: string): Promise<ManagementState> {
        const actor = activeAccount();
        if (!canManageAccounts(actor))
            throw new Error(
                "Account management is unavailable for this account.",
            );
        const client = requireSupabase();
        const accounts = unwrap(
            await client.rpc("management_accounts", {}),
        ).map((row) => ({
            id: row.id,
            name: row.display_name,
            email: row.email ?? "",
            status: row.status,
            role: row.role,
            personId: row.person_id,
            revision: row.revision,
            createdAt: row.created_at,
        }));
        const account = accounts.find(
            (candidate) => candidate.id === accountId,
        );
        if (!account?.personId) return { accounts, members: [] };
        const [personResult, groupsResult] = await Promise.all([
            client
                .from("people")
                .select("*")
                .eq("id", account.personId)
                .maybeSingle(),
            client.from("deacon_groups").select("*"),
        ]);
        if (personResult.error) throw new Error(personResult.error.message);
        if (!personResult.data) return { accounts, members: [] };
        const row = personResult.data;
        const groups = unwrap(groupsResult);
        const photos = await privatePhotoSources([row.photo_path]).catch(
            () => new Map(),
        );
        return {
            accounts,
            members: [
                {
                    id: row.id,
                    name: row.name,
                    group:
                        groups.find(
                            (group) => group.id === row.membership_group_id,
                        )?.name ?? "",
                    archived: Boolean(row.archived_at),
                    leftAt: row.archived_at,
                    revision: row.revision,
                    phone: row.phone,
                    email: row.email,
                    photoPath: row.photo_path,
                    photo: row.photo_path
                        ? photos.get(row.photo_path)
                        : undefined,
                },
            ],
        };
    }
    async loadMember(id: string): Promise<ManagedMember | null> {
        if (!canManageDirectory(activeAccount()))
            throw new Error("Not authorized.");
        const client = requireSupabase();
        const [personResult, groupsResult, detailsResult] = await Promise.all([
            client.from("people").select("*").eq("id", id).maybeSingle(),
            client.from("deacon_groups").select("*"),
            client.rpc("management_member_care_details", { p_person_id: id }),
        ]);
        if (personResult.error) throw new Error(personResult.error.message);
        if (!personResult.data) return null;
        const row = personResult.data;
        const groups = unwrap(groupsResult);
        const details = unwrap(detailsResult)[0];
        const photos = await privatePhotoSources([row.photo_path], "original");
        return {
            id: row.id,
            name: row.name,
            group:
                groups.find((group) => group.id === row.membership_group_id)
                    ?.name ?? "",
            archived: Boolean(row.archived_at),
            leftAt: row.archived_at,
            revision: row.revision,
            birthday: details?.birth_date ?? null,
            address: details?.address ?? null,
            isOrphan: Boolean(details?.orphan_status),
            isWidow: [
                "widow",
                "widowed",
                "вдова",
                "вдівець",
                "вдівець/вдова",
            ].includes(
                details?.marital_status?.trim().toLocaleLowerCase() ?? "",
            ),
            ministryIds: details?.ministry_ids ?? [],
            phone: row.phone,
            email: row.email,
            photoPath: row.photo_path,
            photo: row.photo_path ? photos.get(row.photo_path) : undefined,
        };
    }
    async apply(
        state: ManagementState,
        action: ManagementAction,
    ): Promise<ManagementState> {
        const actor = activeAccount();
        if (action.type === "toggle-member-archive") {
            const snapshot = state.members.find(
                (item) => item.id === action.memberId,
            );
            if (snapshot?.revision == null)
                throw new Error("Reload this member before making changes.");
            await this.setMembershipActive(snapshot, snapshot.archived);
        } else {
            if (!canManageAccounts(actor)) throw new Error("Not authorized.");
            const snapshot = state.accounts.find(
                (item) => item.id === action.accountId,
            );
            if (snapshot?.revision == null)
                throw new Error("Reload this account before making changes.");
            if (
                action.type === "link-account" &&
                action.personId &&
                snapshot.email
            ) {
                const currentResult = await requireSupabase()
                    .from("people")
                    .select("*")
                    .eq("id", action.personId)
                    .single();
                const current = unwrap(currentResult);
                if (current.email !== snapshot.email)
                    await this.saveMember(current.id, current.revision, {
                        name: current.name,
                        email: snapshot.email,
                    });
            }
            unwrap(
                await requireSupabase().rpc("update_account", {
                    p_id: snapshot.id,
                    p_revision: snapshot.revision,
                    p_status:
                        action.type === "unlink-account"
                            ? "pending"
                            : action.type === "set-account-status"
                              ? action.status
                              : snapshot.status,
                    p_role:
                        action.type === "set-account-role"
                            ? action.role
                            : snapshot.role,
                    p_person_id:
                        action.type === "unlink-account"
                            ? null
                            : action.type === "link-account"
                              ? action.personId
                              : (snapshot.personId ?? null),
                }),
            );
            this.notifyAccountChanges();
        }
        return action.type === "toggle-member-archive"
            ? this.load()
            : this.loadAccount(action.accountId);
    }
    async saveMember(id: string | null, revision: number | null, data: Json) {
        if (!canManageDirectory(activeAccount()))
            throw new Error("Not authorized.");
        const saved = unwrap(
            await requireSupabase().rpc("save_person", {
                p_id: id,
                p_revision: revision,
                p_data: data,
            }),
        );
        invalidateData("directory", "groups", "duty");
        return saved;
    }
    async listMinistries(): Promise<ManagedMinistry[]> {
        if (!canManageDirectory(activeAccount()))
            throw new Error("Not authorized.");
        const rows = unwrap(
            await requireSupabase()
                .from("ministries")
                .select("*")
                .order("name"),
        );
        return rows.map((row) => ({
            id: row.id,
            name: row.name,
            nameUk: row.name_uk || null,
            systemKey: row.system_key,
            archived: Boolean(row.archived_at),
            revision: row.revision,
        }));
    }
    async saveMinistry(ministry: {
        id?: string | null;
        revision?: number | null;
        name: string;
        nameUk?: string | null;
        archived?: boolean;
    }) {
        if (!canManageDirectory(activeAccount()))
            throw new Error("Not authorized.");
        const saved = unwrap(
            await requireSupabase().rpc("save_ministry", {
                p_id: ministry.id ?? null,
                p_revision: ministry.revision ?? null,
                p_name: ministry.name,
                p_name_uk: null,
                p_archived: ministry.archived ?? false,
            }),
        );
        invalidateData("directory", "groups", "duty");
        return saved;
    }
    async saveMemberDetails(member: {
        id?: string | null;
        revision?: number | null;
        name: string;
        birthday?: string | null;
        ministryIds?: string[];
        phone?: string | null;
        email?: string | null;
        address?: string | null;
        isOrphan?: boolean;
        isWidow?: boolean;
    }) {
        if (!canManageDirectory(activeAccount()))
            throw new Error("Not authorized.");
        const saved = unwrap(
            await requireSupabase().rpc("save_person", {
                p_id: member.id ?? null,
                p_revision: member.revision ?? null,
                p_data: {
                    name: member.name,
                    birth_date: member.birthday ?? null,
                    ministry_ids: member.ministryIds ?? [],
                    phone: member.phone ?? null,
                    email: member.email ?? null,
                    address: member.address ?? null,
                    orphan_status: member.isOrphan ?? false,
                    widow_status: member.isWidow ?? false,
                },
            }),
        );
        invalidateData("directory", "groups", "duty");
        return saved;
    }
    async setMembershipActive(member: ManagedMember, active: boolean) {
        if (!canManageDirectory(activeAccount()))
            throw new Error("Not authorized.");
        if (member.archived === !active) return member;
        if (!active) {
            const groups = await this.loadGroupManagement();
            for (const group of groups.groups.filter(
                (item) =>
                    item.memberIds.includes(member.id) ||
                    item.deaconIds.includes(member.id),
            )) {
                await this.saveGroup({
                    p_id: group.id,
                    p_revision: group.revision,
                    p_name: group.name,
                    p_kind: group.kind,
                    p_archived: group.archived,
                    p_deacon_ids: group.deaconIds.filter(
                        (id) => id !== member.id,
                    ),
                    p_member_ids: group.memberIds.filter(
                        (id) => id !== member.id,
                    ),
                });
            }
        }
        const currentResult = await requireSupabase()
            .from("people")
            .select("*")
            .eq("id", member.id)
            .single();
        const current = unwrap(currentResult);
        await this.saveMember(current.id, current.revision, {
            ...personData(current),
            membership_group_id: null,
            archived: !active,
        });
        return this.loadMember(member.id);
    }
    async saveAccount(
        args: Database["public"]["Functions"]["update_account"]["Args"],
    ) {
        if (!canManageAccounts(activeAccount()))
            throw new Error("Not authorized.");
        const saved = unwrap(await requireSupabase().rpc("update_account", args));
        this.notifyAccountChanges();
        return saved;
    }
    async listGroups() {
        if (!canManageDirectory(activeAccount()))
            throw new Error("Not authorized.");
        return unwrap(
            await requireSupabase()
                .from("deacon_groups")
                .select("*")
                .order("name"),
        );
    }
    async loadGroupManagement(): Promise<GroupManagementState> {
        if (!canManageDirectory(activeAccount()))
            throw new Error("Not authorized.");
        const client = requireSupabase();
        const [
            groupsResult,
            peopleResult,
            responsibilityMembersResult,
            assignmentsResult,
            leadershipResult,
        ] = await Promise.all([
            client
                .from("deacon_groups")
                .select("*")
                .is("archived_at", null)
                .order("name"),
            client
                .from("people")
                .select("id,name,photo_path,membership_group_id")
                .is("archived_at", null),
            client.from("deacon_group_members").select("*"),
            client.from("deacon_group_deacons").select("*").order("slot"),
            client
                .from("person_leadership_ministries")
                .select("person_id")
                .eq("leadership_ministry", "deacon"),
        ]);
        const groups = unwrap(groupsResult),
            people = unwrap(peopleResult),
            responsibilityMembers = unwrap(responsibilityMembersResult),
            assignments = unwrap(assignmentsResult),
            leadership = unwrap(leadershipResult);
        const deaconPersonIds = new Set(leadership.map((row) => row.person_id));
        const deaconPeople = people.filter((person) =>
            deaconPersonIds.has(person.id),
        );
        const photos = await privatePhotoSources(
            people.map((person) => person.photo_path),
        ).catch(() => new Map());
        const managedGroups: ManagedGroup[] = groups.map((group) => ({
            id: group.id,
            name: group.name,
            kind: group.kind,
            archived: Boolean(group.archived_at),
            revision: group.revision,
            memberIds:
                group.kind === "membership"
                    ? people
                          .filter(
                              (person) =>
                                  person.membership_group_id === group.id,
                          )
                          .map((person) => person.id)
                    : responsibilityMembers
                          .filter((member) => member.group_id === group.id)
                          .map((member) => member.person_id),
            deaconIds: assignments
                .filter((assignment) => assignment.group_id === group.id)
                .sort((left, right) => left.slot - right.slot)
                .map((assignment) => assignment.person_id),
        }));
        const deacons: ManagedDeacon[] = deaconPeople.map((person) => ({
            personId: person.id,
            name: person.name,
            currentGroupId:
                assignments.find(
                    (assignment) => assignment.person_id === person.id,
                )?.group_id ?? null,
            photo: person.photo_path
                ? photos.get(person.photo_path)
                : undefined,
        }));
        const members: ManagedGroupMember[] = people.map((person) => ({
            personId: person.id,
            name: person.name,
            currentMembershipGroupId: person.membership_group_id,
            currentResponsibilityGroupId:
                responsibilityMembers.find(
                    (member) => member.person_id === person.id,
                )?.group_id ?? null,
            photo: person.photo_path
                ? photos.get(person.photo_path)
                : undefined,
        }));
        return {
            groups: managedGroups,
            deacons: deacons.sort((left, right) =>
                left.name.localeCompare(right.name),
            ),
            members: members.sort((left, right) =>
                left.name.localeCompare(right.name),
            ),
        };
    }
    async saveGroup(
        args: Database["public"]["Functions"]["save_group"]["Args"],
    ) {
        if (!canManageDirectory(activeAccount()))
            throw new Error("Not authorized.");
        const saved = unwrap(await requireSupabase().rpc("save_group", args));
        invalidateData("groups", "directory", "duty");
        return saved;
    }
    async deleteGroup(id: string, revision: number) {
        if (!canManageDirectory(activeAccount()))
            throw new Error("Not authorized.");
        const { error } = await requireSupabase().rpc("delete_group", {
            p_id: id,
            p_revision: revision,
        });
        if (error) throw new Error(error.message);
        invalidateData("groups", "directory", "duty");
    }
    async replacePhoto(
        person: {
            id: string;
            revision: number;
            photo_path?: string | null;
            photoPath?: string | null;
        },
        bytes: ArrayBuffer | null,
        mimeType?: "image/jpeg" | "image/png" | "image/webp",
        thumbnail?: ArrayBuffer,
    ) {
        if (!canManageDirectory(activeAccount()))
            throw new Error("Not authorized.");
        const client = requireSupabase();
        let path: string | null = null;
        if (bytes) {
            if (
                mimeType !== "image/jpeg" ||
                bytes.byteLength === 0 ||
                bytes.byteLength > 512 * 1024
            )
                throw new Error(
                    "The optimized JPEG photo must be 512 KB or smaller. Choose the photo again.",
                );
            if (!thumbnail?.byteLength || thumbnail.byteLength > 50 * 1024)
                throw new Error("The photo thumbnail is unavailable. Choose the photo again.");
                        path = `${person.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
            const { error } = await client.storage
                .from("member-photos")
                .upload(path, bytes, { contentType: mimeType, upsert: false });
            if (error) throw new Error(error.message);
            try {
                const upload = await client.storage.from("member-photos").upload(thumbnailPath(path), thumbnail, { contentType: "image/jpeg", upsert: false });
                if (upload.error) throw new Error(upload.error.message);
            } catch (cause) {
                const cleanup = await client.storage.from("member-photos").remove([path, thumbnailPath(path)]);
                if (cleanup.error) throw new Error("Photo upload failed and temporary files could not be removed. Contact an administrator.");
                throw cause;
            }
        }
        const result = await client.rpc("set_person_photo", {
            p_id: person.id,
            p_revision: person.revision,
            p_path: path,
        });
        if (result.error) {
            if (path) {
                const current = await client.from("people").select("photo_path").eq("id", person.id).maybeSingle();
                if (current.error || !current.data || current.data.photo_path === path)
                    throw new Error("The photo update could not be confirmed. Reload the member before retrying.");
                const cleanup = await client.storage.from("member-photos").remove([path, thumbnailPath(path)]);
                if (cleanup.error) throw new Error("Photo update failed and temporary files could not be removed. Contact an administrator.");
            }
            throw new Error(result.error.message);
        }
        invalidateData("directory", "groups", "photos");
        const previous = person.photo_path ?? person.photoPath ?? null;
        let cleanupWarning: string | null = null;
        if (previous && previous !== path) {
            try {
                const references = await client.from("people").select("id").eq("photo_path", previous).limit(1);
                if (references.error) throw references.error;
                if (!references.data?.length) {
                    const { error } = await client.storage.from("member-photos").remove([previous, thumbnailPath(previous)]);
                    if (error) throw error;
                }
            } catch {
                cleanupWarning = "The previous photo could not be removed. Please contact an administrator.";
            }
        }
        return { person: unwrap(result), cleanupWarning };
    }
}
function personData(person: PersonRow) {
    return {
        name: person.name,
        ministry: person.ministry,
        ministry_uk: person.ministry_uk,
        phone: person.phone,
        email: person.email,
        membership_group_id: person.membership_group_id,
        archived: Boolean(person.archived_at),
    };
}
class InMemoryManagementRepository {
    private state = structuredClone(initialManagementState);
    private readonly accountChangeListeners = new Set<AccountChangeListener>();

    subscribeAccountChanges(listener: AccountChangeListener) {
        this.accountChangeListeners.add(listener);
        return () => this.accountChangeListeners.delete(listener);
    }

    private notifyAccountChanges() {
        for (const listener of this.accountChangeListeners) listener();
    }

    async loadPendingAccountCount() {
        return this.state.accounts.filter((account) => account.status === "pending").length;
    }

    async load() {
        return structuredClone(this.state);
    }
    async loadAccount(accountId: string) {
        return structuredClone({
            accounts: this.state.accounts,
            members: this.state.members.filter(
                (member) =>
                    member.id ===
                    this.state.accounts.find(
                        (account) => account.id === accountId,
                    )?.personId,
            ),
        });
    }
    async loadMember(id: string) {
        return structuredClone(
            this.state.members.find((member) => member.id === id) ?? null,
        );
    }
    async saveMember(id: string | null, _revision: number | null, data: Json) {
        if (id) return this.load();
        const name =
            typeof data === "object" &&
            data !== null &&
            !Array.isArray(data) &&
            typeof data.name === "string"
                ? data.name
                : "";
        this.state.members.push({
            id: `member-${Date.now()}`,
            name,
            group: "",
            archived: false,
            revision: 1,
        });
        return this.load();
    }
    private ministries: ManagedMinistry[] = [
        {
            id: "ministry-worship",
            name: "Worship",
            nameUk: "Служіння прославлення",
            archived: false,
            revision: 1,
        },
        {
            id: "ministry-youth",
            name: "Youth",
            nameUk: "Молодь",
            archived: false,
            revision: 1,
        },
    ];
    private groupManagement: GroupManagementState = {
        groups: [
            {
                id: "group-one",
                name: "Група один",
                kind: "membership",
                archived: false,
                revision: 1,
                memberIds: ["maria-ivanova"],
                deaconIds: ["deacon-slav", "deacon-alina"],
            },
        ],
        deacons: [
            {
                accountId: "deacon-slav",
                personId: "yaroslav-salo",
                name: "Yaroslav Salo",
                currentGroupId: "group-one",
            },
            {
                accountId: "deacon-alina",
                personId: "alina-belashov",
                name: "Alina Belashov",
                currentGroupId: "group-one",
            },
        ],
        members: [
            {
                personId: "maria-ivanova",
                name: "Maria Ivanova",
                currentMembershipGroupId: "group-one",
                currentResponsibilityGroupId: null,
            },
            {
                personId: "daniel-kovalenko",
                name: "Daniel Kovalenko",
                currentMembershipGroupId: null,
                currentResponsibilityGroupId: null,
            },
            {
                personId: "olena-petrenko",
                name: "Olena Petrenko",
                currentMembershipGroupId: null,
                currentResponsibilityGroupId: null,
            },
            {
                personId: "yaroslav-salo",
                name: "Yaroslav Salo",
                currentMembershipGroupId: null,
                currentResponsibilityGroupId: null,
            },
            {
                personId: "alina-belashov",
                name: "Alina Belashov",
                currentMembershipGroupId: null,
                currentResponsibilityGroupId: null,
            },
        ],
    };
    async listMinistries() {
        return structuredClone(this.ministries);
    }
    async saveMinistry(ministry: {
        id?: string | null;
        revision?: number | null;
        name: string;
        nameUk?: string | null;
        archived?: boolean;
    }) {
        const item = ministry.id
            ? this.ministries.find((m) => m.id === ministry.id)
            : undefined;
        if (item)
            Object.assign(item, {
                name: ministry.name,
                nameUk: ministry.nameUk ?? null,
                archived: ministry.archived ?? false,
                revision: (item.revision ?? 0) + 1,
            });
        else
            this.ministries.push({
                id: `ministry-${Date.now()}`,
                name: ministry.name,
                nameUk: ministry.nameUk ?? null,
                archived: false,
                revision: 1,
            });
        return item ?? this.ministries.at(-1);
    }
    async saveMemberDetails(member: {
        id?: string | null;
        revision?: number | null;
        name: string;
        birthday?: string | null;
        ministryIds?: string[];
        phone?: string | null;
        email?: string | null;
        address?: string | null;
    }) {
        let saved = member.id
            ? this.state.members.find((m) => m.id === member.id)
            : undefined;
        if (saved)
            Object.assign(saved, {
                name: member.name,
                birthday: member.birthday ?? null,
                ministryIds: member.ministryIds ?? [],
                phone: member.phone ?? null,
                email: member.email ?? null,
                address: member.address ?? null,
                revision: (saved.revision ?? 0) + 1,
            });
        else {
            saved = {
                id: `member-${Date.now()}`,
                name: member.name,
                group: "",
                archived: false,
                revision: 1,
                birthday: member.birthday ?? null,
                ministryIds: member.ministryIds ?? [],
                phone: member.phone ?? null,
                email: member.email ?? null,
                address: member.address ?? null,
                photoPath: null,
            };
            this.state.members.push(saved);
        }
        return structuredClone(saved);
    }
    async setMembershipActive(member: ManagedMember, active: boolean) {
        if (member.archived === !active) return structuredClone(member);
        this.state = managementReducer(this.state, {
            type: "toggle-member-archive",
            memberId: member.id,
        });
        return structuredClone(
            this.state.members.find((item) => item.id === member.id),
        );
    }
    async loadGroupManagement() {
        return structuredClone(this.groupManagement);
    }
    async listGroups() {
        return structuredClone(this.groupManagement.groups);
    }
    async saveGroup(
        args: Database["public"]["Functions"]["save_group"]["Args"],
    ) {
        const nextName = args.p_name.trim();
        if (!nextName) throw new Error("Enter a group name.");
        let existing = this.groupManagement.groups.find(
            (item) => item.id === args.p_id,
        );
        if (!existing) {
            if (args.p_id) throw new Error("Group not found.");
            const nextKind =
                args.p_kind === "responsibility"
                    ? "responsibility"
                    : "membership";
            existing = {
                id: `group-${Date.now()}`,
                name: nextName,
                kind: nextKind,
                archived: false,
                revision: 1,
                memberIds: [],
                deaconIds: [],
            };
            this.groupManagement.groups.push(existing);
        } else {
            existing.name = nextName;
            existing.revision += 1;
        }
        const group = existing;
        const selectedDeacons = args.p_deacon_ids;
        const selectedMembers = args.p_member_ids.filter(
            (id) => !selectedDeacons.includes(id),
        );
        this.groupManagement.groups.forEach((item) => {
            item.deaconIds =
                item.id === group.id
                    ? [...selectedDeacons]
                    : item.deaconIds.filter(
                          (id) => !selectedDeacons.includes(id),
                      );
            if (item.kind === group.kind)
                item.memberIds =
                    item.id === group.id
                        ? [...selectedMembers]
                        : item.memberIds.filter(
                              (id) => !selectedMembers.includes(id),
                          );
        });
        this.groupManagement.deacons.forEach((deacon) => {
            deacon.currentGroupId = selectedDeacons.includes(deacon.personId)
                ? group.id
                : deacon.currentGroupId === group.id
                  ? null
                  : deacon.currentGroupId;
        });
        this.groupManagement.members.forEach((member) => {
            const key =
                group.kind === "membership"
                    ? "currentMembershipGroupId"
                    : "currentResponsibilityGroupId";
            member[key] = selectedMembers.includes(member.personId)
                ? group.id
                : member[key] === group.id
                  ? null
                  : member[key];
        });
        return structuredClone(group);
    }
    async deleteGroup(id: string, revision: number) {
        const group = this.groupManagement.groups.find(
            (item) => item.id === id,
        );
        if (!group || group.revision !== revision)
            throw new Error("Conflict: group changed. Reload and try again.");
        this.groupManagement.groups = this.groupManagement.groups.filter(
            (item) => item.id !== id,
        );
        this.groupManagement.deacons.forEach((deacon) => {
            if (deacon.currentGroupId === id) deacon.currentGroupId = null;
        });
        this.groupManagement.members.forEach((member) => {
            if (member.currentMembershipGroupId === id)
                member.currentMembershipGroupId = null;
            if (member.currentResponsibilityGroupId === id)
                member.currentResponsibilityGroupId = null;
        });
    }
    async replacePhoto(
        person: {
            id: string;
            revision: number;
            photo_path?: string | null;
            photoPath?: string | null;
        },
        bytes: ArrayBuffer | null,
        mimeType?: "image/jpeg" | "image/png" | "image/webp",
    ) {
        if (
            bytes &&
            (!mimeType ||
                bytes.byteLength === 0 ||
                bytes.byteLength > 5 * 1024 * 1024)
        )
            throw new Error(
                "Choose a JPEG, PNG or WebP photo smaller than 5 MB.",
            );
        const member = this.state.members.find((item) => item.id === person.id);
        if (member) member.photoPath = bytes ? `local:${Date.now()}` : null;
        return { person: structuredClone(member), cleanupWarning: null };
    }
    async apply(state: ManagementState, action: ManagementAction) {
        this.state = managementReducer(state, action);
        if (action.type !== "toggle-member-archive") this.notifyAccountChanges();
        return this.load();
    }
}
export const managementRepository = isBackendConfigured
    ? new SupabaseManagementRepository()
    : new InMemoryManagementRepository();
