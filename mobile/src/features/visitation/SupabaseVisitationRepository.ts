import type { VisitRow } from "@/lib/database";
import { activeAccount, unwrap } from "@/lib/repository-helpers";
import { requireSupabase } from "@/lib/supabase";
import { VisitRepositoryError } from "./types";
import type { RepositorySnapshot, VisitActor, VisitDraft, VisitEdit, VisitListMode, VisitRecord, VisitResponseInput, VisitationRepository } from "./types";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const newUuid = () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => { const random = Math.floor(Math.random() * 16); return (char === "x" ? random : (random & 3) | 8).toString(16); });

export class SupabaseVisitationRepository implements VisitationRepository {
  readonly kind = "remote" as const;
  private actor: VisitActor | null = null;
  private readonly listeners = new Set<() => void>();
  private readonly submissionIds = new Map<string, string>();
  bindSessionActor(actor: VisitActor | null) {
    if (this.actor?.id === actor?.id && this.actor?.revision === actor?.revision && this.actor?.status === actor?.status) return;
    this.actor = actor;
    this.emit();
  }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  async setActor(_accountId: string): Promise<VisitActor> { throw new VisitRepositoryError("forbidden", "The signed-in account determines your permissions."); }
  async getSnapshot(): Promise<RepositorySnapshot> {
    const actor = activeAccount();
    const client = requireSupabase();
    const [peopleResult, ministriesResult, memberGroupsResult, deaconGroupsResult, defaultsResult] = await Promise.all([
      client.from("people").select("id,name,phone").is("archived_at", null).order("name"),
      client.from("ministry_accounts").select("*"),
      client.from("deacon_group_members").select("*"),
      client.from("deacon_group_deacons").select("*"),
      actor.designation === "pastor" ? client.rpc("visit_person_defaults", {}) : Promise.resolve({ data: [], error: null }),
    ]);
    const people = unwrap(peopleResult), ministries = unwrap(ministriesResult), memberGroups = unwrap(memberGroupsResult), deaconGroups = unwrap(deaconGroupsResult), defaults = unwrap(defaultsResult);
    return { actor, actors: [actor],
      people: people.map((person) => ({ id: person.id, name: person.name, phone: person.phone, address: defaults.find((item) => item.person_id === person.id)?.address ?? "", responsibilityGroupId: memberGroups.find((item) => item.person_id === person.id)?.group_id ?? null })),
      deacons: ministries.filter((account) => account.designation === "deacon").map((account) => ({ accountId: account.id, personId: account.person_id, name: account.display_name, responsibilityGroupId: deaconGroups.find((item) => item.account_id === account.id)?.group_id ?? null })),
    };
  }
  async list(mode: VisitListMode) {
    activeAccount();
    let query = requireSupabase().from("visit_requests").select("*").order("scheduled_at");
    query = mode === "archive" ? query.not("archived_at", "is", null) : query.is("archived_at", null);
    return this.hydrate(unwrap(await query));
  }
  async getAuthorized(id: string): Promise<VisitRecord> {
    activeAccount();
    const { data, error } = await requireSupabase().from("visit_requests").select("*").eq("id", id).maybeSingle();
    if (error) this.raise(error.message);
    if (!data) throw new VisitRepositoryError("not-found", "Visit unavailable.");
    return (await this.hydrate([data]))[0];
  }
  async create(draft: VisitDraft) {
    activeAccount();
    let submissionId = this.submissionIds.get(draft.submissionId);
    if (!submissionId) {
      submissionId = uuidPattern.test(draft.submissionId) ? draft.submissionId : newUuid();
      this.submissionIds.set(draft.submissionId, submissionId);
    }
    const result = await requireSupabase().rpc("save_visit", { p_id: null, p_revision: null, p_submission_id: submissionId, p_person_id: draft.personId, p_scheduled_at: draft.scheduledAt, p_location: draft.location, p_notes: draft.notes, p_deacon_ids: draft.recipientAccountIds });
    if (result.error) this.raise(result.error.message);
    const row = unwrap(result);
    this.emit();
    return this.getAuthorized(row.id);
  }
  async update(id: string, edit: VisitEdit, expectedRevision: number) {
    const current = await this.getAuthorized(id);
    const result = await requireSupabase().rpc("save_visit", { p_id: id, p_revision: expectedRevision, p_submission_id: current.submissionId, p_person_id: current.personId, p_scheduled_at: edit.scheduledAt, p_location: edit.location, p_notes: edit.notes, p_deacon_ids: current.recipients.map((item) => item.accountId) });
    if (result.error) this.raise(result.error.message);
    this.emit();
    return this.getAuthorized(id);
  }
  async respond(id: string, input: VisitResponseInput, expectedRevision: number) {
    activeAccount();
    const result = await requireSupabase().rpc("respond_to_visit", { p_id: id, p_revision: expectedRevision, p_response: input.response, p_reason: input.response === "declined" ? input.reason : null });
    if (result.error) this.raise(result.error.message);
    this.emit();
    return this.getAuthorized(id);
  }
  async complete(id: string, expectedRevision: number) { return this.transition(id, expectedRevision, "complete"); }
  async cancel(id: string, expectedRevision: number) { return this.transition(id, expectedRevision, "cancel"); }
  async archive(id: string, expectedRevision: number) { return this.transition(id, expectedRevision, "archive"); }
  async markViewed(id: string, revision: number) {
    activeAccount();
    const result = await requireSupabase().rpc("mark_visit_viewed", { p_id: id, p_revision: revision });
    if (result.error) this.raise(result.error.message);
  }
  private async transition(id: string, revision: number, action: string) {
    activeAccount();
    const result = await requireSupabase().rpc("transition_visit", { p_id: id, p_revision: revision, p_action: action });
    if (result.error) this.raise(result.error.message);
    this.emit();
    return this.getAuthorized(id);
  }
  private async hydrate(rows: VisitRow[]): Promise<VisitRecord[]> {
    if (!rows.length) return [];
    const client = requireSupabase();
    const [peopleResult, accountsResult, recipientsResult] = await Promise.all([
      client.from("people").select("id,name,phone").in("id", [...new Set(rows.map((row) => row.person_id))]),
      client.from("ministry_accounts").select("*"),
      client.from("visit_recipients").select("*").in("visit_id", rows.map((row) => row.id)),
    ]);
    const people = unwrap(peopleResult), accounts = unwrap(accountsResult), recipients = unwrap(recipientsResult);
    return rows.map((row) => ({ id: row.id, pastorId: row.pastor_id ?? "", personId: row.person_id, scheduledAt: row.scheduled_at, location: row.location, notes: row.notes, status: row.status, archivedAt: row.archived_at, completedAt: row.completed_at, revision: row.revision, submissionId: row.submission_id,
      memberName: people.find((person) => person.id === row.person_id)?.name ?? "Unavailable member",
      memberPhone: people.find((person) => person.id === row.person_id)?.phone ?? null,
      pastorName: accounts.find((account) => account.id === row.pastor_id)?.display_name ?? "Pastor",
      updatedFields: row.updated_fields ?? [],
      recipients: recipients.filter((recipient) => recipient.visit_id === row.id).map((recipient) => ({ accountId: recipient.account_id, response: recipient.response, reason: recipient.reason, deaconName: accounts.find((account) => account.id === recipient.account_id)?.display_name ?? "Deacon", deaconPersonId: accounts.find((account) => account.id === recipient.account_id)?.person_id ?? null, lastViewedRevision: recipient.last_viewed_revision ?? 0 })),
    }));
  }
  private emit() { this.listeners.forEach((listener) => listener()); }
  private raise(message: string): never {
    const code = /conflict|revision|stale/i.test(message) ? "conflict" : /authoriz|only active|sign in/i.test(message) ? "forbidden" : /transition|no longer open/i.test(message) ? "terminal" : "invalid";
    throw new VisitRepositoryError(code, message);
  }
}
