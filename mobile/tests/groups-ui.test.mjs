import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const avatarFallback =
    await import("../src/features/members/avatar-fallback.ts");

test("group detail uses a standalone native switch instead of an unhosted SwiftUI control", async () => {
    const source = await readFile(
        new URL(
            "../src/features/groups/GroupDetailScreen.tsx",
            import.meta.url,
        ),
        "utf8",
    );
    assert.doesNotMatch(source, /from ["']@expo\/ui["']/);
    for (const symbol of ["StyleSheet", "Switch", "View"]) assert.match(source, new RegExp(`\\b${symbol}\\b`));
    assert.match(source, /accessibility\/app-text/);
});

test("the app-wide text size preference scales text, inputs, and native tab labels", async () => {
    const [provider, primitives, layout, menu] = await Promise.all([
        readFile(
            new URL(
                "../src/features/accessibility/TextSizeProvider.tsx",
                import.meta.url,
            ),
            "utf8",
        ),
        readFile(
            new URL(
                "../src/features/accessibility/app-text.tsx",
                import.meta.url,
            ),
            "utf8",
        ),
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
    const menu = await readFile(
        new URL("../src/app/menu.tsx", import.meta.url),
        "utf8",
    );
    assert.match(menu, /labels\.about/);
    assert.match(await readFile(new URL("../src/features/menu/AboutDialog.tsx", import.meta.url), "utf8"), /presentationStyle="pageSheet"/);
    assert.match(menu, /Constants\.expoConfig\?\.version/);
    assert.match(menu, /version: "Version"/);
    assert.match(menu, /version: "Версія"/);
    assert.match(menu, /styles\.versionText[\s\S]*labels\.licenses/);
    assert.doesNotMatch(menu, /1\.0\.0/);
    assert.match(menu, /Ionicons — MIT License/);
    assert.doesNotMatch(menu, /copy\.menu\.licenses/);
});

test("public group UI omits the redundant membership-group wording", async () => {
    const [groupsScreen, groupDetail, memberCopy] = await Promise.all([
        readFile(
            new URL("../src/features/groups/GroupsScreen.tsx", import.meta.url),
            "utf8",
        ),
        readFile(
            new URL(
                "../src/features/groups/GroupDetailScreen.tsx",
                import.meta.url,
            ),
            "utf8",
        ),
        readFile(
            new URL("../src/features/members/member-copy.ts", import.meta.url),
            "utf8",
        ),
    ]);
    assert.doesNotMatch(
        `${groupsScreen}\n${groupDetail}\n${memberCopy}`,
        /Membership group|Членська група/,
    );
    assert.match(groupsScreen, /copy\.myGroup/);
    assert.match(memberCopy, /group: "Belongs to"/);
});

test("member profile presents its group as a labeled action without a row arrow", async () => {
    const source = await readFile(
        new URL(
            "../src/features/members/MemberProfileScreen.tsx",
            import.meta.url,
        ),
        "utf8",
    );
    assert.match(source, /accessibilityHint=\{copy\.openGroup\}/);
    assert.match(source, /<Fact\s+disclosure/);
    assert.doesNotMatch(source, /name="chevron-forward"/);
    assert.match(source, /editButton: \{ left: "auto", right: 16 \}/);
});

test("deacon profiles show both belonging and responsibility groups", async () => {
    const [screen, repository, copy] = await Promise.all([
        readFile(
            new URL(
                "../src/features/members/MemberProfileScreen.tsx",
                import.meta.url,
            ),
            "utf8",
        ),
        readFile(
            new URL(
                "../src/features/members/SupabaseMemberProfileRepository.ts",
                import.meta.url,
            ),
            "utf8",
        ),
        readFile(
            new URL("../src/features/members/member-copy.ts", import.meta.url),
            "utf8",
        ),
    ]);
    assert.match(repository, /deacon_group_deacons/);
    assert.match(repository, /responsibilityGroupId/);
    assert.match(screen, /copy\.responsibleFor/);
    assert.match(copy, /responsibleFor: "Responsible for"/);
});

test("group cards identify their responsible deacons", async () => {
    const [screen, row, repository, copy] = await Promise.all([
        readFile(
            new URL("../src/features/groups/GroupsScreen.tsx", import.meta.url),
            "utf8",
        ),
        readFile(
            new URL(
                "../src/features/groups/deacon-profile-row.tsx",
                import.meta.url,
            ),
            "utf8",
        ),
        readFile(
            new URL(
                "../src/features/groups/SupabaseGroupsRepository.ts",
                import.meta.url,
            ),
            "utf8",
        ),
        readFile(
            new URL("../src/features/groups/groups-copy.ts", import.meta.url),
            "utf8",
        ),
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

test("group member search offers the same care and leadership filters as the directory", async () => {
    const source = await readFile(
        new URL(
            "../src/features/groups/GroupDetailScreen.tsx",
            import.meta.url,
        ),
        "utf8",
    );
    for (const filter of ["orphan", "widow", "deacon", "pastor"])
        assert.match(source, new RegExp(`id: "${filter}"`));
    assert.match(source, /accessibilityRole="checkbox"/);
    assert.match(source, /member\.leadershipMinistry === filter/);
    assert.match(source, /setFilters\(\[\]\)/);
});

test("birthday members use the shared row inside an accessible disclosure", async () => {
    const source = await readFile(
        new URL(
            "../src/features/groups/GroupDetailScreen.tsx",
            import.meta.url,
        ),
        "utf8",
    );
    assert.match(source, /const \[birthdaysExpanded, setBirthdaysExpanded\] = useState\(true\)/);
    assert.match(
        source,
        /<Section[\s\S]*?expanded=\{birthdaysExpanded\}[\s\S]*?title=\{copy\.birthdays\}/,
    );
    assert.match(source, /accessibilityState=\{\{ expanded \}\}/);
    assert.match(
        source,
        /setBirthdaysExpanded\([\s\S]*?\(expanded\) => !expanded/,
    );
    assert.match(source, /birthdaysExpanded[\s\S]*?upcoming\.map\(\(member\) => \([\s\S]*?<PersonRow/);
});

test("profile avatars fall back to initials when an image fails", async () => {
    const [avatar, directory, profile] = await Promise.all([
        readFile(
            new URL(
                "../src/features/members/ProfileAvatar.tsx",
                import.meta.url,
            ),
            "utf8",
        ),
        readFile(
            new URL(
                "../src/features/directory/DirectoryScreen.tsx",
                import.meta.url,
            ),
            "utf8",
        ),
        readFile(
            new URL(
                "../src/features/members/MemberProfileScreen.tsx",
                import.meta.url,
            ),
            "utf8",
        ),
    ]);
    assert.match(avatar, /onError=\{\(\) => setFailedSource\(requestIdentity\)\}/);
    assert.match(avatar, /hasSource && !failed/);
    assert.match(
        directory,
        /<ProfileAvatar[\s\S]*?name=\{item\.name\}[\s\S]*?size=\{desktop \? 56 : 72\}[\s\S]*?source=\{item\.avatar\}/,
    );
    assert.match(
        profile,
        /hasHeroPhoto[\s\S]*?styles\.heroFallback[\s\S]*?<ProfileAvatar[\s\S]*?name=\{name\}[\s\S]*?size=\{156\}/,
    );
    assert.equal(avatarFallback.avatarInitials("Yaroslav Salo"), "YS");
    assert.equal(avatarFallback.avatarInitials("Ярослав Сало"), "ЯС");
    assert.equal(avatarFallback.avatarInitials("Mary Ann van Buren"), "MB");
    assert.equal(avatarFallback.avatarInitials("Prince"), "P");
    assert.equal(avatarFallback.avatarInitials("   "), "?");
    assert.match(
        avatarFallback.avatarTone("Yaroslav Salo").backgroundColor,
        /^#[0-9A-F]{6}$/,
    );
});

test("group draft removals remain recheckable across searches and tabs without losing other assignments", async () => {
    const { createRequire } = await import("node:module");
    const require = createRequire(import.meta.url);
    const React = require("react"), ts = require("typescript");
    const source = await readFile(new URL("../src/features/manage/GroupAssignmentScreen.tsx", import.meta.url), "utf8");
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const states = [], refs = [], effects = [], effectDeps = [], saves = [];
    let cursor = 0, refCursor = 0, effectCursor = 0, query = "";
    const members = Array.from({ length: 80 }, (_, i) => ({ id: `member-${i}`, name: `Person ${i}`, currentMembershipGroupId: "group" }));
    const group = { id: "group", kind: "membership", name: "Group", memberIds: members.map(m => m.id), deaconIds: [], revision: "revision" };
    const hooks = { ...React,
        useState(initial) { const i = cursor++; if (!(i in states)) states[i] = typeof initial === "function" ? initial() : initial; return [states[i], value => { states[i] = typeof value === "function" ? value(states[i]) : value; }]; },
        useRef(initial) { return refs[refCursor++] ??= { current: initial }; },
        useEffect(effect, deps) { const i = effectCursor++; if (!effectDeps[i] || deps.some((v, j) => v !== effectDeps[i][j])) { effectDeps[i] = deps; effects.push(effect); } },
    };
    const modules = new Map([
        ["react", hooks], ["react/jsx-runtime", require("react/jsx-runtime")],
        ["react-native", { ActivityIndicator: "Spinner", FlatList: "List", SectionList: "SectionList", KeyboardAvoidingView: "Keyboard", Modal: "Modal", Platform: { OS: "web" }, Pressable: "Button", View: "View", StyleSheet: { create: x => x } }],
        ["expo-router", { useLocalSearchParams: () => ({ groupId: "group" }), useRouter: () => ({ canGoBack: () => false, replace() {} }) }],
        ["react-native-safe-area-context", { useSafeAreaInsets: () => ({ bottom: 0 }) }],
        ["@react-native-vector-icons/ionicons", { Ionicons: "Icon" }],
        ["@/features/accessibility/app-text", { Text: "Text", TextInput: "Input" }],
        ["@/features/platform/alert", { Alert: { alert() {} } }],
        ["@/features/appearance/AppearanceProvider", { useAppearance: () => ({ palette: { background: "white", accentSoft: "orange" } }) }],
        ["@/features/localization/LocalizationProvider", { useLocalization: () => ({ locale: "en" }) }],
        ["@/features/session/SessionProvider", { useSession: () => ({ status: "ready", account: { id: "admin", role: "admin", status: "active" } }) }],
        ["@/features/members/ProfileAvatar", { ProfileAvatar: "Avatar" }],
        ["@/features/shell/use-desktop-layout", { useDesktopLayout: () => false }],
        ["@/lib/permissions", { canManageGroups: () => true }],
        ["@/lib/supabase", { isBackendConfigured: true }],
        ["@/lib/async-state", { withTimeout: p => p, errorMessage: String }],
        ["@/lib/member-name", { formatMemberName: m => m.name }],
        ["./management-repository", { managementRepository: { loadGroupContext: async () => ({ group }), previewGroupMoves: async () => 0, saveGroup: async args => saves.push(args) } }],
        ["./use-management-search", { useManagementSearch: () => ({ query, committedQuery: query, setQuery: value => { query = value; } }) }],
        ["./use-management-list", { useManagementList: (_key, _loader, request, enabled) => { const items = enabled ? members.filter(m => (!request.filters.selectedOnly || request.filters.selectedIds.includes(m.id)) && m.name.includes(request.query ?? "")) : []; return { items: items.slice(0, 25), total: items.length, loading: null, error: null }; } }],
        ["./ManagementListParts", { ManagementFeedback: "Feedback", ManagementListFooter: "Footer", ManagementSearch: "Search", ui: {} }],
        ["./use-unsaved-changes", { useUnsavedChanges: () => ({ allowLeave() {}, confirmLeave(fn) { fn(); } }) }],
        ["./GroupFileImport", { GroupFileImport: "Import" }],
    ]);
    const exports = {};
    new Function("require", "exports", code)(id => { assert.ok(modules.has(id), id); return modules.get(id); }, exports);
    const text = node => node == null ? "" : typeof node !== "object" ? String(node) : Array.isArray(node) ? node.map(text).join("") : text(node.props?.children);
    function render() {
        cursor = refCursor = effectCursor = 0;
        const nodes = [];
        function walk(node) { if (!node || typeof node !== "object") return; if (Array.isArray(node)) return node.forEach(walk); nodes.push(node); walk(node.props?.children); if (node.type === "SectionList") { walk(node.props.renderSectionHeader()); for (const item of node.props.sections[0].data) walk(node.props.renderItem({ item })); } }
        walk(exports.GroupAssignmentScreen({})); while (effects.length) effects.shift()(); return nodes;
    }
    const memberRow = () => render().find(n => n.type === "Button" && n.props.accessibilityLabel?.startsWith("Person 0."));
    const press = label => { const button = render().find(n => n.type === "Button" && text(n) === label); assert.ok(button, label); button.props.onPress(); };
    render(); await new Promise(setImmediate);
    assert.equal(memberRow().props.accessibilityState.checked, true);
    assert.equal(memberRow().props.style[1].backgroundColor, "white");
    memberRow().props.onPress();
    assert.equal(memberRow().props.accessibilityState.checked, false);
    query = "Person 0";
    assert.equal(memberRow().props.accessibilityState.checked, false);
    press("All members"); query = "";
    press("In this group (79)");
    assert.equal(memberRow().props.accessibilityState.checked, false);
    memberRow().props.onPress();
    assert.equal(memberRow().props.accessibilityState.checked, true);
    memberRow().props.onPress(); press("Save group"); await new Promise(setImmediate);
    assert.equal(saves.length, 1);
    assert.deepEqual(saves[0].p_member_ids, group.memberIds.slice(1));
    assert.equal(saves[0].p_kind, "membership");
});
