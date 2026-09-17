import { canCreateVisit, canManageVisit, canReadVisit, canRespondToVisit } from "@/lib/permissions";

import { visitationActors, visitationDeacons, visitationPeople, visitationVisits } from "./fixtures";
import type {
  RepositorySnapshot,
  VisitActor,
  VisitDraft,
  VisitEdit,
  VisitListItem,
  VisitListMode,
  VisitRecord,
  VisitResponseInput,
  VisitationRepository,
} from "./types";
import { VisitRepositoryError } from "./types";

type RepositoryOptions = {
  latencyMs?: number;
  now?: () => Date;
};

const cloneVisit = (visit: VisitRecord): VisitRecord => ({
  ...visit,
  updatedFields: [...visit.updatedFields],
  recipients: visit.recipients.map((recipient) => ({ ...recipient })),
});

const cloneActor = (actor: VisitActor): VisitActor => ({ ...actor });

export class InMemoryVisitationRepository implements VisitationRepository {
  readonly kind = "memory" as const;
  private actorId = visitationActors[0].id;
  private sessionActor: VisitActor | null | undefined;
  private readonly actors = visitationActors.map(cloneActor);
  private readonly people = visitationPeople.map((person) => ({ ...person }));
  private readonly deacons = visitationDeacons.map((deacon) => ({ ...deacon }));
  private readonly visits = visitationVisits.map(cloneVisit);
  private readonly listeners = new Set<() => void>();
  private readonly latencyMs: number;
  private readonly now: () => Date;

