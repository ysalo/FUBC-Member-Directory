import type { Json } from "@/lib/database";
import {
  activeAccount,
  privatePhotoSources,
  unwrap,
} from "@/lib/repository-helpers";
import { requireSupabase } from "@/lib/supabase";
import { canManageAccounts, canManageDirectory } from "@/lib/permissions";
import { searchMembers } from "@/lib/member-search";
import type {
  GroupManagementState,
  ManagementState,
  ManagedGroup,
  ManagedAccount,
  ManagedMember,
} from "./model";
import { orderedAccounts } from "./model";
import {
  MANAGEMENT_PAGE_SIZE,
  type ManagementPageRequest,
  type ManagementPage,
  type ManagementReadContract,
  type ManagementSummary,
  type ManagementCandidate,
  type ManagedGroupSummary,
} from "./management-read-model";

export class SupabaseManagementReads implements ManagementReadContract {
  async loadSummary(): Promise<ManagementSummary> {
    if (!canManageDirectory(activeAccount()))
      throw new Error("Not authorized.");
    return unwrap(
      await requireSupabase().rpc("management_summary"),
    ) as unknown as ManagementSummary;
  }
  private async page<
    T extends { photoPath?: string | null; photo?: ManagedMember["photo"] },
  >(
    resource: string,
    request: ManagementPageRequest,
  ): Promise<ManagementPage<T>> {
    if (
      !canManageDirectory(activeAccount()) ||
      (resource === "accounts" && !canManageAccounts(activeAccount()))
    )
      throw new Error("Not authorized.");
    const page = unwrap(
      await requireSupabase().rpc("management_page", {
        p_resource: resource,
        p_query: (request.query ?? "").trim().slice(0, 120),
        p_filters: (request.filters ?? {}) as Json,
        p_limit: Math.max(
          1,
          Math.min(request.limit ?? MANAGEMENT_PAGE_SIZE, 100),
        ),
        p_offset: Math.max(0, request.offset ?? 0),
      }),
    ) as unknown as ManagementPage<T>;
    if (
      !page ||
      !Array.isArray(page.items) ||
      !Number.isSafeInteger(page.total) ||
      page.items.length > 100
    )
      throw new Error("Invalid management page. Please try again.");
    const photos = await privatePhotoSources(
      page.items.map((item) => item.photoPath ?? null),
    ).catch(() => new Map());
    return {
      ...page,
      items: page.items.map((item) => ({
        ...item,
        photo: item.photoPath ? photos.get(item.photoPath) : undefined,
      })),
    };
  }
  loadMembersPage(request: ManagementPageRequest = {}) {
    return this.page<ManagedMember>("members", request);
  }
  // Account/group pages do not request or sign member photos.
  async loadAccountsPage(
    request: ManagementPageRequest = {},
  ): Promise<ManagementPage<ManagedAccount>> {
    if (!canManageAccounts(activeAccount())) throw new Error("Not authorized.");
    return unwrap(
      await requireSupabase().rpc("management_page", {
        p_resource: "accounts",
        p_query: request.query ?? "",
        p_filters: (request.filters ?? {}) as Json,
        p_limit: Math.min(request.limit ?? MANAGEMENT_PAGE_SIZE, 100),
        p_offset: request.offset ?? 0,
      }),
    ) as unknown as ManagementPage<ManagedAccount>;
  }
  async loadGroupsPage(
    request: ManagementPageRequest = {},
  ): Promise<ManagementPage<ManagedGroupSummary>> {
    if (!canManageDirectory(activeAccount()))
      throw new Error("Not authorized.");
    return unwrap(
      await requireSupabase().rpc("management_page", {
        p_resource: "groups",
        p_query: request.query ?? "",
        p_filters: (request.filters ?? {}) as Json,
        p_limit: Math.min(request.limit ?? MANAGEMENT_PAGE_SIZE, 100),
        p_offset: request.offset ?? 0,
      }),
    ) as unknown as ManagementPage<ManagedGroupSummary>;
  }
  loadCandidatesPage(request: ManagementPageRequest = {}) {
    return this.page<ManagementCandidate>("candidates", request);
  }
  /** Explicit import only: complete matching metadata in bounded batches, without photos. */
  async loadGroupImportCatalog(): Promise<GroupManagementState> {
    if (!canManageDirectory(activeAccount()))
      throw new Error("Not authorized.");
    async function collect(deacons: boolean) {
      const items: ManagementCandidate[] = [];
      let offset = 0;
      for (;;) {
        const result = unwrap(
          await requireSupabase().rpc("management_page", {
            p_resource: "candidates",
            p_filters: { deacons },
            p_limit: 100,
            p_offset: offset,
          }),
        ) as unknown as ManagementPage<ManagementCandidate>;
        if (!result.items.length && result.total > offset)
          throw new Error(
            "The import roster changed. Close and reopen import.",
          );
        items.push(...result.items);
        offset += result.items.length;
        if (offset >= result.total) return items;
      }
    }
    const [members, deacons] = await Promise.all([
      collect(false),
      collect(true),
    ]);
    const identity = (person: ManagementCandidate) => ({
      personId: person.id,
      name: person.name,
      birthDate: person.birthDate,
      importName:
        [person.last_name, person.first_name, person.patronymic]
          .filter(Boolean)
          .join(" ") || person.name,
    });
    return {
      groups: [],
      members: members.map((person) => ({
        ...identity(person),
        currentMembershipGroupId: person.currentMembershipGroupId,
        currentResponsibilityGroupId: person.currentResponsibilityGroupId,
      })),
      deacons: deacons.map((person) => ({
        ...identity(person),
        currentGroupId: person.currentDeaconGroupId,
      })),
    };
  }
  async loadGroupContext(
    groupId?: string,
  ): Promise<{ group: ManagedGroup | null }> {
    if (!canManageDirectory(activeAccount()))
      throw new Error("Not authorized.");
    return unwrap(
      await requireSupabase().rpc("management_group_context", {
        p_group_id: groupId ?? null,
      }),
    ) as unknown as { group: ManagedGroup | null };
  }
  async previewGroupMoves(
    groupId: string | null,
    kind: ManagedGroup["kind"],
    memberIds: string[],
    deaconIds: string[],
  ) {
    if (!canManageDirectory(activeAccount()))
      throw new Error("Not authorized.");
    return unwrap(
      await requireSupabase().rpc("management_group_move_preview", {
        p_group_id: groupId,
        p_kind: kind,
        p_member_ids: memberIds,
        p_deacon_ids: deaconIds,
      }),
    );
  }
}

