/** Public contracts. Access roles are separate from ministry-derived capabilities. */
export type AccessRole = "member" | "editor" | "admin";
export type AccountStatus = "pending" | "active" | "denied" | "revoked";
export type LeadershipMinistry = "pastor" | "deacon" | null;
export type DateOnly = string;
export type Account = {
  id: string;
  personId: string | null;
  displayName: string;
  status: AccountStatus;
  role: AccessRole;
  leadershipMinistry: LeadershipMinistry;
  revision: number;
};
export type Person = {
  id: string;
  name: string;
  ministry: string;
  ministryUk: string;
  phone: string | null;
  email: string | null;
  photoPath: string | null;
  membershipGroupId: string | null;
  archivedAt: string | null;
  revision: number;
};
export type Group = {
  id: string;
  name: string;
  kind: "membership" | "responsibility";
  archivedAt: string | null;
  revision: number;
};
export type VisitStatus = "open" | "cancelled" | "completed";
export type VisitResponse = "pending" | "accepted" | "declined";
export type VisitRecipient = {
  accountId: string | null;
  response: VisitResponse;
  reason: string | null;
};
export type Visit = {
  id: string;
  plannerId: string;
  personId: string;
  scheduledAt: string;
  location: string;
  notes: string;
  status: VisitStatus;
  archivedAt: string | null;
  completedAt: string | null;
  revision: number;
  submissionId: string;
  recipients: VisitRecipient[];
};
export type Reminder = {
  id: string;
  personId: string;
  title: string;
  remindAt: string;
  completedAt: string | null;
  notificationEnabled: boolean;
  revision: number;
};
export type Preferences = {
  locale: "en" | "uk";
  appearance: "system" | "light" | "dark";
  notificationsEnabled: boolean;
};
