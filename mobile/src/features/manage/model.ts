export type ManagedMember = {
  id: string;
  name: string;
  group: string;
  archived: boolean;
  revision?: number;
  birthday?: string | null;
  ministryIds?: string[];
  phone?: string | null;
  address?: string | null;
  photoPath?: string | null;
  photo?: import("react-native").ImageSourcePropType;
};

export type ManagedMinistry = { id: string; name: string; nameUk?: string | null; archived: boolean; revision?: number };

export type ManagedGroup = {
  id: string;
  name: string;
  kind: "membership" | "responsibility";
  archived: boolean;
  revision: number;
  memberIds: string[];
  deaconIds: string[];
};

export type ManagedDeacon = {
  accountId: string;
  personId: string;
  name: string;
  currentGroupId: string | null;
  photo?: import("react-native").ImageSourcePropType;
};

export type GroupManagementState = { groups: ManagedGroup[]; deacons: ManagedDeacon[] };

export type ManagedAccount = {
  id: string;
  name: string;
  email: string;
  createdAt?: string;
  status: "pending" | "active" | "denied" | "revoked";
  role: "member" | "editor" | "admin";
  designation?: "none" | "pastor" | "deacon";
  personId?: string | null;
  revision?: number;
};

export type ManagementState = {
  accounts: ManagedAccount[];
  members: ManagedMember[];
};

export const initialManagementState: ManagementState = {
  members: [
    { id: "maria-ivanova", name: "Maria Ivanova", group: "Northside", archived: false },
    { id: "daniel-kovalenko", name: "Daniel Kovalenko", group: "Downtown", archived: false },
    { id: "olena-petrenko", name: "Olena Petrenko", group: "Not assigned", archived: true },
  ],
  accounts: [
    { id: "a-1", name: "Kateryna Bondar", email: "kateryna@example.com", status: "pending", role: "member", createdAt: "2026-09-16T20:00:00.000Z" },
    { id: "a-2", name: "Yaroslav Salo", email: "ysalo@example.com", status: "active", role: "admin", createdAt: "2026-09-15T20:00:00.000Z" },
    { id: "a-3", name: "Andriy Melnyk", email: "andriy@example.com", status: "revoked", role: "member", createdAt: "2026-09-14T20:00:00.000Z" },
  ],
};

export function pendingAccounts(accounts: readonly ManagedAccount[]): ManagedAccount[] {
  return accounts
    .filter((account) => account.status === "pending")
    .sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? ""));
}

export function orderedAccounts(accounts: readonly ManagedAccount[]): ManagedAccount[] {
  const statusOrder: Record<ManagedAccount["status"], number> = { pending: 0, active: 1, denied: 2, revoked: 3 };
  return [...accounts].sort((left, right) => statusOrder[left.status] - statusOrder[right.status] || left.name.localeCompare(right.name));
}

export type ManagementAction =
  | { type: "toggle-member-archive"; memberId: string }
  | { type: "set-account-status"; accountId: string; status: ManagedAccount["status"] }
  | { type: "set-account-role"; accountId: string; role: ManagedAccount["role"] }
  | { type: "set-account-designation"; accountId: string; designation: NonNullable<ManagedAccount["designation"]> }
  | { type: "link-account"; accountId: string; personId: string | null };

export function managementReducer(state: ManagementState, action: ManagementAction): ManagementState {
  switch (action.type) {
    case "toggle-member-archive":
      return {
        ...state,
        members: state.members.map((member) => member.id === action.memberId ? { ...member, archived: !member.archived } : member),
      };
    case "set-account-status":
      return {
        ...state,
        accounts: state.accounts.map((account) => account.id === action.accountId ? { ...account, status: action.status } : account),
      };
    case "set-account-role": {
      const target = state.accounts.find((account) => account.id === action.accountId);
      const activeAdmins = state.accounts.filter((account) => account.status === "active" && account.role === "admin");
      if (target?.status === "active" && target.role === "admin" && action.role !== "admin" && activeAdmins.length === 1) return state;
      return {
        ...state,
        accounts: state.accounts.map((account) => account.id === action.accountId ? { ...account, role: action.role } : account),
      };
    }
    case "set-account-designation":
      return {
        ...state,
        accounts: state.accounts.map((account) => account.id === action.accountId ? { ...account, designation: action.designation } : account),
      };
    case "link-account":
      return {
        ...state,
        accounts: state.accounts.map((account) => account.id === action.accountId ? { ...account, personId: action.personId } : account),
      };
    default:
      return state;
  }
}