/** Only demonstration data is sliced in memory. Configured sessions use server pages. */
export class DemoManagementReads implements ManagementReadContract {
  constructor(
    private readonly state: () => ManagementState,
    private readonly groups: () => GroupManagementState,
  ) {}
  async loadSummary() {
    return {
      members: this.state().members.filter((m) => !m.archived).length,
      formerMembers: this.state().members.filter((m) => m.archived).length,
      groups: this.groups().groups.length,
      pendingAccounts: this.state().accounts.filter(
        (a) => a.status === "pending",
      ).length,
    };
  }
  private page<T>(
    items: T[],
    request: ManagementPageRequest,
  ): ManagementPage<T> {
    const offset = request.offset ?? 0,
      limit = request.limit ?? MANAGEMENT_PAGE_SIZE;
    return structuredClone({
      items: items.slice(offset, offset + limit),
      total: items.length,
      offset,
      limit,
    });
  }
  async loadMembersPage(request: ManagementPageRequest = {}) {
    const query = request.query?.trim() ?? "",
      filters = request.filters ?? {};
    const source = this.state().members.filter(
      (member) =>
        member.archived === Boolean(filters.archived) &&
        (!filters.id || member.id === filters.id) &&
        (!filters.linkable ||
          !this.state().accounts.some(
            (a) => a.personId === member.id && a.id !== filters.accountId,
          )),
    );
    const sorted = [...source].sort(
      (a, b) =>
        (a.last_name ?? a.name).localeCompare(b.last_name ?? b.name) ||
        a.id.localeCompare(b.id),
    );
    return this.page(
      searchMembers(sorted, query, (m) => m),
      request,
    );
  }
  async loadAccountsPage(request: ManagementPageRequest = {}) {
    const query = request.query?.trim().toLocaleLowerCase() ?? "",
      filters = request.filters ?? {};
    return this.page(
      orderedAccounts(this.state().accounts).filter(
        (a) =>
          (!filters.id || a.id === filters.id) &&
          (!filters.status ||
            filters.status === "all" ||
            a.status === filters.status) &&
          (!query ||
            `${a.name} ${a.email}`.toLocaleLowerCase().includes(query)),
      ),
      request,
    );
  }
  async loadGroupsPage(request: ManagementPageRequest = {}) {
    const query = request.query?.trim().toLocaleLowerCase() ?? "";
    return this.page(
      this.groups()
        .groups.filter(
          (g) =>
            (!query || g.name.toLocaleLowerCase().includes(query)) &&
            (!request.filters?.kind ||
              request.filters.kind === "all" ||
              g.kind === request.filters.kind),
        )
        .map((g) => ({
          ...g,
          memberCount: g.memberIds.length,
          deaconCount: g.deaconIds.length,
        })),
      request,
    );
  }
  async loadCandidatesPage(request: ManagementPageRequest = {}) {
    const data = this.groups(),
      filters = request.filters ?? {};
    const candidates: ManagementCandidate[] = data.members
      .filter(
        (m) =>
          (!filters.deacons ||
            data.deacons.some((d) => d.personId === m.personId)) &&
          (!filters.selectedOnly || filters.selectedIds?.includes(m.personId)),
      )
      .map((m) => {
        const person = this.state().members.find((p) => p.id === m.personId),
          deacon = data.deacons.find((d) => d.personId === m.personId);
        return {
          ...person,
          ...m,
          id: m.personId,
          name: m.name,
          archived: false,
          group: "",
          birthDate: m.birthDate ?? null,
          currentMembershipGroupName:
            data.groups.find((g) => g.id === m.currentMembershipGroupId)
              ?.name ?? null,
          currentResponsibilityGroupName:
            data.groups.find((g) => g.id === m.currentResponsibilityGroupId)
              ?.name ?? null,
          currentDeaconGroupId: deacon?.currentGroupId ?? null,
          currentDeaconGroupName:
            data.groups.find((g) => g.id === deacon?.currentGroupId)?.name ??
            null,
        };
      });
    return this.page(
      searchMembers(candidates, request.query ?? "", (m) => m),
      request,
    );
  }
  async loadGroupImportCatalog() {
    return structuredClone(this.groups());
  }
  async loadGroupContext(groupId?: string) {
    return structuredClone({
      group: this.groups().groups.find((g) => g.id === groupId) ?? null,
    });
  }
  async previewGroupMoves(
    groupId: string | null,
    kind: ManagedGroup["kind"],
    memberIds: string[],
    deaconIds: string[],
  ) {
    const data = this.groups();
    return (
      data.members.filter(
        (m) =>
          memberIds.includes(m.personId) &&
          !deaconIds.includes(m.personId) &&
          (kind === "membership"
            ? m.currentMembershipGroupId &&
              m.currentMembershipGroupId !== groupId
            : m.currentResponsibilityGroupId &&
              m.currentResponsibilityGroupId !== groupId),
      ).length +
      data.deacons.filter(
        (d) =>
          deaconIds.includes(d.personId) &&
          d.currentGroupId &&
          d.currentGroupId !== groupId,
      ).length
    );
  }
}
