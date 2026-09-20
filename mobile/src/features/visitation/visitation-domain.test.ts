import { fixedPdtToIso, isoToFixedPdt } from "@/lib/dates";

import { InMemoryVisitationRepository } from "./InMemoryVisitationRepository";
import { calendarSnapshotUrl } from "./calendar-url";
import {
    createPrivacySafeNotification,
    isPrivacySafeNotification,
} from "./notifications";
import { VisitRepositoryError } from "./types";

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

function equal<T>(actual: T, expected: T, message: string) {
    if (actual !== expected)
        throw new Error(
            `${message}: expected ${String(expected)}, received ${String(actual)}`,
        );
}

async function rejectsCode(
    task: () => Promise<unknown>,
    code: VisitRepositoryError["code"],
) {
    try {
        await task();
    } catch (error) {
        assert(
            error instanceof VisitRepositoryError,
            "Expected VisitRepositoryError",
        );
        equal(error.code, code, "Unexpected repository error code");
        return;
    }
    throw new Error(`Expected repository error ${code}`);
}

const tests: Array<{ name: string; run: () => void | Promise<void> }> = [
    {
        name: "calendar export is a user-saveable snapshot",
        run: async () => {
            const repository = new InMemoryVisitationRepository({
                latencyMs: 0,
            });
            const visit = await repository.getAuthorized("visit-marta");
            const url = calendarSnapshotUrl(visit, "en");
            const parameters = new URL(url).searchParams;
            assert(
                url.includes("action=TEMPLATE"),
                "Calendar URL should open a prefilled event",
            );
            assert(
                url.includes("20270116T013000Z%2F20270116T023000Z"),
                "Calendar snapshot should contain fixed instant and one-hour end",
            );
            equal(
                parameters.get("location"),
                visit.location,
                "Calendar snapshot should contain the confirmed location",
            );
        },
    },
    {
        name: "fixed PDT stays UTC−07 in summer and winter",
        run: () => {
            equal(
                fixedPdtToIso("2027-01-15", "18:30"),
                "2027-01-16T01:30:00.000Z",
                "Winter conversion",
            );
            equal(
                fixedPdtToIso("2027-07-15", "18:30"),
                "2027-07-16T01:30:00.000Z",
                "Summer conversion",
            );
            const local = isoToFixedPdt("2027-07-16T01:30:00.000Z");
            equal(local.date, "2027-07-15", "Fixed-offset date round trip");
            equal(local.time, "18:30", "Fixed-offset time round trip");
        },
    },
    {
        name: "duplicate submissions return one visit and stale edits conflict",
        run: async () => {
            const repository = new InMemoryVisitationRepository({
                latencyMs: 0,
                now: () => new Date("2026-09-16T12:00:00.000Z"),
            });
            const draft = {
                personId: "marta-kovalenko",
                scheduledAt: fixedPdtToIso("2027-02-01", "19:00"),
                location: "2480 Fair Oaks Boulevard",
                notes: "Front entrance",
                participantPersonIds: ["marko-melnyk", "leah-thompson"],
                submissionId: "test-idempotency-key",
            };
            const created = await repository.create(draft);
            const duplicate = await repository.create({
                ...draft,
                location: "Different retry payload",
            });
            equal(duplicate.id, created.id, "Duplicate submission id");
            equal(
                duplicate.location,
                created.location,
                "First submission remains authoritative",
            );
            const updated = await repository.update(
                created.id,
                {
                    scheduledAt: created.scheduledAt,
                    location: "Updated location",
                    notes: created.notes,
                },
                created.revision,
            );
            equal(
                updated.revision,
                created.revision + 1,
                "Edit increments revision",
            );
            await rejectsCode(
                () =>
                    repository.update(
                        created.id,
                        {
                            scheduledAt: created.scheduledAt,
                            location: "Stale",
                            notes: "",
                        },
                        created.revision,
                    ),
                "conflict",
            );
        },
    },
    {
        name: "deacons plan with any number of other pastors or deacons while the planner stays implicit",
        run: async () => {
            const repository = new InMemoryVisitationRepository({
                latencyMs: 0,
                now: () => new Date("2026-09-16T12:00:00.000Z"),
            });
            await repository.setActor("deacon-marko");
            const created = await repository.create({
                personId: "amelia-carter",
                scheduledAt: fixedPdtToIso("2027-03-01", "18:00"),
                location: "3900 J Street",
                notes: "",
                participantPersonIds: [
                    "olena-kovalenko",
                    "mykola-petrenko",
                    "leah-thompson",
                    "deacon-no-account",
                ],
                submissionId: "deacon-planner-many-participants",
            });
            equal(
                created.plannerId,
                "deacon-marko",
                "Deacon planner owns the visit",
            );
            equal(
                created.recipients.length,
                4,
                "Participant selection has no two-person cap",
            );
            equal(created.plannerName, "Marko Melnyk", "Planner uses linked member name");
            equal(created.recipients.find((participant) => participant.participantPersonId === "deacon-no-account")?.accountId, null, "Accountless leader remains an attendee");
            await repository.setActor("pastor-olena");
            const accepted = await repository.respond(
                created.id,
                { response: "accepted", reason: null },
                created.revision,
            );
            equal(
                accepted.recipients.find(
                    (participant) => participant.accountId === "pastor-olena",
                )?.response,
                "accepted",
                "Selected pastor response",
            );
            await repository.setActor("deacon-marko");
            await rejectsCode(
                () =>
                    repository.create({
                        personId: "amelia-carter",
                        scheduledAt: fixedPdtToIso("2027-03-02", "18:00"),
                        location: "3900 J Street",
                        notes: "",
                        participantPersonIds: ["marko-melnyk"],
                        submissionId: "planner-cannot-select-self",
                    }),
                "invalid",
            );
        },
    },
    {
        name: "a planner can create a visit without additional participants",
        run: async () => {
            const repository = new InMemoryVisitationRepository({
                latencyMs: 0,
            });
            const created = await repository.create({
                personId: "amelia-carter",
                scheduledAt: fixedPdtToIso("2027-03-03", "18:00"),
                location: "3900 J Street",
                notes: "",
                participantPersonIds: [],
                submissionId: "planner-only-visit",
            });
            equal(
                created.recipients.length,
                0,
                "No additional participant is required",
            );
        },
    },
    {
        name: "deacons respond independently and may revise an open response",
        run: async () => {
            const repository = new InMemoryVisitationRepository({
                latencyMs: 0,
            });
            await repository.setActor("deacon-marko");
            const initial = await repository.getAuthorized("visit-marta");
            const markoAccepted = await repository.respond(
                "visit-marta",
                { response: "accepted", reason: null },
                initial.revision,
            );
            equal(
                markoAccepted.recipients.find(
                    (recipient) => recipient.accountId === "deacon-marko",
                )?.response,
                "accepted",
                "Marko response",
            );
            equal(
                markoAccepted.recipients.find(
                    (recipient) => recipient.accountId === "deacon-leah",
                )?.response,
                "accepted",
                "Leah response remains independent",
            );

            const markoDeclined = await repository.respond(
                "visit-marta",
                { response: "declined", reason: "Schedule conflict" },
                markoAccepted.revision,
            );
            equal(
                markoDeclined.recipients.find(
                    (recipient) => recipient.accountId === "deacon-marko",
                )?.reason,
                "Schedule conflict",
                "Optional reason stored",
            );
            await repository.setActor("deacon-leah");
            await rejectsCode(
                () => repository.getAuthorized("visit-daniel"),
                "not-found",
            );
        },
    },
    {
        name: "completion and archive remain separate lifecycle operations",
        run: async () => {
            const repository = new InMemoryVisitationRepository({
                latencyMs: 0,
                now: () => new Date("2026-09-16T12:00:00.000Z"),
            });
            const open = await repository.getAuthorized("visit-marta");
            await rejectsCode(
                () => repository.archive(open.id, open.revision),
                "invalid",
            );
            const completed = await repository.complete(open.id, open.revision);
            equal(completed.status, "completed", "Explicit completion status");
            equal(completed.archivedAt, null, "Completion does not archive");
            const archived = await repository.archive(
                completed.id,
                completed.revision,
            );
            equal(
                archived.status,
                "completed",
                "Archive preserves completion state",
            );
            assert(
                Boolean(archived.archivedAt),
                "Archive records an archive timestamp",
            );
        },
    },
    {
        name: "external notification copy excludes visit details",
        run: () => {
            const notification = createPrivacySafeNotification(
                "event-1",
                "deacon-marko",
                "visit-marta",
                "en",
            );
            assert(
                isPrivacySafeNotification(notification, [
                    "Marta Kovalenko",
                    "2480 Fair Oaks Boulevard",
                    "front entrance",
                    "2027-01-15",
                ]),
                "Notification must not contain names, location, notes, or schedule",
            );
            equal(
                notification.data.visitId,
                "visit-marta",
                "Notification deep-link data",
            );
        },
    },
];

async function run() {
    let failures = 0;
    for (const test of tests) {
        try {
            await test.run();
            console.log(`✓ ${test.name}`);
        } catch (error) {
            failures += 1;
            console.error(`✗ ${test.name}`);
            console.error(error);
        }
    }
    if (failures > 0) throw new Error(`${failures} visitation test(s) failed.`);
}

void run();
