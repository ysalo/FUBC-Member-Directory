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
  assert.equal(routeParams.managedAccountHref(" account-id "), "/manage/account/account-id");
});

test("managed account detail uses the durable route id", async () => {
  const screen = await readFile(new URL("../src/features/manage/AccountDetailScreen.tsx", import.meta.url), "utf8");
  assert.match(screen, /normalizeAccountId\(params\.accountId\)/);
  assert.doesNotMatch(screen, /getManagedAccountSelection|selectedAccountId/);
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
  assert.match(screen, /router\.push\(managedAccountHref\(accountId\)/);
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

test("menu identifies the linked member and treats sign out as destructive", async () => {
  const menu = await readFile(new URL("../src/app/menu.tsx", import.meta.url), "utf8");
  assert.match(menu, /memberProfileRepository\.getProfile\(session\.account\.personId\)/);
  assert.match(menu, /<ProfileAvatar/);
  assert.match(menu, /color: palette\.danger/);
  assert.match(menu, /accessibilityState=\{\{ busy: signingOut, disabled: signingOut \}\}/);
});
