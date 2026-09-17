import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("group detail uses a standalone native switch instead of an unhosted SwiftUI control", async () => {
  const source = await readFile(new URL("../src/features/groups/GroupDetailScreen.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /from ["']@expo\/ui["']/);
  assert.match(source, /StyleSheet, Switch, View/);
  assert.match(source, /accessibility\/app-text/);
});

test("the app-wide text size preference scales text, inputs, and native tab labels", async () => {
  const [provider, primitives, layout, menu] = await Promise.all([
    readFile(new URL("../src/features/accessibility/TextSizeProvider.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/features/accessibility/app-text.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/_layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/menu.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(provider, /SecureStore\.setItemAsync/);
  assert.match(provider, /small: 0\.9, standard: 1, large: 1\.18/);
  assert.match(primitives, /fontSize \* scale/);
  assert.match(primitives, /lineHeight \* scale/);
  assert.match(primitives, /NativeTextInput/);
  assert.match(layout, /<TextSizeProvider>/);
  assert.match(layout, /fontSize: 10 \* scale/);
  assert.match(menu, /labels\.textSize/);
});

test("icon attribution is tucked behind an accessible About sheet", async () => {
  const menu = await readFile(new URL("../src/app/menu.tsx", import.meta.url), "utf8");
  assert.match(menu, /labels\.about/);
  assert.match(menu, /presentationStyle="pageSheet"/);
  assert.match(menu, /Ionicons — MIT License/);
  assert.doesNotMatch(menu, /copy\.menu\.licenses/);
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
  const [screen, row, repository, copy] = await Promise.all([
    readFile(new URL("../src/features/groups/GroupsScreen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/features/groups/deacon-profile-row.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/features/groups/SupabaseGroupsRepository.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/features/groups/groups-copy.ts", import.meta.url), "utf8"),
  ]);
  assert.match(repository, /responsibleDeacons:/);
  assert.match(repository, /ministry_accounts/);
  assert.match(screen, /copy\.responsibleDeacons/);
  assert.match(screen, /deacons\.map/);
  assert.doesNotMatch(screen, /\.slice\(0, 2\)|deaconNames/);
  assert.match(screen, /<DeaconProfileRow/);
  assert.match(screen, /pathname: "\/\(directory\)\/members\/\[memberId\]"/);
  assert.match(screen, /copy\.noDeaconsAssigned/);
  assert.match(row, /<ProfileAvatar/);
  assert.match(row, /accessibilityHint=\{accessibilityHint\}/);
  assert.match(copy, /openDeaconProfile: "Opens deacon profile"/);
  assert.match(copy, /openDeaconProfile: "Відкриває профіль диякона"/);
});

test("profile avatars fall back to initials when an image fails", async () => {
  const avatar = await readFile(new URL("../src/features/members/ProfileAvatar.tsx", import.meta.url), "utf8");
  assert.match(avatar, /onError=\{\(\) => setFailed\(true\)\}/);
  assert.match(avatar, /hasSource && !failed/);
});
