import type { ImageSourcePropType } from "react-native";
import type { ManagedAccount, ManagedGroup, ManagedMember } from "./model";

export const MANAGEMENT_PAGE_SIZE = 50;
export type ManagementPage<T> = {
  items: T[];
  total: number;
  offset: number;
  limit: number;
};
export type ManagementSummary = {
  members: number;
  formerMembers: number;
  groups: number;
  pendingAccounts: number | null;
};
export type ManagedGroupSummary = Pick<
  ManagedGroup,
  "id" | "name" | "kind" | "revision"
> & { memberCount: number; deaconCount: number };
export type ManagementCandidate = ManagedMember & {
  birthDate: string | null;
  currentMembershipGroupId: string | null;
  currentMembershipGroupName: string | null;
  currentResponsibilityGroupId: string | null;
  currentResponsibilityGroupName: string | null;
  currentDeaconGroupId: string | null;
  currentDeaconGroupName: string | null;
  photo?: ImageSourcePropType;
};
export type ManagementFilters = {
  archived?: boolean;
  status?: ManagedAccount["status"] | "all";
  kind?: ManagedGroup["kind"] | "all";
  selectedOnly?: boolean;
  selectedIds?: string[];
  deacons?: boolean;
  linkable?: boolean;
  accountId?: string;
  id?: string;
};
export type ManagementPageRequest = {
  query?: string;
  offset?: number;
  limit?: number;
  filters?: ManagementFilters;
};
export type ManagementReadContract = {
  loadSummary(): Promise<ManagementSummary>;
  loadMembersPage(
    request?: ManagementPageRequest,
  ): Promise<ManagementPage<ManagedMember>>;
  loadAccountsPage(
    request?: ManagementPageRequest,
  ): Promise<ManagementPage<ManagedAccount>>;
  loadGroupsPage(
    request?: ManagementPageRequest,
  ): Promise<ManagementPage<ManagedGroupSummary>>;
  loadCandidatesPage(
    request?: ManagementPageRequest,
  ): Promise<ManagementPage<ManagementCandidate>>;
  loadGroupImportCatalog(): Promise<import("./model").GroupManagementState>;
  loadGroupContext(groupId?: string): Promise<{ group: ManagedGroup | null }>;
  previewGroupMoves(
    groupId: string | null,
    kind: ManagedGroup["kind"],
    memberIds: string[],
    deaconIds: string[],
  ): Promise<number>;
};
