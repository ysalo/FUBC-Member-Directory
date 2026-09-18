import type { ImageSourcePropType } from "react-native";

export type GroupMember = {
  id: string;
  name: string;
  photo?: ImageSourcePropType;
  leadershipMinistry?: "deacon" | "pastor";
  isOrphan?: boolean;
  isWidow?: boolean;
};

/** Date-only birthday projection released by a server only when the caller is an assigned deacon. */
export type AuthorizedBirthday = Pick<GroupMember, "id" | "name" | "photo"> & { month: number; day: number };

export type MinistryGroup = {
  id: string;
  name: string;
  nameUk: string;
  description: string;
  descriptionUk: string;
  kind: "membership" | "responsibility";
  responsibleDeaconIds: string[];
  memberIds: string[];
  responsibleDeacons?: GroupMember[];
};

export type GroupDetail = MinistryGroup & { members: GroupMember[] };

export type GroupSummary = { total: number; orphans: number; widows: number };

/** Boundary for the eventual Supabase view/RPC implementation. Never use UI filtering for authorization. */
export interface GroupsRepository {
  listGroups(): Promise<MinistryGroup[]>;
  getGroup(groupId: string): Promise<GroupDetail | null>;
  getAuthorizedBirthdays(groupId: string): Promise<AuthorizedBirthday[]>;
  getBirthdayNotificationsEnabled(groupId: string): Promise<boolean>;
  setBirthdayNotificationsEnabled(groupId: string, enabled: boolean): Promise<void>;
  getSummary(groupId: string): Promise<GroupSummary>;
}

const people: GroupMember[] = [
  { id: "amelia-brooks", name: "Amelia Brooks", photo: require("../../../assets/plates/avatar-amelia.png"), isOrphan: true },
  { id: "daniel-chen", name: "Daniel Chen", photo: require("../../../assets/plates/avatar-daniel.png"), leadershipMinistry: "deacon" },
  { id: "marta-kovalenko", name: "Marta Kovalenko", photo: require("../../../assets/plates/avatar-marta.png"), isWidow: true },
  { id: "noah-williams", name: "Noah Williams", photo: require("../../../assets/plates/avatar-noah.png") },
];

const birthdays: AuthorizedBirthday[] = [
  { id: "amelia-brooks", name: "Amelia Brooks", month: 5, day: 19 },
  { id: "marta-kovalenko", name: "Marta Kovalenko", month: 6, day: 2 },
];

const groups: MinistryGroup[] = [
  {
    id: "northside-families", name: "Група один", nameUk: "Група один",
    description: "Group one.", descriptionUk: "Група один.",
    kind: "responsibility", responsibleDeaconIds: ["daniel-chen"], memberIds: ["amelia-brooks", "marta-kovalenko"],
  },
  {
    id: "worship-team", name: "Група два", nameUk: "Група два",
    description: "Group two.", descriptionUk: "Група два.",
    kind: "membership", responsibleDeaconIds: [], memberIds: ["daniel-chen", "noah-williams"],
  },
  {
    id: "hospitality", name: "Група три", nameUk: "Група три",
    description: "Group three.", descriptionUk: "Група три.",
    kind: "membership", responsibleDeaconIds: [], memberIds: ["marta-kovalenko"],
  },
];

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Demo-only adapter. Its limited birthday output models a server-authorized projection. */
export class InMemoryGroupsRepository implements GroupsRepository {
  private birthdayNotifications = new Set<string>();
  async listGroups() { return clone(groups.map((group) => ({ ...group, responsibleDeacons: people.filter((person) => group.responsibleDeaconIds.includes(person.id)) }))); }
  async getGroup(groupId: string) {
    const group = groups.find((candidate) => candidate.id === groupId);
    if (!group) return null;
    return clone({ ...group, members: people.filter((person) => group.memberIds.includes(person.id)), responsibleDeacons: people.filter((person) => group.responsibleDeaconIds.includes(person.id)) });
  }
  async getAuthorizedBirthdays(groupId: string) {
    const group = groups.find((candidate) => candidate.id === groupId);
    if (!group || group.kind !== "responsibility") return [];
    return clone(birthdays.filter((person) => group.memberIds.includes(person.id)));
  }
  async getBirthdayNotificationsEnabled(groupId: string) { return this.birthdayNotifications.has(groupId); }
  async setBirthdayNotificationsEnabled(groupId: string, enabled: boolean) { if (enabled) this.birthdayNotifications.add(groupId); else this.birthdayNotifications.delete(groupId); }
  async getSummary(groupId: string) {
    const group = groups.find((candidate) => candidate.id === groupId);
    const members = group ? people.filter((person) => group.memberIds.includes(person.id)) : [];
    return { total: members.length, orphans: members.filter((person) => person.isOrphan).length, widows: members.filter((person) => person.isWidow).length };
  }
}

export const groupsRepository: GroupsRepository = isBackendConfigured ? new SupabaseGroupsRepository() : new InMemoryGroupsRepository();
import { isBackendConfigured } from "@/lib/supabase";
import { SupabaseGroupsRepository } from "./SupabaseGroupsRepository";
