import type { VisitRow } from "@/lib/database";
import {
    activeAccount,
    privatePhotoSources,
    unwrap,
} from "@/lib/repository-helpers";
import { canCreateVisit } from "@/lib/permissions";
import { requireSupabase } from "@/lib/supabase";
import { VisitRepositoryError } from "./types";
import type {
    RepositorySnapshot,
    VisitActor,
    VisitDraft,
    VisitEdit,
    VisitListMode,
    VisitRecord,
    VisitResponseInput,
    VisitationRepository,
} from "./types";

const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const newUuid = () =>
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
        const random = Math.floor(Math.random() * 16);
        return (char === "x" ? random : (random & 3) | 8).toString(16);
    });

export class SupabaseVisitationRepository implements VisitationRepository {
    readonly kind = "remote" as const;
    private actor: VisitActor | null = null;
    private readonly listeners = new Set<() => void>();
    private readonly submissionIds = new Map<string, string>();
    bindSessionActor(actor: VisitActor | null) {
        if (
            this.actor?.id === actor?.id &&
            this.actor?.revision === actor?.revision &&
            this.actor?.status === actor?.status
        )
            return;
        this.actor = actor;
        this.emit();
    }
    subscribe(listener: () => void) {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
    async setActor(_accountId: string): Promise<VisitActor> {
        throw new VisitRepositoryError(
            "forbidden",
            "The signed-in account determines your permissions.",
        );
    }
    async getSnapshot(): Promise<RepositorySnapshot> {
        const actor = activeAccount();
        const client = requireSupabase();
        const [
            peopleResult,
            ministriesResult,
            accountsResult,
            memberGroupsResult,
            deaconGroupsResult,
            defaultsResult,
        ] = await Promise.all([
            client
                .from("people")
                .select("id,name,phone,photo_path,membership_group_id")
                .is("archived_at", null)
                .order("name"),
            client.from("person_leadership_ministries").select("*"),
            client.from("ministry_accounts").select("*"),
            client.from("deacon_group_members").select("*"),
            client.from("deacon_group_deacons").select("*"),
            canCreateVisit(actor)
                ? client.rpc("visit_person_defaults", {})
                : Promise.resolve({ data: [], error: null }),
        ]);
        const people = unwrap(peopleResult),
            ministries = unwrap(ministriesResult),
            accounts = unwrap(accountsResult),
            memberGroups = unwrap(memberGroupsResult),
            deaconGroups = unwrap(deaconGroupsResult),
            defaults = unwrap(defaultsResult);
        const photos = await privatePhotoSources(
            people.map((person) => person.photo_path),
        ).catch(() => new Map());
        return {
            actor,
            actors: [actor],
            people: people.map((person) => ({
                id: person.id,
                name: person.name,
                photo: person.photo_path
                    ? photos.get(person.photo_path)
                    : undefined,
                phone: person.phone,
                address:
                    defaults.find((item) => item.person_id === person.id)
                        ?.address ?? "",
                responsibilityGroupId:
                    memberGroups.find((item) => item.person_id === person.id)
                        ?.group_id ?? person.membership_group_id ?? null,
            })),
            eligibleParticipants: people.flatMap((person) => {
                const leadership = ministries.find((item) => item.person_id === person.id)?.leadership_ministry;
                if (!leadership || person.id === actor.personId) return [];
                const account = accounts.find((item) => item.person_id === person.id);
                return [{
                    accountId: account?.id ?? null,
                    personId: person.id,
                    name: person.name,
                    photo: person.photo_path ? photos.get(person.photo_path) : undefined,
                    leadershipMinistry: leadership,
                    responsibilityGroupId:
                        leadership === "deacon"
                            ? (deaconGroups.find(
                                  (item) =>
                                      item.person_id === person.id,
                              )?.group_id ?? null)
                            : null,
                }];
            }),
        };
    }
    async list(mode: VisitListMode) {
        activeAccount();
        let query = requireSupabase()
            .from("visit_requests")
            .select("*")
            .order("scheduled_at");
        query =
            mode === "archive"
                ? query.not("archived_at", "is", null)
                : query.is("archived_at", null);
        return this.hydrate(unwrap(await query));
    }
    async getAuthorized(id: string): Promise<VisitRecord> {
        activeAccount();
        const { data, error } = await requireSupabase()
            .from("visit_requests")
            .select("*")
            .eq("id", id)
            .maybeSingle();
        if (error) this.raise(error.message);
        if (!data)
            throw new VisitRepositoryError("not-found", "Visit unavailable.");
        return (await this.hydrate([data]))[0];
    }
    async create(draft: VisitDraft) {
        activeAccount();
        let submissionId = this.submissionIds.get(draft.submissionId);
        if (!submissionId) {
            submissionId = uuidPattern.test(draft.submissionId)
                ? draft.submissionId
                : newUuid();
            this.submissionIds.set(draft.submissionId, submissionId);
        }
        const result = await requireSupabase().rpc("save_visit", {
            p_id: null,
            p_revision: null,
            p_submission_id: submissionId,
            p_person_id: draft.personId,
            p_scheduled_at: draft.scheduledAt,
            p_location: draft.location,
            p_notes: draft.notes,
            p_participant_ids: draft.participantPersonIds,
        });
        if (result.error) this.raise(result.error.message);
        const row = unwrap(result);
        this.emit();
        return this.getAuthorized(row.id);
    }
    async update(id: string, edit: VisitEdit, expectedRevision: number) {
        const current = await this.getAuthorized(id);
        const result = await requireSupabase().rpc("save_visit", {
            p_id: id,
            p_revision: expectedRevision,
            p_submission_id: current.submissionId,
            p_person_id: current.personId,
            p_scheduled_at: edit.scheduledAt,
            p_location: edit.location,
            p_notes: edit.notes,
            p_participant_ids: current.recipients.map((item) => item.participantPersonId),
        });
        if (result.error) this.raise(result.error.message);
        this.emit();
        return this.getAuthorized(id);
    }
    async respond(
        id: string,
        input: VisitResponseInput,
        expectedRevision: number,
    ) {
        activeAccount();
        const result = await requireSupabase().rpc("respond_to_visit", {
            p_id: id,
            p_revision: expectedRevision,
            p_response: input.response,
            p_reason: input.response === "declined" ? input.reason : null,
        });
        if (result.error) this.raise(result.error.message);
        this.emit();
        return this.getAuthorized(id);
    }
    async complete(id: string, expectedRevision: number) {
        return this.transition(id, expectedRevision, "complete");
    }
    async cancel(id: string, expectedRevision: number) {
        return this.transition(id, expectedRevision, "cancel");
    }
    async archive(id: string, expectedRevision: number) {
        return this.transition(id, expectedRevision, "archive");
    }
    async markViewed(id: string, revision: number) {
        activeAccount();
        const result = await requireSupabase().rpc("mark_visit_viewed", {
            p_id: id,
            p_revision: revision,
        });
        if (result.error) this.raise(result.error.message);
    }
    private async transition(id: string, revision: number, action: string) {
        activeAccount();
        const result = await requireSupabase().rpc("transition_visit", {
            p_id: id,
            p_revision: revision,
            p_action: action,
        });
        if (result.error) this.raise(result.error.message);
        this.emit();
        return this.getAuthorized(id);
    }
    private async hydrate(rows: VisitRow[]): Promise<VisitRecord[]> {
        if (!rows.length) return [];
        const client = requireSupabase();
        const [accountsResult, recipientsResult] = await Promise.all([
            client.from("ministry_accounts").select("*"),
            client.from("visit_participants").select("*").in("visit_id", rows.map((row) => row.id)),
        ]);
        const accounts = unwrap(accountsResult), recipients = unwrap(recipientsResult);
        const personIds = [...new Set([
            ...rows.map((row) => row.person_id),
            ...rows.flatMap((row) => {
                const planner = accounts.find((account) => account.id === row.planner_id);
                return planner?.person_id ? [planner.person_id] : [];
            }),
            ...recipients.map((recipient) => recipient.person_id),
        ])];
        const [peopleResult, leadershipResult] = await Promise.all([
            client.from("people").select("id,name,phone,photo_path").in("id", personIds),
            client.from("person_leadership_ministries").select("*").in("person_id", personIds),
        ]);
        const people = unwrap(peopleResult), leadership = unwrap(leadershipResult);
        const photos = await privatePhotoSources(people.map((person) => person.photo_path)).catch(() => new Map());
        return rows.map((row) => ({
            id: row.id,
            plannerId: row.planner_id ?? "",
            personId: row.person_id,
            scheduledAt: row.scheduled_at,
            location: row.location,
            notes: row.notes,
            status: row.status,
            archivedAt: row.archived_at,
            completedAt: row.completed_at,
            revision: row.revision,
            submissionId: row.submission_id,
            memberName:
                people.find((person) => person.id === row.person_id)?.name ??
                "Unavailable member",
            memberPhone:
                people.find((person) => person.id === row.person_id)?.phone ??
                null,
            plannerName: (() => {
                const account = accounts.find((candidate) => candidate.id === row.planner_id);
                return people.find((person) => person.id === account?.person_id)?.name ?? account?.display_name ?? "Planner";
            })(),
            updatedFields: row.updated_fields ?? [],
            recipients: recipients
                .filter((recipient) => recipient.visit_id === row.id)
                .map((recipient) => {
                    const person = people.find((candidate) => candidate.id === recipient.person_id);
                    const account = accounts.find((candidate) => candidate.person_id === recipient.person_id);
                    return {
                        accountId: account?.id ?? null,
                        response: recipient.response,
                        reason: recipient.reason,
                        participantName: person?.name ?? "Participant",
                        participantPersonId: recipient.person_id,
                        photo: person?.photo_path ? photos.get(person.photo_path) : undefined,
                        leadershipMinistry: leadership.find((item) => item.person_id === recipient.person_id)?.leadership_ministry ?? "deacon",
                        lastViewedRevision: recipient.last_viewed_revision ?? 0,
                    };
                }),
        }));
    }
    private emit() {
        this.listeners.forEach((listener) => listener());
    }
    private raise(message: string): never {
        const code = /conflict|revision|stale/i.test(message)
            ? "conflict"
            : /authoriz|only active|sign in/i.test(message)
              ? "forbidden"
              : /transition|no longer open/i.test(message)
                ? "terminal"
                : "invalid";
        throw new VisitRepositoryError(code, message);
    }
}