  constructor(options: RepositoryOptions = {}) {
    this.latencyMs = options.latencyMs ?? 140;
    this.now = options.now ?? (() => new Date());
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  bindSessionActor(actor: VisitActor | null) {
    if (this.sessionActor === null && actor === null) return;
    if (this.sessionActor && actor && this.sessionActor.id === actor.id && this.sessionActor.revision === actor.revision) return;
    this.sessionActor = actor ? cloneActor(actor) : null;
    this.emit();
  }

  async getSnapshot(): Promise<RepositorySnapshot> {
    await this.pause();
    if (this.sessionActor !== undefined) {
      if (!this.sessionActor) throw new VisitRepositoryError("forbidden", "No authorized visitation account.");
      return { actor: cloneActor(this.sessionActor), actors: [cloneActor(this.sessionActor)], people: [], deacons: [] };
    }
    return {
      actor: cloneActor(this.actor()),
      actors: this.actors.map(cloneActor),
      people: this.people.map((person) => ({ ...person })),
      deacons: this.deacons.map((deacon) => ({ ...deacon })),
    };
  }

  async setActor(accountId: string) {
    await this.pause();
    this.assertDemoMode();
    const actor = this.actors.find((candidate) => candidate.id === accountId);
    if (!actor) throw new VisitRepositoryError("not-found", "Account not found.");
    this.actorId = accountId;
    this.emit();
    return cloneActor(actor);
  }

  async list(mode: VisitListMode): Promise<VisitListItem[]> {
    await this.pause();
    if (this.sessionActor !== undefined) return [];
    const actor = this.actor();
    return this.visits
      .filter((visit) => canReadVisit(actor, visit))
      .filter((visit) => (mode === "archive" ? Boolean(visit.archivedAt) : !visit.archivedAt))
      .sort((left, right) => Date.parse(left.scheduledAt) - Date.parse(right.scheduledAt))
      .map(cloneVisit);
  }

  async getAuthorized(id: string) {
    await this.pause();
    this.assertDemoMode();
    const visit = this.find(id);
    if (!canReadVisit(this.actor(), visit)) {
      throw new VisitRepositoryError("not-found", "Visit unavailable.");
    }
    return cloneVisit(visit);
  }

  async create(draft: VisitDraft) {
    await this.pause();
    this.assertDemoMode();
    const actor = this.actor();
    if (!canCreateVisit(actor)) throw new VisitRepositoryError("forbidden", "Only an active pastor can plan visits.");

    const duplicate = this.visits.find((visit) => visit.pastorId === actor.id && visit.submissionId === draft.submissionId);
    if (duplicate) return cloneVisit(duplicate);

    const person = this.people.find((candidate) => candidate.id === draft.personId);
    if (!person) throw new VisitRepositoryError("invalid", "Choose a valid person.");
    const recipientIds = [...new Set(draft.recipientAccountIds)];
    if (recipientIds.length < 1 || recipientIds.length > 2) {
      throw new VisitRepositoryError("invalid", "Choose one or two deacons.");
    }
    const recipients = recipientIds.map((accountId) => {
      const deacon = this.deacons.find((candidate) => candidate.accountId === accountId);
      const account = this.actors.find((candidate) => candidate.id === accountId);
      if (!deacon || account?.status !== "active" || account.designation !== "deacon") {
        throw new VisitRepositoryError("invalid", "A selected deacon is no longer available.");
      }
      return {
        accountId,
        deaconName: deacon.name,
        deaconPersonId: deacon.personId,
        response: "pending" as const,
        reason: null,
        lastViewedRevision: 0,
      };
    });
    this.validateOpenFields(draft.scheduledAt, draft.location);

    const visit: VisitRecord = {
      id: `visit-${draft.submissionId}`,
      pastorId: actor.id,
      personId: person.id,
      pastorName: actor.displayName,
      memberName: person.name,
      memberPhone: person.phone,
      scheduledAt: draft.scheduledAt,
      location: draft.location.trim(),
      notes: draft.notes.trim(),
      status: "open",
      archivedAt: null,
      completedAt: null,
      revision: 1,
      submissionId: draft.submissionId,
      updatedFields: [],
      recipients,
    };
    this.visits.push(visit);
    this.emit();
    return cloneVisit(visit);
  }

  async update(id: string, edit: VisitEdit, expectedRevision: number) {
    await this.pause();
    this.assertDemoMode();
    const visit = this.find(id);
    this.assertManageable(visit, expectedRevision);
    this.validateOpenFields(edit.scheduledAt, edit.location);
    const updatedFields: VisitRecord["updatedFields"] = [];
    if (edit.scheduledAt !== visit.scheduledAt) updatedFields.push("scheduledAt");
    if (edit.location.trim() !== visit.location) updatedFields.push("location");
    if (edit.notes.trim() !== visit.notes) updatedFields.push("notes");
    visit.scheduledAt = edit.scheduledAt;
    visit.location = edit.location.trim();
    visit.notes = edit.notes.trim();
    visit.updatedFields = updatedFields;
    visit.revision += 1;
    this.emit();
    return cloneVisit(visit);
  }

  async respond(id: string, input: VisitResponseInput, expectedRevision: number) {
    await this.pause();
    this.assertDemoMode();
    const visit = this.find(id);
    this.assertRevision(visit, expectedRevision);
    const actor = this.actor();
    if (!canRespondToVisit(actor, visit)) throw new VisitRepositoryError("forbidden", "This invitation is not open for your response.");
    const recipient = visit.recipients.find((candidate) => candidate.accountId === actor.id);
    if (!recipient) throw new VisitRepositoryError("forbidden", "This invitation is not assigned to you.");
    recipient.response = input.response;
    recipient.reason = input.response === "declined" ? input.reason?.trim() || null : null;
    visit.revision += 1;
    recipient.lastViewedRevision = visit.revision;
    this.emit();
    return cloneVisit(visit);
  }

  async complete(id: string, expectedRevision: number) {
    await this.pause();
    this.assertDemoMode();
    const visit = this.find(id);
    this.assertManageable(visit, expectedRevision);
    visit.status = "completed";
    visit.completedAt = this.now().toISOString();
    visit.revision += 1;
    this.emit();
    return cloneVisit(visit);
  }

  async cancel(id: string, expectedRevision: number) {
    await this.pause();
    this.assertDemoMode();
    const visit = this.find(id);
    this.assertManageable(visit, expectedRevision);
    visit.status = "cancelled";
    visit.revision += 1;
    this.emit();
    return cloneVisit(visit);
  }

  async archive(id: string, expectedRevision: number) {
    await this.pause();
    this.assertDemoMode();
    const visit = this.find(id);
    this.assertRevision(visit, expectedRevision);
    if (!canManageVisit(this.actor(), visit)) throw new VisitRepositoryError("forbidden", "Only the planning pastor can archive this visit.");
    if (visit.status === "open") throw new VisitRepositoryError("invalid", "Complete or cancel the visit before archiving it.");
    if (visit.archivedAt) throw new VisitRepositoryError("terminal", "This visit is already archived.");
    visit.archivedAt = this.now().toISOString();
    visit.revision += 1;
    this.emit();
    return cloneVisit(visit);
  }

  async markViewed(id: string, revision: number) {
    await this.pause();
    this.assertDemoMode();
    const visit = this.find(id);
    if (!canReadVisit(this.actor(), visit)) throw new VisitRepositoryError("not-found", "Visit unavailable.");
    const recipient = visit.recipients.find((candidate) => candidate.accountId === this.actorId);
    if (recipient) recipient.lastViewedRevision = Math.max(recipient.lastViewedRevision, revision);
  }

  private actor() {
    if (this.sessionActor !== undefined) {
      if (!this.sessionActor) throw new VisitRepositoryError("forbidden", "No authorized visitation account.");
      return this.sessionActor;
    }
    const actor = this.actors.find((candidate) => candidate.id === this.actorId);
    if (!actor) throw new VisitRepositoryError("forbidden", "No active account.");
    return actor;
  }

  private assertDemoMode() {
    if (this.sessionActor !== undefined) {
      throw new VisitRepositoryError("forbidden", "The remote visitation adapter must handle configured sessions.");
    }
  }

  private find(id: string) {
    const visit = this.visits.find((candidate) => candidate.id === id);
    if (!visit) throw new VisitRepositoryError("not-found", "Visit unavailable.");
    return visit;
  }

  private assertRevision(visit: VisitRecord, expectedRevision: number) {
    if (visit.revision !== expectedRevision) {
      throw new VisitRepositoryError("conflict", "The visit changed on another device. Refresh and try again.");
    }
  }

  private assertManageable(visit: VisitRecord, expectedRevision: number) {
    this.assertRevision(visit, expectedRevision);
    if (!canManageVisit(this.actor(), visit)) throw new VisitRepositoryError("forbidden", "Only the planning pastor can change this visit.");
    if (visit.status !== "open" || visit.archivedAt) throw new VisitRepositoryError("terminal", "This visit is read-only.");
  }

  private validateOpenFields(scheduledAt: string, location: string) {
    const timestamp = Date.parse(scheduledAt);
    if (!Number.isFinite(timestamp) || timestamp <= this.now().getTime()) {
      throw new VisitRepositoryError("invalid", "Choose a future visit time.");
    }
    if (!location.trim()) throw new VisitRepositoryError("invalid", "Enter a visit location.");
    if (location.length > 1000) throw new VisitRepositoryError("invalid", "The visit location is too long.");
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }

  private pause() {
    return new Promise<void>((resolve) => setTimeout(resolve, this.latencyMs));
  }
}
