import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = await import("../src/features/manage/model.ts");
const routeParams = await import("../src/features/manage/route-params.ts");

test("member records can be archived and restored", () => {
  const archived = source.managementReducer(source.initialManagementState, { type: "toggle-member-archive", memberId: "maria-ivanova" });
  assert.equal(archived.members[0].archived, true);
  const restored = source.managementReducer(archived, { type: "toggle-member-archive", memberId: "maria-ivanova" });
  assert.equal(restored.members[0].archived, false);
});

test("the final active administrator cannot be demoted", () => {
  const next = source.managementReducer(source.initialManagementState, { type: "set-account-role", accountId: "a-2", role: "member" });
  assert.equal(next.accounts.find((account) => account.id === "a-2")?.role, "admin");
});

test("unlinking returns an account to approval without changing member ministries", () => {
  const state = { members: [], accounts: [{ id: "a", name: "Leader", email: "leader@example.com", status: "active", role: "member", personId: "p" }] };
  const next = source.managementReducer(state, { type: "unlink-account", accountId: "a" });
  assert.equal(next.accounts[0].status, "pending");
  assert.equal("designation" in next.accounts[0], false);
  assert.equal(next.accounts[0].personId, null);
});

test("account settings no longer expose Pastor or Deacon designation controls", async () => {
  const screen = await readFile(new URL("../src/features/manage/AccountDetailScreen.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(screen, /set-account-designation|Ministry designation|Позначка служіння/);
});

test("managed account option grids provide stable React keys", async () => {
  const sourceText = await readFile(new URL("../src/features/manage/AccountDetailScreen.tsx", import.meta.url), "utf8");
  assert.match(sourceText, /key=\{value\}/);
});

test("managed account routes normalize Expo's runtime parameter shapes", () => {
  assert.equal(routeParams.normalizeAccountId(" account-id "), "account-id");
  assert.equal(routeParams.normalizeAccountId(["account-id", "ignored"]), "account-id");
  assert.equal(routeParams.normalizeAccountId([]), null);
  assert.equal(routeParams.normalizeAccountId(undefined), null);
  assert.equal(routeParams.accountIdFromPathname("/manage/account/account-id"), "account-id");
  assert.equal(routeParams.accountIdFromPathname("/manage/account/account%20id"), "account id");
  assert.equal(routeParams.accountIdFromPathname("/manage/account"), null);
  assert.equal(routeParams.resolveAccountId(" preferred-id ", "/manage/account/stale-id"), "preferred-id");
  assert.equal(routeParams.resolveAccountId(undefined, "/manage/account/account%20id"), "account id");
  assert.equal(routeParams.resolveAccountId(undefined, "/manage/account"), null);
  assert.equal(routeParams.managedAccountHref(" account-id "), "/manage/account/account-id");
  assert.deepEqual(routeParams.managedAccountRoute(" account/id "), { pathname: "/manage/account/[accountId]", params: { accountId: "account/id" } });
});

test("managed account detail uses the durable route id", async () => {
  const screen = await readFile(new URL("../src/features/manage/AccountDetailScreen.tsx", import.meta.url), "utf8");
  assert.match(screen, /resolveAccountId\(params\.accountId, pathname\)/);
  assert.doesNotMatch(screen, /getManagedAccountSelection|selectedAccountId/);
});

test("managed account failures provide a route back to the account list", async () => {
  const screen = await readFile(new URL("../src/features/manage/AccountDetailScreen.tsx", import.meta.url), "utf8");
  assert.match(screen, /kind: "invalid" \| "missing" \| "load"/);
  assert.match(screen, /router\.replace\("\/manage"\)/);
  assert.match(screen, /This account link is invalid/);
  assert.match(screen, /This account is no longer available/);
});

test("dynamic account routes render their Expo management screens", async () => {
  const route = await readFile(new URL("../src/app/manage/account/[accountId].tsx", import.meta.url), "utf8");
  const linkRoute = await readFile(new URL("../src/app/manage/account/[accountId]/link.tsx", import.meta.url), "utf8");
  assert.match(route, /<AccountDetailScreen/);
  assert.match(linkRoute, /<MemberLinkScreen/);
  assert.doesNotMatch(route + linkRoute, /<Redirect/);
});

test("manage navigation is only rendered for active editors and administrators", async () => {
  const [layout, webTabs] = await Promise.all([
    readFile(new URL("../src/app/_layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/features/shell/WebTabBar.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /showManage[\s\S]*canManageDirectory\(session\.account\)/);
  assert.match(layout, /showManage \? <NativeTabs\.Trigger name="manage">/);
  assert.match(webTabs, /tab\.labelKey !== "manage"[\s\S]*canManageDirectory\(session\.account\)/);
});

test("the manage stack anchors restored account routes to its landing screen", async () => {
  const layout = await readFile(new URL("../src/app/manage/_layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /unstable_settings/);
  assert.match(layout, /anchor: "index"/);
  assert.ok(layout.indexOf('<Stack.Screen name="index"') < layout.indexOf('<Stack.Screen name="account/\[accountId\]"'));
  assert.doesNotMatch(layout, /disablePopToTop/);
});

test("pending sign-ins are promoted into a newest-first approval queue", () => {
  const accounts = [
    { id: "active", name: "Active", email: "active@example.com", status: "active", role: "member", createdAt: "2026-09-17T10:00:00.000Z" },
    { id: "older", name: "Older", email: "older@example.com", status: "pending", role: "member", createdAt: "2026-09-16T10:00:00.000Z" },
    { id: "newer", name: "Newer", email: "newer@example.com", status: "pending", role: "member", createdAt: "2026-09-17T10:00:00.000Z" },
  ];
  assert.deepEqual(source.pendingAccounts(accounts).map((account) => account.id), ["newer", "older"]);
  assert.equal(source.orderedAccounts(accounts)[0].status, "pending");
});

test("management keeps pending approvals visible and preserves actionable load failures", async () => {
  const [screen, repository, gate] = await Promise.all([
    readFile(new URL("../src/features/manage/ManageScreen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/features/manage/management-repository.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/features/session/AccessGate.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(screen, /pendingAccounts\(state\.accounts\)/);
  assert.match(screen, /Waiting for approval/);
  assert.match(screen, /setFailure\(errorMessage\(cause\)\)/);
  assert.match(screen, /router\.push\(managedAccountRoute\(accountId\)\)/);
  assert.match(repository, /privatePhotoSources[\s\S]*\.catch\(\(\) => new Map\(\)\)/);
  assert.match(gate, /Opening your directory/);
  assert.match(gate, /Church access/);
  assert.match(gate, /Check again/);
});

test("directory creation stays management-only and personal deletion stays collapsed", async () => {
  const [directory, menu] = await Promise.all([
    readFile(new URL("../src/features/directory/DirectoryScreen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/menu.tsx", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(directory, /directory\.addMember|\/manage/);
  assert.match(menu, /advancedOpen \?/);
  assert.match(menu, /accessibilityState=\{\{ expanded: advancedOpen \}\}/);
});

test("directory rows use the leadership badge without duplicating its ministry label", async () => {
  const directory = await readFile(new URL("../src/features/directory/DirectoryScreen.tsx", import.meta.url), "utf8");
  assert.match(directory, /isLeadershipMinistryLabel/);
  assert.match(directory, /showsMinistry \? <Text/);
  assert.match(directory, /normalized === "deacon" \|\| normalized === "диякон"/);
});

test("menu identifies the linked member and treats sign out as destructive", async () => {
  const menu = await readFile(new URL("../src/app/menu.tsx", import.meta.url), "utf8");
  assert.match(menu, /memberProfileRepository\.getProfile\(session\.account\.personId\)/);
  assert.match(menu, /<ProfileAvatar/);
  assert.match(menu, /color: palette\.danger/);
  assert.match(menu, /accessibilityState=\{\{ busy: signingOut, disabled: signingOut \}\}/);
});

test("member deletion is an administrator-only confirmed management flow", async () => {
  const [editor, screen, route, layout, client] = await Promise.all([
    readFile(new URL("../src/features/manage/MemberFormScreen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/features/manage/MemberDeletionScreen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/manage/member/[memberId]/delete.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/manage/_layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/features/manage/member-deletion.ts", import.meta.url), "utf8"),
  ]);
  assert.match(editor, /canManageAccounts\(session\.account\)/);
  assert.match(editor, /Delete member permanently/);
  assert.match(screen, /confirmation\.trim\(\) === member\.name\.trim\(\)/);
  assert.match(screen, /@expo\/ui/);
  assert.match(screen, /All scheduled and past visits/);
  assert.match(screen, /actor\?\.personId === member\.id/);
  assert.match(route, /MemberDeletionScreen/);
  assert.match(layout, /member\/\[memberId\]\/delete/);
  assert.match(client, /functions\.invoke\("delete-member"/);
});

test("the member deletion service removes identity access before directory data", async () => {
  const edge = await readFile(new URL("../supabase/functions/delete-member/index.ts", import.meta.url), "utf8");
  const authDelete = edge.indexOf("auth.admin.deleteUser");
  const recordDelete = edge.indexOf('rpc("delete_member_record"');
  assert.ok(authDelete > -1 && recordDelete > authDelete);
  assert.match(edge, /caller\.status !== "active" \|\| caller\.role !== "admin"/);
  assert.match(edge, /linkedAccount\?\.id === caller\.id/);
  assert.match(edge, /person\.revision !== expectedRevision/);
  assert.match(edge, /storage\.from\("member-photos"\)\.remove/);
});
