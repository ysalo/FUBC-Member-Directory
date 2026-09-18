import type { Account, Visit, VisitRecipient } from "@/lib/domain";

export type VisitListMode = "current" | "archive";

export type VisitActor = Pick<Account, "id" | "displayName" | "leadershipMinistry" | "status" | "role" | "revision">;

export type VisitPerson = {
  id: string;
  name: string;
  phone: string | null;
  address: string;
  responsibilityGroupId: string | null;
};

export type VisitParticipant = {
  accountId: string;
  personId: string | null;
  name: string;
  leadershipMinistry: "pastor" | "deacon";
  responsibilityGroupId: string | null;
};

export type VisitRecipientDetails = VisitRecipient & {
  participantName: string;
  participantPersonId: string | null;
  leadershipMinistry: "pastor" | "deacon";
  lastViewedRevision: number;
};

export type VisitRecord = Omit<Visit, "recipients"> & {
  memberName: string;
  memberPhone: string | null;
  plannerName: string;
  updatedFields: Array<"scheduledAt" | "location" | "notes">;
  recipients: VisitRecipientDetails[];
};

export type VisitListItem = Pick<
  VisitRecord,
  "id" | "plannerId" | "scheduledAt" | "location" | "status" | "archivedAt" | "revision" | "memberName" | "plannerName" | "recipients"
>;

export type VisitDraft = {
  personId: string;
  scheduledAt: string;
  location: string;
  notes: string;
  participantAccountIds: string[];
  submissionId: string;
};

export type VisitEdit = Pick<VisitDraft, "scheduledAt" | "location" | "notes">;

export type VisitResponseInput = {
  response: "accepted" | "declined";
  reason: string | null;
};

export type PrivacySafeNotification = {
  eventId: string;
  recipientAccountId: string;
  visitId: string;
  title: string;
  body: string;
  data: { route: "/visitation/[id]"; visitId: string };
};

export type RepositorySnapshot = {
  actor: VisitActor;
  actors: VisitActor[];
  people: VisitPerson[];
  eligibleParticipants: VisitParticipant[];
};

export interface VisitationRepository {
  readonly kind: "memory" | "remote";
  bindSessionActor(actor: VisitActor | null): void;
  getSnapshot(): Promise<RepositorySnapshot>;
  setActor(accountId: string): Promise<VisitActor>;
  list(mode: VisitListMode): Promise<VisitListItem[]>;
  getAuthorized(id: string): Promise<VisitRecord>;
  create(draft: VisitDraft): Promise<VisitRecord>;
  update(id: string, edit: VisitEdit, expectedRevision: number): Promise<VisitRecord>;
  respond(id: string, input: VisitResponseInput, expectedRevision: number): Promise<VisitRecord>;
  complete(id: string, expectedRevision: number): Promise<VisitRecord>;
  cancel(id: string, expectedRevision: number): Promise<VisitRecord>;
  archive(id: string, expectedRevision: number): Promise<VisitRecord>;
  markViewed(id: string, revision: number): Promise<void>;
  subscribe(listener: () => void): () => void;
}

export class VisitRepositoryError extends Error {
  readonly code: "conflict" | "forbidden" | "not-found" | "invalid" | "terminal";

  constructor(
    code: "conflict" | "forbidden" | "not-found" | "invalid" | "terminal",
    message: string,
  ) {
    super(message);
    this.code = code;
    this.name = "VisitRepositoryError";
  }
}
