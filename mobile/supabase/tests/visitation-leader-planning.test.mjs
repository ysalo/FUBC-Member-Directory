import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const id = (n) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ids = {
    pastor: id(1),
    deacon: id(2),
    otherPastor: id(3),
    otherDeacon: id(4),
    member: id(5),
    ordinary: id(6),
    pastorPerson: id(11),
    deaconPerson: id(12),
    otherPastorPerson: id(13),
    otherDeaconPerson: id(14),
    memberPerson: id(15),
    ordinaryPerson: id(16),
    oldSubmission: id(21),
    newSubmission: id(22),
};

async function as(accountId, sql, params = []) {
    await db.exec("set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        accountId,
    ]);
    try {
        return await db.query(sql, params);
    } finally {
        await db.exec("reset role");
    }
}

before(async () => {
    await db.exec(`
    create role anon; create role authenticated; create role service_role; create schema auth; create schema storage;
    grant usage on schema public,auth,storage to authenticated;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text);
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to authenticated;
  `);
    for (const migration of [
        "20260916000000_initial.sql",
        "20260916010000_mobile_repository_contracts.sql",
        "20260917040000_management_full_pages.sql",
        "20260917110000_leadership_ministries.sql",
    ])
        await db.exec(
            await readFile(
                new URL(`../migrations/${migration}`, import.meta.url),
                "utf8",
            ),
        );

    await db.exec(`
    insert into public.people(id,name) values
      ('${ids.pastorPerson}','Pastor Planner'),('${ids.deaconPerson}','Deacon Planner'),
      ('${ids.otherPastorPerson}','Pastor Participant'),('${ids.otherDeaconPerson}','Deacon Participant'),
      ('${ids.memberPerson}','Member to Visit'),('${ids.ordinaryPerson}','Ordinary Member');
    insert into public.person_ministries(person_id,ministry_id)
      select '${ids.pastorPerson}',id from public.ministries where system_key='pastor';
    insert into public.person_ministries(person_id,ministry_id)
      select '${ids.deaconPerson}',id from public.ministries where system_key='deacon';
    insert into public.person_ministries(person_id,ministry_id)
      select '${ids.otherPastorPerson}',id from public.ministries where system_key='pastor';
    insert into public.person_ministries(person_id,ministry_id)
      select '${ids.otherDeaconPerson}',id from public.ministries where system_key='deacon';
  `);
    for (const [accountId, personId] of [
        [ids.pastor, ids.pastorPerson],
        [ids.deacon, ids.deaconPerson],
        [ids.otherPastor, ids.otherPastorPerson],
        [ids.otherDeacon, ids.otherDeaconPerson],
        [ids.ordinary, ids.ordinaryPerson],
    ]) {
        await db.query("insert into auth.users(id,email) values($1,$2)", [
            accountId,
            `${accountId}@example.invalid`,
        ]);
        await db.query(
            "update public.profiles set status='active',person_id=$2 where id=$1",
            [accountId, personId],
        );
    }

    const legacy = await as(
        ids.pastor,
        "select * from public.save_visit(null,null,$1,$2,$3,$4,$5,$6)",
        [
            ids.oldSubmission,
            ids.memberPerson,
            "2027-01-15T20:00:00Z",
            "Legacy location",
            "",
            [ids.otherDeacon],
        ],
    );
    assert.equal(legacy.rows[0].pastor_id, ids.pastor);
    await db.exec(
        await readFile(
            new URL(
                "../migrations/20260917120000_visitation_leader_planning.sql",
                import.meta.url,
            ),
            "utf8",
        ),
    );
    await db.exec(
        await readFile(
            new URL(
                "../migrations/20260920000000_optional_visit_participants.sql",
                import.meta.url,
            ),
            "utf8",
        ),
    );
});

after(async () => db.close());

test("migration preserves existing visits and participant responses under generic names", async () => {
    const visit = (
        await db.query(
            "select * from public.visit_requests where submission_id=$1",
            [ids.oldSubmission],
        )
    ).rows[0];
    assert.equal(visit.planner_id, ids.pastor);
    assert.equal(
        (
            await db.query(
                "select count(*)::integer count from public.visit_participants where visit_id=$1",
                [visit.id],
            )
        ).rows[0].count,
        1,
    );
    assert.equal(
        (
            await as(
                ids.pastor,
                "select public.mobile_contract_version() version",
            )
        ).rows[0].version,
        "expo-directory-v3",
    );
});

test("a deacon can plan for any member with more than two additional leaders", async () => {
    const args = [
        null,
        null,
        ids.newSubmission,
        ids.memberPerson,
        "2027-02-20T20:00:00Z",
        "Member home",
        "",
        [ids.pastor, ids.otherPastor, ids.otherDeacon],
    ];
    const created = (
        await as(
            ids.deacon,
            "select * from public.save_visit($1,$2,$3,$4,$5,$6,$7,$8)",
            args,
        )
    ).rows[0];
    assert.equal(created.planner_id, ids.deacon);
    assert.equal(
        (
            await as(
                ids.deacon,
                "select count(*)::integer count from public.visit_participants where visit_id=$1",
                [created.id],
            )
        ).rows[0].count,
        3,
    );
    const responded = (
        await as(
            ids.otherPastor,
            "select * from public.respond_to_visit($1,$2,'accepted',null)",
            [created.id, created.revision],
        )
    ).rows[0];
    assert.equal(responded.revision, created.revision + 1);
    assert.equal(
        (
            await as(
                ids.otherPastor,
                "select response from public.visit_participants where visit_id=$1 and account_id=$2",
                [created.id, ids.otherPastor],
            )
        ).rows[0].response,
        "accepted",
    );
});

test("a planner can create a visit without additional participants", async () => {
    const created = (
        await as(
            ids.pastor,
            "select * from public.save_visit(null,null,$1,$2,$3,$4,$5,$6)",
            [
                id(29),
                ids.memberPerson,
                "2027-03-18T20:00:00Z",
                "Member home",
                "",
                [],
            ],
        )
    ).rows[0];
    assert.equal(created.planner_id, ids.pastor);
    assert.equal(
        (
            await as(
                ids.pastor,
                "select count(*)::integer count from public.visit_participants where visit_id=$1",
                [created.id],
            )
        ).rows[0].count,
        0,
    );
});

test("planner self-selection and non-leader planning are rejected without leaking visits", async () => {
    await assert.rejects(
        as(
            ids.deacon,
            "select * from public.save_visit(null,null,$1,$2,$3,$4,$5,$6)",
            [
                id(30),
                ids.memberPerson,
                "2027-03-20T20:00:00Z",
                "Home",
                "",
                [ids.deacon],
            ],
        ),
        /already included/,
    );
    await assert.rejects(
        as(
            ids.ordinary,
            "select * from public.save_visit(null,null,$1,$2,$3,$4,$5,$6)",
            [
                id(31),
                ids.memberPerson,
                "2027-03-20T20:00:00Z",
                "Home",
                "",
                [ids.pastor],
            ],
        ),
        /Only active pastors or deacons/,
    );
    assert.equal(
        (await as(ids.ordinary, "select * from public.visit_requests")).rows
            .length,
        0,
    );
    assert.equal(
        (await as(ids.ordinary, "select * from public.visit_participants")).rows
            .length,
        0,
    );
});
