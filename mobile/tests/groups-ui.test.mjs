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
    assert.match(menu, /presentationStyle="pageSheet"/);
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

test("member profile presents its group as a labeled disclosure action", async () => {
    const source = await readFile(
        new URL(
            "../src/features/members/MemberProfileScreen.tsx",
            import.meta.url,
        ),
        "utf8",
    );
    assert.match(source, /accessibilityHint=\{copy\.openGroup\}/);
    assert.match(source, /<Fact\s+disclosure/);
    assert.match(source, /name="chevron-forward"/);
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
