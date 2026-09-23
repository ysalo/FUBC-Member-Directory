import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const source = await import("../src/features/manage/model.ts");
const routeParams = await import("../src/features/manage/route-params.ts");

const require = createRequire(import.meta.url);
const ts = require("typescript");
async function bulkUiFixture(component, role = "admin") {
    const React = require("react");
    const states = [];
    const refs = [];
    const effects = [];
    let cursor = 0;
    let refCursor = 0;
    let effectCursor = 0;
    let pendingEffects = [];
    const actor = { id: "admin", personId: "self", status: "active", role };
    const members = ["self", "first", "second"].map((id) => ({ id, name: id, revision: 7, archived: false, group: "Choir" }));
    const calls = [];
    let finish;
    const pending = new Promise((resolve) => { finish = resolve; });
    const hooks = { ...React,
        useState(initial) {
            const index = cursor++;
            if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
            return [states[index], (value) => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
        },
        useRef(initial) { return refs[refCursor++] ?? (refs[refCursor - 1] = { current: initial }); },
        useMemo: (factory) => factory(), useCallback: (callback) => callback,
        useEffect(callback, deps) {
            const index = effectCursor++;
            if (!effects[index] || deps.some((value, offset) => value !== effects[index][offset])) pendingEffects.push(callback);
            effects[index] = deps;
        },
    };
    const code = ts.transpileModule(await readFile(new URL(`../src/features/manage/${component}.tsx`, import.meta.url), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const exports = {};
    const closeCalls = [];
    const keyboardListeners = new Map();
    new Function("require", "exports", "document", code)((id) => {
        if (id === "react") return hooks;
        if (id === "react/jsx-runtime") return require(id);
        if (id === "react-native") return { Platform: { OS: "web" }, View: "View", Pressable: "Pressable", ScrollView: "ScrollView", Modal: "Modal", ActivityIndicator: "ActivityIndicator", FlatList: ({ ListHeaderComponent, data, renderItem }) => React.createElement("List", {}, ListHeaderComponent, data.map((item) => renderItem({ item }))), StyleSheet: { create: (styles) => styles, hairlineWidth: 1 } };
        if (id === "react-native-safe-area-context") return { SafeAreaView: "SafeAreaView" };
        if (id === "@react-native-vector-icons/ionicons") return { Ionicons: "Icon" };
        if (id === "@/features/accessibility/app-text") return { Text: "Text", TextInput: "TextInput" };
        if (id === "@/features/appearance/AppearanceProvider") return { useAppearance: () => ({ palette: {} }) };
        if (id === "@/features/localization/LocalizationProvider") return { useLocalization: () => ({ locale: "en" }) };
        if (id === "@/features/session/SessionProvider") return { useSession: () => ({ status: "ready", account: actor }) };
        if (id === "@/features/shell/use-desktop-layout") return { useDesktopLayout: () => false };
        if (id === "@/features/shell/WebTabBar") return { WebTabBar: "Tabs" };
        if (id === "@/features/members/ProfileAvatar") return { ProfileAvatar: "Avatar" };
        if (id === "expo-router") return { useFocusEffect() {}, useRouter: () => ({ push: (route) => calls.push(route) }) };
        if (id === "@/lib/permissions") return { canManageAccounts: (account) => account?.status === "active" && account.role === "admin", canManageDirectory: () => true };
        if (id === "@/lib/supabase") return { isBackendConfigured: true };
        if (id === "@/lib/async-state") return { withTimeout: (promise) => promise, errorMessage: String };
        if (id === "./management-repository") return { managementRepository: { load: async () => ({ members, accounts: [] }) } };
        if (id === "./route-params") return routeParams;
        if (id === "./model") return source;
        if (id === "./BulkMemberDeletion") return { BulkMemberDeletion: "BulkMemberDeletion" };
        if (id === "./member-deletion") return { deleteMembers: (requests) => { calls.push(requests); return pending; } };
        throw new Error(`Unexpected module ${id}`);
    }, exports, { addEventListener: (event, callback) => keyboardListeners.set(event, callback), removeEventListener: (event) => keyboardListeners.delete(event) });
    if (component === "ManageScreen") { states[0] = "members"; states[1] = { members, accounts: [] }; states[2] = false; }
    function render() {
        cursor = 0; refCursor = 0; effectCursor = 0; pendingEffects = [];
        const nodes = [];
        const walk = (node) => {
            if (!node || typeof node !== "object") return;
            if (Array.isArray(node)) { node.forEach(walk); return; }
            if (typeof node.type === "function") { walk(node.type(node.props)); return; }
            nodes.push(node); walk(node.props?.children);
        };
        walk(exports[component]({ members: members.slice(1), onClose: (attempted) => closeCalls.push(attempted) }));
        pendingEffects.forEach((effect) => effect());
        return nodes;
    }
    const text = (node) => typeof node === "string" || typeof node === "number" ? String(node) : Array.isArray(node) ? node.map(text).join("") : text(node?.props?.children ?? "");
    const button = (label) => render().find((node) => node.type === "Pressable" && text(node) === label);
    render();
    return { render, button, calls, closeCalls, finish, actor, escape: () => keyboardListeners.get("keydown")?.({ key: "Escape", preventDefault() {}, stopPropagation() {} }) };
}

test("member selection excludes self, follows shown members, and clears across searches and panels", async () => {
    const ui = await bulkUiFixture("ManageScreen");
    ui.button("Select members").props.onPress();
    let rows = ui.render().filter((node) => node.props?.accessibilityRole === "checkbox");
    assert.equal(rows.find((node) => node.props.accessibilityLabel === "self").props.disabled, true);
    ui.button("Select all shown").props.onPress();
    ui.button("Delete selected (2)").props.onPress();
    assert.deepEqual(ui.render().find((node) => node.type === "BulkMemberDeletion").props.members.map((member) => member.id), ["first", "second"]);
    ui.render().find((node) => node.type === "BulkMemberDeletion").props.onClose(false);
    ui.render().find((node) => node.type === "TextInput").props.onChangeText("first");
    ui.render();
    ui.button("Select members").props.onPress();
    ui.button("Select all shown").props.onPress();
    assert.equal(ui.button("Delete selected (1)").props.disabled, false);
    ui.button("Accounts").props.onPress(); ui.render();
    assert.equal(ui.button("Select members"), undefined);
    ui.button("Members").props.onPress(); ui.render();
    assert.ok(ui.button("Select members"));
    const editor = await bulkUiFixture("ManageScreen", "editor");
    assert.equal(editor.button("Select members"), undefined);
});

test("bulk confirmation requires typed intent, blocks duplicate submits, and reports partial results", async () => {
    const ui = await bulkUiFixture("BulkMemberDeletion");
    assert.equal(ui.button("Delete permanently").props.disabled, true);
    ui.render().find((node) => node.type === "TextInput").props.onChangeText("DELETE");
    const submit = ui.button("Delete permanently").props.onPress;
    submit(); submit();
    assert.equal(ui.calls.length, 1);
    assert.deepEqual(ui.calls[0], ["first", "second"].map((personId) => ({ personId, expectedRevision: 7, confirmation: personId })));
    assert.equal(ui.button("Cancel").props.disabled, true);
    ui.render().find((node) => node.type === "Modal").props.onRequestClose();
    ui.escape();
    assert.deepEqual(ui.closeCalls, []);
    ui.finish({ completed: [{ deletedPersonId: "first" }], failedPersonId: "second", error: "conflict" });
    await Promise.resolve(); await Promise.resolve();
    assert.equal(ui.button("Delete permanently"), undefined);
    assert.match(JSON.stringify(ui.render()), /Deletion stopped/);
    ui.button("Close").props.onPress();
    assert.deepEqual(ui.closeCalls, [true]);
    const canceled = await bulkUiFixture("BulkMemberDeletion");
    canceled.button("Cancel").props.onPress();
    assert.deepEqual(canceled.calls, []);
    assert.deepEqual(canceled.closeCalls, [false]);
    const escaped = await bulkUiFixture("BulkMemberDeletion");
    escaped.escape();
    assert.deepEqual(escaped.calls, []);
    assert.deepEqual(escaped.closeCalls, [false]);
    const editor = await bulkUiFixture("BulkMemberDeletion", "editor");
    editor.render().find((node) => node.type === "TextInput").props.onChangeText("DELETE");
    assert.equal(editor.button("Delete permanently").props.disabled, true);
});

test("bulk member deletion is sequential and stops at the first failure", async () => {
    const code = ts.transpileModule(await readFile(new URL("../src/features/manage/member-deletion.ts", import.meta.url), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    for (const fail of [false, true]) {
        const calls = [];
        const invalidations = [];
        const exports = {};
        new Function("require", "exports", code)((id) => {
            if (id === "@/lib/session-cache") return { invalidateData: (...topics) => invalidations.push(topics) };
            if (id === "@/lib/supabase") return { requireSupabase: () => ({ functions: { async invoke(name, { body }) {
                calls.push(body);
                if (fail && body.personId === "second") return { error: { context: { json: async () => ({ code: "conflict" }) } } };
                return { data: { status: "completed", deletedPersonId: body.personId, deletedAccountId: null, deletedVisitCount: 0 } };
            } } }) };
            throw new Error(`Unexpected module ${id}`);
        }, exports);
        const requests = ["first", "second", "third"].map((personId) => ({ personId, expectedRevision: 7, confirmation: personId }));
        const result = await exports.deleteMembers(requests);
        assert.deepEqual(calls, fail ? requests.slice(0, 2) : requests);
        assert.equal(result.completed.length, fail ? 1 : 3);
        assert.equal(result.failedPersonId, fail ? "second" : null);
        assert.equal(result.error, fail ? "conflict" : null);
        assert.equal(invalidations.length, result.completed.length);
    }
});

const managementCode = ts.transpileModule(await readFile(new URL("../src/features/manage/management-repository.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function photoRepository(failure) {
    const calls = [];
    const invalidations = [];
    const storage = {
        async upload(path, bytes, options) {
            calls.push({ type: "upload", path, options });
            return { error: failure === "thumbnail" && path.endsWith(".avatar-256.jpg") ? { message: "Thumbnail failed" } : null };
        },
        async remove(paths) { calls.push({ type: "remove", paths }); return { error: failure === "cleanup" ? { message: "Cleanup failed" } : null }; },
    };
    const client = { from() {
        const query = { select() { return query; }, eq() { return query; },
            async limit() { return { data: failure === "referenced" ? [{ id: "other" }] : [], error: null }; },
            async maybeSingle() { return { data: { photo_path: "member/previous.jpg" }, error: failure === "ambiguous" ? { message: "Network failed" } : null }; },
        };
        return query;
    }, storage: { from: () => storage }, async rpc(name, args) {
        calls.push({ type: "publish", name, args });
        return { data: { id: "member", photo_path: args.p_path, revision: 2 }, error: ["conflict", "ambiguous"].includes(failure) ? { message: "Conflict" } : null };
    } };
    const exports = {};
    new Function("require", "exports", managementCode)((id) => {
        if (id === "@/lib/supabase") return { isBackendConfigured: true, requireSupabase: () => client };
        if (id === "@/lib/permissions") return { canManageDirectory: () => true };
        if (id === "@/lib/repository-helpers") return { activeAccount: () => ({}), unwrap: (result) => { if (result.error) throw new Error(result.error.message); return result.data; } };
        if (id === "@/lib/session-cache") return { invalidateData: (...topics) => invalidations.push(topics), createSessionCache: () => ({ load: (key, loader) => loader() }) };
        if (id === "@/lib/photo-cache") return { thumbnailPath: (path) => `${path}.avatar-256.jpg` };
        if (id === "./model") return source;
        throw new Error(`Unexpected module ${id}`);
    }, exports);
    return { repository: new exports.SupabaseManagementRepository(), calls, invalidations };
}

test("member saves send optional patronymics and preserve omission for other callers", async () => {
    const { repository, calls } = photoRepository();
    await repository.saveMemberDetails({ name: "Ivan Petrenko", patronymic: " Mykolayovych " });
    assert.equal(calls.at(-1).args.p_data.patronymic, "Mykolayovych");
    await repository.saveMemberDetails({ name: "Ivan Petrenko", patronymic: " " });
    assert.equal(calls.at(-1).args.p_data.patronymic, null);
    await repository.saveMemberDetails({ name: "Ivan Petrenko" });
    assert.equal(Object.hasOwn(calls.at(-1).args.p_data, "patronymic"), false);
});

test("photo pairs publish only after both uploads and clean both replaced paths", async () => {
    const { repository, calls, invalidations } = photoRepository();
    await repository.replacePhoto({ id: "member", revision: 1, photoPath: "member/previous.jpg" }, new ArrayBuffer(20), "image/jpeg", new ArrayBuffer(10));
    assert.deepEqual(calls.map((call) => call.type), ["upload", "upload", "publish", "remove"]);
    assert.equal(calls[1].path, `${calls[0].path}.avatar-256.jpg`);
    assert.equal(calls[2].args.p_path, calls[0].path);
    assert.deepEqual(calls[3].paths, ["member/previous.jpg", "member/previous.jpg.avatar-256.jpg"]);
    assert.equal(invalidations.length, 1);
});

test("incomplete and conflicted photo pairs are not published and clean only the attempted pair", async () => {
    for (const failure of ["thumbnail", "conflict"]) {
        const { repository, calls, invalidations } = photoRepository(failure);
        await assert.rejects(repository.replacePhoto({ id: "member", revision: 1, photoPath: "member/previous.jpg" }, new ArrayBuffer(20), "image/jpeg", new ArrayBuffer(10)));
        assert.deepEqual(calls.at(-1).paths, [calls[0].path, `${calls[0].path}.avatar-256.jpg`]);
        assert.equal(calls.filter((call) => call.type === "publish").length, failure === "thumbnail" ? 0 : 1);
        assert.equal(invalidations.length, 0);
    }
    const { repository, calls } = photoRepository();
    await assert.rejects(repository.replacePhoto({ id: "member", revision: 1 }, new ArrayBuffer(20), "image/jpeg"), /thumbnail/);
    assert.equal(calls.length, 0);
});

test("photo removal clears the published pointer and both files; cleanup errors are surfaced", async () => {
    for (const failure of [null, "cleanup"]) {
        const { repository, calls } = photoRepository(failure);
        const result = await repository.replacePhoto({ id: "member", revision: 1, photoPath: "member/photo.png" }, null);
        assert.equal(calls[0].args.p_path, null);
        assert.deepEqual(calls[1].paths, ["member/photo.png", "member/photo.png.avatar-256.jpg"]);
        assert.equal(Boolean(result.cleanupWarning), failure === "cleanup");
    }
});

test("photo cleanup preserves referenced originals and ambiguous publications", async () => {
    const referenced = photoRepository("referenced");
    await referenced.repository.replacePhoto({ id: "member", revision: 1, photoPath: "shared.jpg" }, new ArrayBuffer(20), "image/jpeg", new ArrayBuffer(10));
    assert.equal(referenced.calls.some((call) => call.type === "remove"), false);
    const ambiguous = photoRepository("ambiguous");
    await assert.rejects(ambiguous.repository.replacePhoto({ id: "member", revision: 1, photoPath: "shared.jpg" }, new ArrayBuffer(20), "image/jpeg", new ArrayBuffer(10)), /could not be confirmed/);
    assert.equal(ambiguous.calls.some((call) => call.type === "remove"), false);
});

test("thumbnail generation crops centrally, never upscales and releases temporary files", async () => {
    const code = ts.transpileModule(await readFile(new URL("../src/features/manage/photo-thumbnail.ts", import.meta.url), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    for (const [width, height] of [[1200, 800], [800, 1200], [120, 80]]) {
        const calls = [];
        let renders = 0;
        const context = {
            crop: (rect) => calls.push(["crop", rect]),
            resize: (size) => calls.push(["resize", size]),
            release: () => calls.push(["release-context"]),
            async renderAsync() {
                const number = ++renders;
                return { width, height, release: () => calls.push(["release-image", number]), async saveAsync(options) {
                    calls.push(["save", options]);
                    return { uri: "file:///temporary-thumbnail.jpg", base64: "AQID" };
                } };
            },
        };
        const exports = {};
        new Function("require", "exports", code)((id) => {
            if (id === "expo-image-manipulator") return { ImageManipulator: { manipulate: () => context }, SaveFormat: { JPEG: "jpeg" } };
            if (id === "expo-file-system") return { File: class { constructor(uri) { assert.equal(uri, "file:///temporary-thumbnail.jpg"); } delete() { calls.push(["delete-file"]); } } };
            throw new Error(id);
        }, exports);
        assert.deepEqual([...new Uint8Array(await exports.createPhotoThumbnail("original"))], [1, 2, 3]);
        const side = Math.min(width, height);
        assert.deepEqual(calls[0], ["crop", { originX: (width - side) / 2, originY: (height - side) / 2, width: side, height: side }]);
        assert.deepEqual(calls[1], ["resize", { width: Math.min(256, side), height: Math.min(256, side) }]);
        assert.deepEqual(calls.slice(-4), [["delete-file"], ["release-image", 2], ["release-image", 1], ["release-context"]]);
    }
});

test("profile renditions are bounded and originals are never returned for upload", async () => {
    const code = ts.transpileModule(await readFile(new URL("../src/features/manage/photo-thumbnail.ts", import.meta.url), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    for (const [width, height] of [[4000, 3000], [3000, 4000], [120, 80]]) {
        const sizes = [];
        const qualities = [];
        let deleted = 0;
        let contexts = 0;
        const exports = {};
        new Function("require", "exports", code)((id) => {
            if (id === "expo-image-manipulator") return { SaveFormat: { JPEG: "jpeg" }, ImageManipulator: { manipulate: () => ({
                resize: (size) => sizes.push(size), crop() {}, release: () => contexts++,
                async renderAsync() { return { width, height, release() {}, async saveAsync(options) {
                    qualities.push(options.compress);
                    return { uri: "file:///encoded.jpg", base64: "AQID" };
                } }; },
            }) } };
            if (id === "expo-file-system") return { File: class { delete() { deleted++; } } };
            throw new Error(id);
        }, exports);
        const result = await exports.createPhotoRenditions("selected-original");
        assert.equal(result.mimeType, "image/jpeg");
        assert.equal(result.uri, "data:image/jpeg;base64,AQID");
        assert.equal(result.bytes.byteLength, 3);
        assert.equal(result.thumbnail.byteLength, 3);
        if (width > 1280 || height > 1280) assert.equal(Math.max(sizes[0].width, sizes[0].height), 1280);
        else assert.equal(sizes.length, 1);
        assert.deepEqual(qualities, [0.8, 0.8]);
        assert.equal(deleted, 2);
        assert.equal(contexts, 2);
    }
    const { repository, calls } = photoRepository();
    await assert.rejects(repository.replacePhoto({ id: "member", revision: 1 }, new ArrayBuffer(512 * 1024 + 1), "image/jpeg", new ArrayBuffer(10)), /512 KB/);
    await assert.rejects(repository.replacePhoto({ id: "member", revision: 1 }, new ArrayBuffer(10), "image/jpeg", new ArrayBuffer(50 * 1024 + 1)), /thumbnail/);
    assert.equal(calls.length, 0);
});

test("oversized encodes stop after three attempts and release all temporary files", async () => {
    const code = ts.transpileModule(await readFile(new URL("../src/features/manage/photo-thumbnail.ts", import.meta.url), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const qualities = [];
    let deleted = 0;
    let released = 0;
    const exports = {};
    new Function("require", "exports", code)((id) => {
        if (id === "expo-image-manipulator") return { SaveFormat: { JPEG: "jpeg" }, ImageManipulator: { manipulate: () => ({
            resize() {}, release: () => released++,
            async renderAsync() { return { width: 1600, height: 1000, release: () => released++, async saveAsync(options) {
                qualities.push(options.compress);
                return { uri: "file:///encoded.jpg", base64: Buffer.alloc(512 * 1024 + 1).toString("base64") };
            } }; },
        }) } };
        if (id === "expo-file-system") return { File: class { delete() { deleted++; } } };
        throw new Error(id);
    }, exports);
    await assert.rejects(exports.createPhotoRenditions("original"), /upload limit/);
    assert.deepEqual(qualities, [0.8, 0.75, 0.7]);
    assert.equal(deleted, 3);
    assert.equal(released, 3);
});

test("member records can be archived and restored", () => {
    const archived = source.managementReducer(source.initialManagementState, {
        type: "toggle-member-archive",
        memberId: "maria-ivanova",
    });
    assert.equal(archived.members[0].archived, true);
    assert.equal(archived.members[0].group, "");
    assert.ok(archived.members[0].leftAt);
    const restored = source.managementReducer(archived, {
        type: "toggle-member-archive",
        memberId: "maria-ivanova",
    });
    assert.equal(restored.members[0].archived, false);
    assert.equal(restored.members[0].leftAt, null);
});

test("membership departure removes group assignments and stays available to managers", async () => {
    const [editor, repository, manage] = await Promise.all([
        readFile(
            new URL(
                "../src/features/manage/MemberFormScreen.tsx",
                import.meta.url,
            ),
            "utf8",
        ),
        readFile(
            new URL(
                "../src/features/manage/management-repository.ts",
                import.meta.url,
            ),
            "utf8",
        ),
        readFile(
            new URL("../src/features/manage/ManageScreen.tsx", import.meta.url),
            "utf8",
        ),
    ]);
    assert.match(
        editor,
        /managementRepository\.setMembershipActive\([\s\S]*?member,[\s\S]*?active[\s\S]*?\)/,
    );
    assert.match(
        editor,
        /hidden from the directory and removed from every group/,
    );
    const archival = repository.slice(repository.indexOf('async setMembershipActive'), repository.indexOf('async saveAccount'));
    assert.doesNotMatch(archival, /saveGroup|loadGroupManagement/);
    assert.match(archival, /this\.saveMember\(current\.id, member\.revision/);
    const migration = await readFile(new URL('../supabase/migrations/20260923010000_role_permissions.sql', import.meta.url), 'utf8');
    assert.match(migration, /delete from public\.deacon_group_members where person_id=result\.id/);
    assert.match(migration, /delete from public\.deacon_group_deacons where person_id=result\.id/);
    assert.match(repository, /membership_group_id: null,[\s\S]*?archived: !active/);
    assert.match(manage, /formerMembers: "Former members"/);
    assert.match(manage, /archived === showFormer/);
    assert.match(manage, /name="options-outline"/);
    assert.match(manage, /accessibilityViewIsModal/);
    assert.match(manage, /accessibilityState=\{\{[\s\S]*?checked: showFormer/);
    assert.doesNotMatch(manage, /styles\.formerFilter/);
});

test("the group management editor creates groups and searches and saves multiple existing members", async () => {
    const [screen, list, route, repository] = await Promise.all([
        readFile(
            new URL(
                "../src/features/manage/GroupAssignmentScreen.tsx",
                import.meta.url,
            ),
            "utf8",
        ),
        readFile(
            new URL(
                "../src/features/manage/GroupsManagementScreen.tsx",
                import.meta.url,
            ),
            "utf8",
        ),
        readFile(
            new URL("../src/app/manage/group/new.tsx", import.meta.url),
            "utf8",
        ),
        readFile(
            new URL(
                "../src/features/manage/management-repository.ts",
                import.meta.url,
            ),
            "utf8",
        ),
    ]);
    assert.match(screen, /<TextInput[^>]+maxLength=\{120\}/);
    assert.match(screen, /@expo\/ui\/community\/segmented-control/);
    assert.match(screen, /Search members/);
    assert.match(screen, /selectedMembers/);
    assert.match(screen, /p_name: nextName/);
    assert.match(screen, /p_member_ids: selectedMembers/);
    assert.match(
        screen,
        /managementRepository\.deleteGroup\(group\.id, group\.revision\)/,
    );
    assert.match(screen, /Members will not be deleted/);
    assert.match(screen, /style: "destructive"/);
    assert.match(list, /\/manage\/group\/new/);
    assert.match(route, /<GroupAssignmentScreen creating/);
    assert.match(repository, /currentMembershipGroupId/);
    assert.match(repository, /currentResponsibilityGroupId/);
});

test("the final active administrator cannot be demoted", () => {
    const next = source.managementReducer(source.initialManagementState, {
        type: "set-account-role",
        accountId: "a-2",
        role: "member",
    });
    assert.equal(
        next.accounts.find((account) => account.id === "a-2")?.role,
        "admin",
    );
});

test("unlinking returns an account to approval without changing member ministries", () => {
    const state = {
        members: [],
        accounts: [
            {
                id: "a",
                name: "Leader",
                email: "leader@example.com",
                status: "active",
                role: "member",
                personId: "p",
            },
        ],
    };
    const next = source.managementReducer(state, {
        type: "unlink-account",
        accountId: "a",
    });
    assert.equal(next.accounts[0].status, "pending");
    assert.equal("designation" in next.accounts[0], false);
    assert.equal(next.accounts[0].personId, null);
});

test("linking an account copies its email to the member", () => {
    const state = {
        members: [{ id: "person", name: "Member", group: "", archived: false }],
        accounts: [
            {
                id: "account",
                name: "Member",
                email: "member@example.com",
                status: "pending",
                role: "member",
            },
        ],
    };
    const linked = source.managementReducer(state, {
        type: "link-account",
        accountId: "account",
        personId: "person",
    });
    assert.equal(linked.members[0].email, "member@example.com");
});

test("managed account routes normalize Expo's runtime parameter shapes", () => {
    assert.equal(routeParams.normalizeAccountId(" account-id "), "account-id");
    assert.equal(
        routeParams.normalizeAccountId(["account-id", "ignored"]),
        "account-id",
    );
    assert.equal(routeParams.normalizeAccountId([]), null);
    assert.equal(routeParams.normalizeAccountId(undefined), null);
    assert.equal(
        routeParams.accountIdFromPathname("/manage/account/account-id"),
        "account-id",
    );
    assert.equal(
        routeParams.accountIdFromPathname("/manage/account/account%20id"),
        "account id",
    );
    assert.equal(routeParams.accountIdFromPathname("/manage/account"), null);
    assert.equal(
        routeParams.resolveAccountId(
            " preferred-id ",
            "/manage/account/stale-id",
        ),
        "preferred-id",
    );
    assert.equal(
        routeParams.resolveAccountId(undefined, "/manage/account/account%20id"),
        "account id",
    );
    assert.equal(
        routeParams.resolveAccountId(undefined, "/manage/account"),
        null,
    );
    assert.equal(
        routeParams.managedAccountHref(" account-id "),
        "/manage/account/account-id",
    );
    assert.deepEqual(routeParams.managedAccountRoute(" account/id "), {
        pathname: "/manage/account/[accountId]",
        params: { accountId: "account/id" },
    });
});

test("managed account detail uses the durable route id", async () => {
    const screen = await readFile(
        new URL(
            "../src/features/manage/AccountDetailScreen.tsx",
            import.meta.url,
        ),
        "utf8",
    );
    assert.match(screen, /resolveAccountId\(params\.accountId, pathname\)/);
    assert.doesNotMatch(screen, /getManagedAccountSelection|selectedAccountId/);
});

test("managed account failures provide a route back to the account list", async () => {
    const screen = await readFile(
        new URL(
            "../src/features/manage/AccountDetailScreen.tsx",
            import.meta.url,
        ),
        "utf8",
    );
    assert.match(screen, /kind: "invalid" \| "missing" \| "load"/);
    assert.match(screen, /router\.replace\("\/manage"\)/);
    assert.match(screen, /This account link is invalid/);
    assert.match(screen, /This account is no longer available/);
});

test("dynamic account routes render their Expo management screens", async () => {
    const route = await readFile(
        new URL("../src/app/manage/account/[accountId].tsx", import.meta.url),
        "utf8",
    );
    const linkRoute = await readFile(
        new URL(
            "../src/app/manage/account/[accountId]/link.tsx",
            import.meta.url,
        ),
        "utf8",
    );
    assert.match(route, /<AccountDetailScreen/);
    assert.match(linkRoute, /<MemberLinkScreen/);
    assert.doesNotMatch(route + linkRoute, /<Redirect/);
});

test("manage navigation is only rendered for active editors and administrators", async () => {
    const [layout, webTabs] = await Promise.all([
        readFile(new URL("../src/app/_layout.tsx", import.meta.url), "utf8"),
        readFile(
            new URL("../src/features/shell/WebTabBar.tsx", import.meta.url),
            "utf8",
        ),
    ]);
    assert.match(
        layout,
        /showManage[\s\S]*canManageDirectory\(session\.account\)/,
    );
    assert.match(layout, /showManage \? <NativeTabs\.Trigger name="manage">/);
    assert.match(
        webTabs,
        /tab\.labelKey !== "manage"[\s\S]*canManageDirectory\(session\.account\)/,
    );
});

test("the manage stack anchors restored account routes to its landing screen", async () => {
    const layout = await readFile(
        new URL("../src/app/manage/_layout.tsx", import.meta.url),
        "utf8",
    );
    assert.match(layout, /unstable_settings/);
    assert.match(layout, /anchor: "index"/);
    assert.match(layout, /<Stack.Screen name="index"[\s\S]*<Stack.Screen name="account\/\[accountId\]"/);
    assert.doesNotMatch(layout, /disablePopToTop/);
});

test("pending sign-ins are promoted into a newest-first approval queue", () => {
    const accounts = [
        {
            id: "active",
            name: "Active",
            email: "active@example.com",
            status: "active",
            role: "member",
            createdAt: "2026-09-17T10:00:00.000Z",
        },
        {
            id: "older",
            name: "Older",
            email: "older@example.com",
            status: "pending",
            role: "member",
            createdAt: "2026-09-16T10:00:00.000Z",
        },
        {
            id: "newer",
            name: "Newer",
            email: "newer@example.com",
            status: "pending",
            role: "member",
            createdAt: "2026-09-17T10:00:00.000Z",
        },
    ];
    assert.deepEqual(
        source.pendingAccounts(accounts).map((account) => account.id),
        ["newer", "older"],
    );
    assert.equal(source.orderedAccounts(accounts)[0].status, "pending");
});

test("management keeps pending approvals visible and preserves actionable load failures", async () => {
    const [screen, repository, gate] = await Promise.all([
        readFile(
            new URL("../src/features/manage/ManageScreen.tsx", import.meta.url),
            "utf8",
        ),
        readFile(
            new URL(
                "../src/features/manage/management-repository.ts",
                import.meta.url,
            ),
            "utf8",
        ),
        readFile(
            new URL("../src/features/session/AccessGate.tsx", import.meta.url),
            "utf8",
        ),
    ]);
    assert.match(screen, /pendingAccounts\(state\.accounts\)/);
    assert.match(screen, /Waiting for approval/);
    assert.match(screen, /setFailure\(errorMessage\(cause\)\)/);
    assert.match(screen, /router\.push\(managedAccountRoute\(accountId\)\)/);
    assert.match(
        repository,
        /privatePhotoSources[\s\S]*\.catch\(\(\) => new Map\(\)\)/,
    );
    assert.match(gate, /Opening your directory/);
    assert.match(gate, /styles\.loadingMark/);
    assert.doesNotMatch(gate, /checkingSecure|checkingApproval/);
    assert.match(gate, /Check again/);
});

test("managed navigation exposes the pending approval count badge", async () => {
    const [repository, hook, nativeLayout, webShell, webTabs, localization] =
        await Promise.all([
            readFile(
                new URL(
                    "../src/features/manage/management-repository.ts",
                    import.meta.url,
                ),
                "utf8",
            ),
            readFile(
                new URL(
                    "../src/features/manage/use-pending-account-count.ts",
                    import.meta.url,
                ),
                "utf8",
            ),
            readFile(new URL("../src/app/_layout.tsx", import.meta.url), "utf8"),
            readFile(
                new URL(
                    "../src/features/shell/WebAppShell.web.tsx",
                    import.meta.url,
                ),
                "utf8",
            ),
            readFile(
                new URL("../src/features/shell/WebTabBar.tsx", import.meta.url),
                "utf8",
            ),
            readFile(
                new URL(
                    "../src/features/localization/LocalizationProvider.tsx",
                    import.meta.url,
                ),
                "utf8",
            ),
        ]);
    assert.match(repository, /loadPendingAccountCount/);
    assert.match(repository, /status === "pending"/);
    assert.match(repository, /canManageAccounts\(activeAccount\(\)\)/);
    assert.match(hook, /usePendingAccountCount/);
    assert.match(hook, /subscribeAccountChanges/);
    assert.match(hook, /visibilitychange/);
    assert.match(nativeLayout, /Trigger\.Badge hidden=\{pendingAccountCount === 0\}/);
    assert.match(nativeLayout, /pendingAccountCount > 99 \? "99\+"/);
    assert.match(webShell, /item\.key === "manage" && pendingAccountCount > 0/);
    assert.match(webShell, /copy\.pendingAccounts/);
    assert.match(webTabs, /tab\.labelKey === "manage" && pendingAccountCount > 0/);
    assert.match(webTabs, /pendingAccountCount > 99 \? "99\+"/);
    assert.match(localization, /pendingAccounts: "Accounts awaiting approval"/);
    assert.match(localization, /pendingAccounts: "Облікові записи, що очікують схвалення"/);
});

test("directory creation stays management-only and personal deletion stays collapsed", async () => {
    const [directory, menu] = await Promise.all([
        readFile(
            new URL(
                "../src/features/directory/DirectoryScreen.tsx",
                import.meta.url,
            ),
            "utf8",
        ),
        readFile(new URL("../src/app/menu.tsx", import.meta.url), "utf8"),
    ]);
    assert.doesNotMatch(directory, /directory\.addMember|\/manage/);
    assert.match(menu, /advancedOpen \?/);
    assert.match(menu, /accessibilityState=\{\{ expanded: advancedOpen \}\}/);
});

test("directory rows put leadership in the desktop ministry column without duplicating it", async () => {
    const directory = await readFile(
        new URL(
            "../src/features/directory/DirectoryScreen.tsx",
            import.meta.url,
        ),
        "utf8",
    );
    assert.match(directory, /isLeadershipMinistryLabel/);
    assert.match(directory, /desktopMinistry/);
    assert.match(directory, /!desktop && item\.leadershipMinistry/);
    assert.match(
        directory,
        /normalized === "deacon" \|\| normalized === "диякон"/,
    );
});

test("member email is editable and account linking copies the account email", async () => {
    const [editor, repository] = await Promise.all([
        readFile(
            new URL(
                "../src/features/manage/MemberFormScreen.tsx",
                import.meta.url,
            ),
            "utf8",
        ),
        readFile(
            new URL(
                "../src/features/manage/management-repository.ts",
                import.meta.url,
            ),
            "utf8",
        ),
    ]);
    assert.match(editor, /setEmail\(found\.email \?\? ""\)/);
    assert.match(editor, /keyboardType="email-address"/);
    assert.match(editor, /email: email\.trim\(\) \|\| null/);
    assert.match(repository, /email: row\.email/);
    assert.match(repository, /current\.email !== snapshot\.email/);
    assert.match(
        repository,
        /\{[\s\S]*?name: current\.name,[\s\S]*?email: snapshot\.email[\s\S]*?\}/,
    );
});

test("menu identifies the linked member and treats sign out as destructive", async () => {
    const menu = await readFile(
        new URL("../src/app/menu.tsx", import.meta.url),
        "utf8",
    );
    assert.match(
        menu,
        /memberProfileRepository\.getProfile\(session\.account\.personId, "avatar"\)/,
    );
    assert.match(menu, /<ProfileAvatar/);
    assert.match(menu, /color: palette\.danger/);
    assert.match(
        menu,
        /accessibilityState=\{\{ busy: signingOut, disabled: signingOut \}\}/,
    );
});

test("member deletion is an administrator-only confirmed management flow", async () => {
    const [editor, screen, route, layout, client] = await Promise.all([
        readFile(
            new URL(
                "../src/features/manage/MemberFormScreen.tsx",
                import.meta.url,
            ),
            "utf8",
        ),
        readFile(
            new URL(
                "../src/features/manage/MemberDeletionScreen.tsx",
                import.meta.url,
            ),
            "utf8",
        ),
        readFile(
            new URL(
                "../src/app/manage/member/[memberId]/delete.tsx",
                import.meta.url,
            ),
            "utf8",
        ),
        readFile(
            new URL("../src/app/manage/_layout.tsx", import.meta.url),
            "utf8",
        ),
        readFile(
            new URL(
                "../src/features/manage/member-deletion.ts",
                import.meta.url,
            ),
            "utf8",
        ),
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
    const edge = await readFile(
        new URL(
            "../supabase/functions/delete-member/index.ts",
            import.meta.url,
        ),
        "utf8",
    );
    const authDelete = edge.indexOf("auth.admin.deleteUser");
    const recordDelete = edge.indexOf('rpc("delete_member_record"');
    assert.ok(authDelete > -1 && recordDelete > authDelete);
    assert.match(
        edge,
        /caller\.status !== "active" \|\| caller\.role !== "admin"/,
    );
    assert.match(edge, /linkedAccount\?\.id === caller\.id/);
    assert.match(edge, /person\.revision !== expectedRevision/);
    assert.match(edge, /storage\.from\("member-photos"\)\.remove/);
});

test("account deletion preserves structured edge function failures", async () => {
    const [client, edge] = await Promise.all([
        readFile(
            new URL(
                "../src/features/account/account-deletion.ts",
                import.meta.url,
            ),
            "utf8",
        ),
        readFile(
            new URL(
                "../supabase/functions/delete-account/index.ts",
                import.meta.url,
            ),
            "utf8",
        ),
    ]);
    assert.match(client, /functions\.invoke\("delete-account"/);
    assert.match(client, /await context\.json\(\)\.catch/);
    assert.match(client, /new AccountDeletionError\(payload\?\.code/);
    assert.match(client, /data\?\.status !== "completed"/);
    assert.match(edge, /if \(callerProfileError\) throw callerProfileError/);
    assert.match(edge, /if \(targetProfileError\) throw targetProfileError/);
    assert.match(edge, /if \(countError\) throw countError/);
    assert.match(edge, /\.catch\(\(\) => false\)/);
});
