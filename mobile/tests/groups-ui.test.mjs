import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("group detail uses a standalone native switch instead of an unhosted SwiftUI control", async () => {
  const source = await readFile(new URL("../src/features/groups/GroupDetailScreen.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /from ["']@expo\/ui["']/);
  assert.match(source, /StyleSheet, Switch, Text/);
});

test("public group UI omits the redundant membership-group wording", async () => {
  const [groupsScreen, groupDetail, memberCopy] = await Promise.all([
    readFile(new URL("../src/features/groups/GroupsScreen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/features/groups/GroupDetailScreen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/features/members/member-copy.ts", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(`${groupsScreen}\n${groupDetail}\n${memberCopy}`, /Membership group|Членська група/);
  assert.match(groupsScreen, /copy\.myGroup/);
  assert.match(memberCopy, /group: "Belongs to"/);
});

test("member profile presents its group as a labeled disclosure action", async () => {
  const source = await readFile(new URL("../src/features/members/MemberProfileScreen.tsx", import.meta.url), "utf8");
  assert.match(source, /accessibilityHint=\{copy\.openGroup\}/);
  assert.match(source, /<Fact disclosure/);
  assert.match(source, /name="chevron-forward"/);
});

test("deacon profiles show both belonging and responsibility groups", async () => {
  const [screen, repository, copy] = await Promise.all([
    readFile(new URL("../src/features/members/MemberProfileScreen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/features/members/SupabaseMemberProfileRepository.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/features/members/member-copy.ts", import.meta.url), "utf8"),
  ]);
  assert.match(repository, /deacon_group_deacons/);
  assert.match(repository, /responsibilityGroupId/);
  assert.match(screen, /copy\.responsibleFor/);
  assert.match(copy, /responsibleFor: "Responsible for"/);
});

test("group cards identify their responsible deacons", async () => {
  const [screen, repository] = await Promise.all([
    readFile(new URL("../src/features/groups/GroupsScreen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/features/groups/SupabaseGroupsRepository.ts", import.meta.url), "utf8"),
  ]);
  assert.match(repository, /responsibleDeacons:/);
  assert.match(repository, /ministry_accounts/);
  assert.match(screen, /copy\.responsibleDeacons/);
  assert.match(screen, /deaconNames/);
  assert.match(screen, /<ProfileAvatar/);
});
