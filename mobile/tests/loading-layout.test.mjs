import * as memberSearch from "../src/lib/member-search.ts";
import * as directoryOrder from "../src/features/directory/directory-order.ts";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import test from "node:test";
import * as permissions from "../src/lib/permissions.ts";
import * as dates from "../src/lib/dates.ts";
import * as phone from "../src/lib/phone.ts";
import * as memberName from "../src/lib/member-name.ts";
import * as avatarFallback from "../src/features/members/avatar-fallback.ts";
import { visitationCopy } from "../src/features/visitation/copy.ts";

const require = createRequire(import.meta.url);
const React = require("react");
const native = require("react-native-web");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");
const globalCss = await readFile(new URL("../src/app/global.css", import.meta.url), "utf8");
const sources = new Map();
for (const name of ["directory/DirectoryScreen", "visitation/VisitationListScreen", "visitation/VisitationUi", "accessibility/app-text", "members/ProfileAvatar", "members/care-status-badges", "members/leadership-badge"]) {
  const source = await readFile(new URL(`../src/features/${name}.tsx`, import.meta.url), "utf8");
  sources.set(name, ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText);
}

function renderScreen({ screen = "directory", loading = true, desktop = false, scale = 1, dark = false, locale = "en", error = false, directoryMembers, query = "", filters = [], filterOpen = false } = {}) {
  const palette = dark
    ? { background: "#111315", surface: "#1A1D20", subtle: "#292D31", text: "#F4F1EA", secondaryText: "#B2B4B7", line: "#34383D", accent: "#FF8052" }
    : { background: "#F1F0EB", surface: "#FCFBF8", subtle: "#E9E6DF", text: "#111722", secondaryText: "#686B70", line: "#D4D0C8", accent: "#EF5A24" };
  const actor = { id: "actor", status: "active", role: "member", leadershipMinistry: "deacon" };
  const members = Array.from({ length: 8 }, (_, index) => ({ id: String(index), name: `Member Adams`, ministry: "Choir", ministryUk: "Choir", phone: "2065550100", avatar: {}, leadershipMinistry: null }));
  const visits = ["actor", "other"].flatMap((plannerId) => [0, 1].map((index) => ({ id: `${plannerId}-${index}`, plannerId, plannerName: "Visit Organizer", memberName: "Member Adams", status: "open", scheduledAt: "2026-09-26T18:00:00Z", location: "101 Main Street", recipients: [{ accountId: plannerId === "actor" ? "other" : "actor", participantPersonId: "person", participantName: "Visit Participant", response: "pending" }] })));
  const directoryState = [query, query, filters, filterOpen];
  const visitState = ["current", error ? { status: "error", message: "Failed" } : loading ? { status: "loading" } : { status: "ready", snapshot: { actor }, visits, nextOffset: null, loadingMore: false }, false];
  let stateIndex = 0;
  const screenReact = { ...React, useState: () => [(screen === "directory" ? directoryState : visitState)[stateIndex++], () => {}] };
  const icon = ({ size, style }) => React.createElement(native.View, { style: [{ width: size, height: size }, style] });
  const modules = new Map([
    ["@/lib/member-search", memberSearch],
    ["@/lib/use-warm-resource", { useWarmResource: () => ({ data: loading || error ? undefined : { members: directoryMembers ?? members, visits: 0 }, status: error ? "error" : loading ? "loading" : "ready", error, refreshing: false, refresh() {} }) }],
    ["@/features/shell/ResourceRefresh", { ResourceRefresh: () => null }],
    ["react-native", native],
    ["react/jsx-runtime", require("react/jsx-runtime")],
    ["react-native-safe-area-context", { useSafeAreaInsets: () => ({ top: 0 }) }],
    ["expo-router", { useFocusEffect() {}, useRouter: () => ({ push() {} }), Link: ({ href, children }) => React.cloneElement(children, { href }) }],
    ["expo-image", { Image: native.Image }],
    ["@react-native-vector-icons/ionicons", { Ionicons: icon }],
    ["@/features/appearance/AppearanceProvider", { useAppearance: () => ({ palette }) }],
    ["./TextSizeProvider", { useTextSize: () => ({ scale }) }],
    ["@/features/shell/use-desktop-layout", { useDesktopLayout: () => desktop }],
    ["@/features/localization/LocalizationProvider", { useLocalization: () => ({ locale, copy: { directory: { title: "Directory", searchLabel: "Search members", search: "Search", emptyTitle: "No members", emptyDetail: "No matches" } } }) }],
    ["@/features/session/SessionProvider", { useSession: () => ({ status: "ready", account: actor }) }],
    ["@/features/shell/WebTabBar", { WebTabBar: () => null }],
    ["@/features/duty/DutySummary", { DutySummary: () => null }],
    ["./directory-order", directoryOrder],
    ["./directory-repository", {}],
    ["./repository", { visitationDemoMode: false }],
    ["./copy", { visitationCopy }],
    ["@/lib/permissions", permissions],
    ["@/lib/dates", dates],
    ["@/lib/phone", phone],
    ["@/lib/member-name", memberName],
    ["./avatar-fallback", avatarFallback],
  ]);
  const load = (name) => {
    const exports = {};
    new Function("require", "exports", sources.get(name))((id) => {
      if (id === "react") return name.endsWith("Screen") ? screenReact : React;
      if (modules.has(id)) return modules.get(id);
      if (id === "./VisitationUi") return load("visitation/VisitationUi");
      if (id.startsWith("@/features/")) return load(id.slice("@/features/".length));
      throw new Error(`Unexpected fixture import ${id}`);
    }, exports);
    return exports;
  };
  const Component = screen === "directory" ? load("directory/DirectoryScreen").DirectoryScreen : load("visitation/VisitationListScreen").VisitationListScreen;
  const markup = renderToStaticMarkup(React.createElement(Component));
  return { markup, palette };
}

