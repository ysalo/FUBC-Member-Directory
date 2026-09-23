/** Public contracts. Access roles are separate from ministry-derived capabilities. */
export type AccessRole = "member" | "editor" | "admin";
export type AccountStatus = "pending" | "active" | "denied" | "revoked";
export type LeadershipMinistry = "pastor" | "deacon" | null;
type DateOnly = string;
export type Account = {
  id: string;
  personId: string | null;
  displayName: string;
  status: AccountStatus;
  role: AccessRole;
  leadershipMinistry: LeadershipMinistry;
  revision: number;
};
type VisitStatus = "open" | "cancelled" | "completed";
type VisitResponse = "pending" | "accepted" | "declined";
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
/** One deacon covers the Friday two days before `sundayOn` through that Sunday. */
export type DutyPeriod = {
  sundayOn: DateOnly;
  personId: string;
  revision: number;
};