if (!process.argv.includes("--preview")) {
  test("Directory gender checkboxes keep match-any results and show the authorized result count", () => {
    const people = [
      { id: "male-orphan", name: "Alex Alpha", gender: "male", isOrphan: true },
      { id: "female-other", name: "Beth Beta", gender: "female", isOrphan: false },
      { id: "male-other", name: "Carl Gamma", gender: "male", isOrphan: false },
      { id: "female-orphan", name: "Dana Delta", gender: "female", isOrphan: true },
    ].map((person) => ({ ministry: "", ministryUk: "", phone: null, avatar: {}, leadershipMinistry: null, isWidow: false, membershipGroupId: "group", ...person }));
    const render = (options = {}) => renderScreen({ loading: false, directoryMembers: people, filterOpen: true, ...options }).markup;
    const ids = (markup) => [...markup.matchAll(/href="\/members\/([^"]+)"/g)].map((match) => match[1]);
    assert.equal(ids(render()).length, 4);
    assert.doesNotMatch(render(), /Showing [0-9]+ of/);
    const options = render();
    assert.match(options, /<div(?=[^>]*role="checkbox")(?=[^>]*aria-label="Male")/);
    assert.match(options, /<div(?=[^>]*role="checkbox")(?=[^>]*aria-label="Female")/);
    assert.deepEqual(ids(render({ filters: ["female"] })), ["female-other", "female-orphan"]);
    assert.deepEqual(ids(render({ filters: ["male"] })), ["male-orphan", "male-other"]);
    assert.deepEqual(ids(render({ filters: ["male", "female"] })).length, 4);
    const combined = render({ filters: ["female", "orphan"] });
    assert.deepEqual(ids(combined), ["male-orphan", "female-other", "female-orphan"]);
    assert.match(combined, /Showing 3 of 4 members/);
    assert.match(combined, /<div(?=[^>]*role="checkbox")(?=[^>]*aria-label="Female")(?=[^>]*aria-checked="true")/);
    assert.deepEqual(ids(render({ filters: ["female", "orphan"], query: "Beth" })), ["female-other"]);
    assert.match(render({ query: "Nobody" }), /Showing 0 of 4 members/);
    assert.match(render({ filters: ["male", "female"] }), /Showing 4 of 4 members/);
    assert.match(render({ filters: ["female"], locale: "uk" }), /Показано 2 із 4 учасників/);
    assert.doesNotMatch(render({ query: "   " }), /Showing [0-9]+ of/);
  });
  test("cold lists expose one busy state and no placeholder navigation; loaded lists expose real actions", () => {
    for (const screen of ["directory", "visitation"]) for (const desktop of [false, true]) {
      const loading = renderScreen({ screen, desktop }).markup;
      assert.equal((loading.match(/role="progressbar"/g) ?? []).length, 1);
      assert.match(loading, /aria-busy="true"/);
      assert.match(loading, /aria-hidden="true"/);
      assert.doesNotMatch(loading, /href="\/members\//);
      const ready = renderScreen({ screen, desktop, loading: false }).markup;
      assert.doesNotMatch(ready, /role="progressbar"/);
      assert.match(ready, /Member Adams/);
      if (screen === "directory") assert.equal((ready.match(/href="\/members\//g) ?? []).length, 8);
      else {
        assert.equal((loading.match(/role="tab"/g) ?? []).length, 2);
        assert.equal((ready.match(/role="tab"/g) ?? []).length, 2);
        assert.match(loading, /Plan visit/);
      }
      assert.match(renderScreen({ screen, desktop, loading: false, error: true }).markup, /Try again/);
    }
  });
} else {
  createServer((request, response) => {
    const query = new URL(request.url, "http://localhost").searchParams;
    const { markup, palette } = renderScreen({ screen: query.get("screen") ?? "directory", loading: query.get("state") !== "ready", desktop: query.get("desktop") === "1", scale: Number(query.get("scale") ?? 1), dark: query.get("dark") === "1", locale: query.get("locale") ?? "en", query: query.get("query") ?? "", filters: query.get("filters")?.split(",").filter(Boolean) ?? [], filterOpen: query.get("open") === "1" });
    const variables = Object.entries(palette).map(([key, value]) => `--app-${key}:${value}`).join(";");
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${native.StyleSheet.getSheet().textContent}${globalCss}html,body,#root{margin:0;height:100%;${variables}}#root{display:flex;flex-direction:column}</style><div id="root">${markup}</div></html>`);
  }).listen(4175, "127.0.0.1", () => console.log("Loading-layout fixture: http://127.0.0.1:4175"));
}
