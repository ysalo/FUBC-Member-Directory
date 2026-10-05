import { normalizeMemberSearch, searchMembers } from "@/lib/member-search";
import { directorySurname, compareDirectoryNames } from "./directory-order";
import { Text, TextInput } from "@/features/accessibility/app-text";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Link, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useWarmResource } from "@/lib/use-warm-resource";
import { ResourceRefresh } from "@/features/shell/ResourceRefresh";
import {
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    SectionList,
    StyleSheet,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { WebTabBar } from "@/features/shell/WebTabBar";
import { useDesktopLayout } from "@/features/shell/use-desktop-layout";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { CareStatusBadges } from "@/features/members/care-status-badges";
import { LeadershipBadge } from "@/features/members/leadership-badge";
import { ProfileAvatar } from "@/features/members/ProfileAvatar";
import { formatPhoneNumber } from "@/lib/phone";
import { formatMemberName } from "@/lib/member-name";

import { listDirectory } from "./directory-repository";
import type { Member } from "./members";

async function loadDirectoryData(fresh: boolean) {
    return { members: await listDirectory({ fresh }) };
}

export function MemberRow({
    compact = false,
    item,
    locale,
    ministry,
    onPress,
    detail,
    fullName = false,
    selection,
}: {
    compact?: boolean;
    item: Member;
    locale: "en" | "uk";
    ministry: string;
    onPress: () => void;
    detail?: string;
    fullName?: boolean;
    selection?: { checked: boolean; label: string; disabled?: boolean; mode?: "remove" | "checkbox" | "radio" };
}) {
    const { palette } = useAppearance();
    const desktop = useDesktopLayout() && !compact;
    const showsMinistry =
        Boolean(ministry) &&
        !isLeadershipMinistryLabel(ministry, item.leadershipMinistry);
    const leadershipLabel =
        item.leadershipMinistry === "pastor"
            ? locale === "uk"
                ? "Пастор"
                : "Pastor"
            : item.leadershipMinistry === "deacon"
              ? locale === "uk"
                  ? "Диякон"
                  : "Deacon"
              : "";
    const desktopMinistry = [leadershipLabel, showsMinistry ? ministry : ""]
        .filter(Boolean)
        .join(" · ");
    const row = (
        <Pressable
            aria-checked={selection && selection.mode !== "remove" ? selection.checked : undefined}
            aria-disabled={selection?.disabled}
            accessibilityLabel={selection?.label}
            accessibilityState={selection ? { checked: selection.mode === "remove" ? undefined : selection.checked, disabled: selection.disabled } : undefined}
            disabled={selection?.disabled}
            accessibilityHint={selection ? undefined :
                locale === "uk"
                    ? `Відкрити профіль: ${item.name}`
                    : `Opens ${item.name}’s member profile`
            }
            accessibilityRole={selection ? selection.mode === "remove" ? "button" : selection.mode ?? "checkbox" : Platform.OS === "web" ? "link" : "button"}
            onPress={selection || Platform.OS !== "web" ? onPress : undefined}
            style={
                Platform.OS === "web"
                    ? StyleSheet.flatten([
                          styles.memberRow,
                          desktop && styles.desktopMemberRow,
                          {
                              backgroundColor: selection?.checked && selection.mode !== "remove" ? palette.accentSoft : palette.surface,
                              borderBottomColor: palette.line,
                          },
                      ])
                    : ({ pressed }) => [
                          styles.memberRow,
                          {
                              backgroundColor: selection?.checked && selection.mode !== "remove" ? palette.accentSoft : palette.surface,
                              borderBottomColor: palette.line,
                          },
                          pressed && styles.pressed,
                      ]
            }
        >
            <ProfileAvatar
                name={item.name}
                size={desktop ? 56 : 72}
                source={item.avatar}
            />
            <View
                style={[styles.memberCopy, desktop && styles.desktopMemberCopy]}
            >
                <Text
                    numberOfLines={fullName ? 2 : 1}
                    style={[styles.memberName, { color: palette.text }]}
                >
                    {formatMemberName(item, undefined, !fullName)}
                </Text>
                {detail && <Text style={[styles.memberPhone, { color: palette.secondaryText }]}>{detail}</Text>}
                {!desktop && showsMinistry ? (
                    <Text
                        numberOfLines={1}
                        style={[
                            styles.memberMinistry,
                            { color: palette.secondaryText },
                        ]}
                    >
                        {ministry}
                    </Text>
                ) : null}
                {!desktop && item.phone ? (
                    <Text
                        numberOfLines={1}
                        selectable={!selection}
                        style={[
                            styles.memberPhone,
                            { color: palette.secondaryText },
                        ]}
                    >
                        {formatPhoneNumber(item.phone)}
                    </Text>
                ) : null}
                {!desktop && item.leadershipMinistry ? (
                    <LeadershipBadge
                        leadershipMinistry={item.leadershipMinistry}
                        locale={locale}
                    />
                ) : null}
                <CareStatusBadges
                    isOrphan={item.isOrphan}
                    isWidow={item.isWidow}
                />
            </View>
            {desktop ? (
                <>
                    <Text
                        style={[
                            styles.desktopMinistry,
                            { color: palette.secondaryText },
                        ]}
                    >
                        {desktopMinistry || "—"}
                    </Text>
                    <Text
                        style={[
                            styles.desktopPhone,
                            { color: palette.secondaryText },
                        ]}
                    >
                        {item.phone ? formatPhoneNumber(item.phone) : "—"}
                    </Text>
                </>
            ) : null}
            {selection ? <Ionicons
                accessibilityElementsHidden
                color={selection?.checked && selection.mode !== "remove" ? palette.accent : palette.secondaryText}
                name={selection.mode === "remove" ? "close-circle-outline" : selection.checked ? "checkmark-circle" : "ellipse-outline"}
                size={px(22)}
            /> : null}
        </Pressable>
    );
    return Platform.OS === "web" && !selection ? (
        <Link href={`/members/${item.id}`} asChild>
            {row}
        </Link>
    ) : (
        row
    );
}

function isLeadershipMinistryLabel(
    ministry: string,
    leadershipMinistry: Member["leadershipMinistry"],
) {
    const normalized = ministry.trim().toLocaleLowerCase();
    return leadershipMinistry === "deacon"
        ? normalized === "deacon" || normalized === "диякон"
        : leadershipMinistry === "pastor" &&
              (normalized === "pastor" || normalized === "пастор");
}

function DirectorySkeleton({ label }: { label: string }) {
    const { palette } = useAppearance();
    const desktop = useDesktopLayout();
    const fill = { backgroundColor: palette.line, color: "transparent" };
    return (
        <View accessibilityLabel={label} accessibilityRole="progressbar" accessibilityState={{ busy: true }} aria-busy>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
                <Text style={styles.sectionLetter}>
                    <Text style={fill}>{"\u00a0\u00a0"}</Text>
                </Text>
                {Array.from({ length: 8 }, (_, index) => (
                    <View key={index} style={[styles.memberRow, desktop && styles.desktopMemberRow, { backgroundColor: palette.surface, borderBottomColor: palette.line }]}>
                        <View style={[fill, { width: desktop ? 56 : 72, height: desktop ? 56 : 72, borderRadius: desktop ? 28 : 36 }]} />
                        <View style={[styles.memberCopy, desktop && styles.desktopMemberCopy]}>
                            <Text numberOfLines={1} style={[styles.memberName, styles.skeletonText, fill, { width: "70%" }]}>{"\u00a0"}</Text>
                            {!desktop && <Text numberOfLines={1} style={[styles.memberMinistry, styles.skeletonText, fill, { width: "45%" }]}>{"\u00a0"}</Text>}
                            {!desktop && <Text numberOfLines={1} style={[styles.memberPhone, styles.skeletonText, fill, { width: "55%" }]}>{"\u00a0"}</Text>}
                        </View>
                        {desktop && <>
                            <View style={styles.desktopMinistry}><Text style={[styles.desktopMinistry, styles.skeletonText, fill, { flex: 0, width: "60%" }]}>{"\u00a0"}</Text></View>
                            <View style={styles.desktopPhone}><Text style={[styles.desktopPhone, styles.skeletonText, fill, { width: "80%" }]}>{"\u00a0"}</Text></View>
                        </>}
                        <View style={{ width: px(22), height: px(22) }} />
                    </View>
                ))}
            </View>
        </View>
    );
}

export function DirectoryScreen() {
    const desktop = useDesktopLayout();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { copy, locale } = useLocalization();
    const { palette } = useAppearance();
    const webListRef = useRef<ScrollView>(null);
    const nativeListRef = useRef<SectionList<Member>>(null);
    const sectionOffsets = useRef<Record<string, number>>({});
    const pendingSection = useRef<number | null>(null);
    const alphabetRef = useRef<View>(null);
    const alphabetBounds = useRef({ top: 0, height: 1 });
    const scrubbedSection = useRef<number | null>(null);
    const scrubPosition = useRef<number | null>(null);
    const jumpRetry = useRef<ReturnType<typeof setTimeout> | null>(null);
    const jumpAttempts = useRef(0);
    const [query, setQuery] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const resource = useWarmResource("directory", loadDirectoryData);
    const directoryMembers = resource.data?.members ?? [];
    const loadState = resource.status;
    const loadDirectory = resource.refresh;
    type DirectoryFilter = "orphan" | "widow" | "deacon" | "pastor" | "ungrouped" | "male" | "female";
    const [filters, setFilters] = useState<DirectoryFilter[]>([]);
    const [filterOpen, setFilterOpen] = useState(false);
    const [listHeight, setListHeight] = useState(0);

    useEffect(() => {
        if (!query) {
            setSearchQuery("");
            return;
        }
        const timeout = setTimeout(() => setSearchQuery(query), 150);
        return () => clearTimeout(timeout);
    }, [query]);


    const sortedDirectory = useMemo(() => {
        return directoryMembers
            .map((member) => ({
                member,
                surname: directorySurname(member),
            }))
            .sort(compareDirectoryNames);
    }, [directoryMembers]);

    const filteredDirectory = useMemo(() => {
        const needle = searchQuery.trim().toLocaleLowerCase();
        const candidates = sortedDirectory.filter(({ member }) =>
            (filters.length === 0 ||
                filters.some((filter) =>
                    filter === "orphan"
                        ? member.isOrphan
                        : filter === "widow"
                          ? member.isWidow
                          : filter === "male" || filter === "female"
                            ? member.gender === filter
                          : filter === "ungrouped"
                            ? !member.membershipGroupId
                            : member.leadershipMinistry === filter,
                )),
        );
        return searchMembers(candidates, needle, ({ member, surname }) => ({ ...member, last_name: surname }));
    }, [filters, searchQuery, sortedDirectory]);

    const sections = useMemo(() => {
        if (normalizeMemberSearch(searchQuery)) return filteredDirectory.length ? [{ title: locale === "uk" ? "Результати пошуку" : "Search results", data: filteredDirectory.map(item => item.member) }] : [];
        return filteredDirectory.reduce<Array<{ title: string; data: Member[] }>>(
            (groups, member) => {
                const title =
                    member.surname.charAt(0).toLocaleUpperCase(locale) ||
                    "#";
                const existing = groups.at(-1);
                if (existing?.title === title) existing.data.push(member.member);
                else groups.push({ title, data: [member.member] });
                return groups;
            },
            [],
        );
    }, [filteredDirectory, locale, searchQuery]);

    useEffect(() => () => {
        if (jumpRetry.current) clearTimeout(jumpRetry.current);
        pendingSection.current = null;
    }, [sections]);
    const jumpToSection = (index: number, animated = true) => {
        if (jumpRetry.current) clearTimeout(jumpRetry.current);
        jumpAttempts.current = 0;
        if (Platform.OS === "web") webListRef.current?.scrollTo({ y: sectionOffsets.current[sections[index].title] ?? 0, animated });
        else {
            pendingSection.current = index;
            nativeListRef.current?.scrollToLocation({ sectionIndex: index, itemIndex: 0, viewPosition: 0, animated });
        }
    };
    const scrubTo = (pageY: number) => {
        const { top, height } = alphabetBounds.current;
        const index = Math.max(0, Math.min(sections.length - 1, Math.floor((pageY - top) / height * sections.length)));
        if (scrubbedSection.current !== index) {
            scrubbedSection.current = index;
            jumpToSection(index, false);
        }
    };
    const alphabetIndex = sections.length > 1 ? (
        <View pointerEvents="box-none" style={styles.alphabetOverlay}>
            <View
                ref={alphabetRef}
                testID="directory-alphabet-index"
                accessibilityLabel={locale === "uk" ? "Покажчик прізвищ" : "Last name index"}
                style={[styles.alphabetIndex, { height: Math.min(sections.length * 13, listHeight * 0.9) }]}
                onStartShouldSetResponderCapture={() => true}
                onMoveShouldSetResponderCapture={() => true}
                onResponderGrant={(event) => {
                    scrubPosition.current = event.nativeEvent.pageY;
                    scrubbedSection.current = null;
                    alphabetRef.current?.measureInWindow((_x, top, _width, height) => {
                        alphabetBounds.current = { top, height: Math.max(1, height) };
                        if (scrubPosition.current !== null) scrubTo(scrubPosition.current);
                    });
                }}
                onResponderMove={(event) => { scrubPosition.current = event.nativeEvent.pageY; scrubTo(scrubPosition.current); }}
                onResponderTerminationRequest={() => false}
                onResponderRelease={() => { scrubbedSection.current = null; }}
                onResponderTerminate={() => { scrubbedSection.current = null; scrubPosition.current = null; }}
            >
                {sections.map((section, index) => <Pressable key={section.title} accessibilityRole="button" accessibilityLabel={`${locale === "uk" ? "До прізвищ на" : "Jump to last names starting with"} ${section.title}`} onPress={() => jumpToSection(index, false)} style={styles.alphabetButton}><Text style={{ color: palette.accent, fontSize: 10, lineHeight: 12, fontWeight: "700" }}>{section.title}</Text></Pressable>)}
            </View>
        </View>
    ) : null;

    const filterOptions: Array<{ id: DirectoryFilter; label: string }> = [
        { id: "orphan", label: locale === "uk" ? "Сироти" : "Orphans" },
        {
            id: "widow",
            label: locale === "uk" ? "Вдови та вдівці" : "Widows & widowers",
        },
        { id: "deacon", label: locale === "uk" ? "Диякони" : "Deacons" },
        { id: "pastor", label: locale === "uk" ? "Пастори" : "Pastors" },
        { id: "ungrouped", label: locale === "uk" ? "Без групи" : "No group" },
        { id: "male", label: locale === "uk" ? "Чоловіки" : "Male" },
        { id: "female", label: locale === "uk" ? "Жінки" : "Female" },
    ];
    const toggleFilter = (filter: DirectoryFilter) =>
        setFilters((current) =>
            current.includes(filter)
                ? current.filter((value) => value !== filter)
                : [...current, filter],
        );

    const summary = (
        <View>
            <View
                accessibilityLabel="Directory totals"
                style={[
                    styles.summaryFooter,
                    {
                        backgroundColor: palette.surface,
                        borderTopColor: palette.line,
                    },
                ]}
            >
                <Text
                    style={[styles.summaryFooterText, { color: palette.text }]}
                >
                    {locale === "uk" ? "Усього" : "Total members"}:{" "}
                    {directoryMembers.length}
                </Text>
                <Text
                    style={[
                        styles.summaryFooterText,
                        { color: palette.secondaryText },
                    ]}
                >
                    {locale === "uk" ? "Сироти" : "Orphans"}:{" "}
                    {
                        directoryMembers.filter((member) => member.isOrphan)
                            .length
                    }
                </Text>
                <Text
                    style={[
                        styles.summaryFooterText,
                        { color: palette.secondaryText },
                    ]}
                >
                    {locale === "uk" ? "Вдови" : "Widows"}:{" "}
                    {directoryMembers.filter((member) => member.isWidow).length}
                </Text>
            </View>
        </View>
    );

    const stickyOverview = (
        <View
            style={[
                styles.stickyOverview,
                {
                    backgroundColor: palette.background,
                    borderBottomColor: palette.line,
                    paddingTop: Platform.OS === "web" ? 0 : insets.top,
                },
            ]}
        >
            <View style={styles.titleRow}>
                <Text
                    accessibilityRole="header"
                    selectable
                    style={[styles.title, { color: palette.text }]}
                >
                    {copy.directory.title}
                </Text>
            </View>
            <View
                style={[
                    styles.searchField,
                    { backgroundColor: palette.subtle },
                ]}
            >
                <Ionicons
                    accessibilityElementsHidden
                    color={palette.secondaryText}
                    name="search-outline"
                    size={px(21)}
                    style={styles.searchIcon}
                />
                <TextInput
                    accessibilityLabel={copy.directory.searchLabel}
                    autoCapitalize="none"
                    clearButtonMode="while-editing"
                    onChangeText={(nextQuery) => {
                        setQuery(nextQuery);
                        if (!nextQuery) setSearchQuery("");
                    }}
                    placeholder={copy.directory.search}
                    placeholderTextColor={palette.secondaryText}
                    returnKeyType="search"
                    style={[styles.searchInput, { color: palette.text }]}
                    value={query}
                />
                <Pressable
                    accessibilityLabel={locale === "uk" ? "Фільтри" : "Filters"}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: filterOpen }}
                    onPress={() => setFilterOpen((open) => !open)}
                    style={styles.filterButton}
                >
                    <Ionicons
                        accessibilityElementsHidden
                        color={
                            filters.length === 0
                                ? palette.secondaryText
                                : palette.accent
                        }
                        name="options-outline"
                        size={px(21)}
                    />
                    {filters.length ? (
                        <View
                            style={[
                                styles.filterCount,
                                { backgroundColor: palette.accent },
                            ]}
                        >
                            <Text style={styles.filterCountText}>
                                {filters.length}
                            </Text>
                        </View>
                    ) : null}
                </Pressable>
            </View>
            {resource.data && (filters.length > 0 || searchQuery.trim()) ? (
                <Text style={[styles.matchCount, { color: palette.secondaryText }]}>
                    {locale === "uk"
                        ? `Показано ${filteredDirectory.length} із ${directoryMembers.length} учасників`
                        : `Showing ${filteredDirectory.length} of ${directoryMembers.length} members`}
                </Text>
            ) : null}
            {filterOpen ? (
                <View
                    accessibilityViewIsModal
                    style={[
                        styles.filterPopover,
                        {
                            backgroundColor: palette.elevated,
                            borderColor: palette.line,
                        },
                    ]}
                >
                    <View style={styles.filterPopoverHeader}>
                        <Text
                            accessibilityRole="header"
                            style={[
                                styles.filterPopoverTitle,
                                { color: palette.text },
                            ]}
                        >
                            {locale === "uk" ? "Фільтри" : "Filters"}
                        </Text>
                        {filters.length ? (
                            <Pressable
                                accessibilityRole="button"
                                onPress={() => setFilters([])}
                                style={styles.clearButton}
                            >
                                <Text
                                    style={[
                                        styles.clearText,
                                        { color: palette.accent },
                                    ]}
                                >
                                    {locale === "uk" ? "Очистити" : "Clear"}
                                </Text>
                            </Pressable>
                        ) : null}
                    </View>
                    {filterOptions.map((option) => {
                        const selected = filters.includes(option.id);
                        return (
                            <Pressable
                                accessibilityLabel={option.label}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: selected }}
                                aria-checked={selected}
                                key={option.id}
                                onPress={() => toggleFilter(option.id)}
                                style={styles.filterOption}
                            >
                                <View
                                    style={[
                                        styles.checkbox,
                                        {
                                            backgroundColor: selected
                                                ? palette.accent
                                                : "transparent",
                                            borderColor: selected
                                                ? palette.accent
                                                : palette.line,
                                        },
                                    ]}
                                >
                                    {selected ? (
                                        <Ionicons
                                            accessibilityElementsHidden
                                            color="#FFF"
                                            name="checkmark"
                                            size={15}
                                        />
                                    ) : null}
                                </View>
                                <Text
                                    style={[
                                        styles.filterOptionText,
                                        { color: palette.text },
                                    ]}
                                >
                                    {option.label}
                                </Text>
                            </Pressable>
                        );
                    })}
                    <Pressable
                        accessibilityRole="button"
                        onPress={() => setFilterOpen(false)}
                        style={[
                            styles.doneButton,
                            { backgroundColor: palette.accent },
                        ]}
                    >
                        <Text style={styles.doneText}>
                            {locale === "uk" ? "Готово" : "Done"}
                        </Text>
                    </Pressable>
                </View>
            ) : null}
        </View>
    );

    const empty =
        loadState === "loading" ? (
            <DirectorySkeleton label={locale === "uk" ? "Завантаження довідника…" : "Loading directory…"} />
        ) : loadState === "error" ? (
            <View style={styles.empty}>
                <Text style={[styles.emptyTitle, { color: palette.text }]}>
                    {locale === "uk"
                        ? "Не вдалося завантажити довідник"
                        : "Unable to load the directory"}
                </Text>
                <Pressable
                    accessibilityRole="button"
                    onPress={loadDirectory}
                    style={[styles.retry, { backgroundColor: palette.accent }]}
                >
                    <Text style={styles.retryText}>
                        {locale === "uk" ? "Спробувати ще раз" : "Try again"}
                    </Text>
                </Pressable>
            </View>
        ) : (
            <View style={styles.empty}>
                <Text style={[styles.emptyTitle, { color: palette.text }]}>
                    {copy.directory.emptyTitle}
                </Text>
                <Text
                    style={[
                        styles.emptyDetail,
                        { color: palette.secondaryText },
                    ]}
                >
                    {copy.directory.emptyDetail}
                </Text>
            </View>
        );

    if (Platform.OS === "web") {
        return (
            <View
                style={[
                    styles.safe,
                    desktop && styles.desktopScreen,
                    { backgroundColor: palette.background },
                ]}
            >
                {stickyOverview}
                {desktop && (
                    <View
                        style={[
                            styles.desktopColumnHeaders,
                            { borderBottomColor: palette.line },
                        ]}
                    >
                        <Text
                            style={[
                                styles.desktopNameHeader,
                                { color: palette.secondaryText },
                            ]}
                        >
                            {locale === "uk" ? "Учасник" : "Member"}
                        </Text>
                        <Text
                            style={[
                                styles.desktopMinistry,
                                { color: palette.secondaryText },
                            ]}
                        >
                            {locale === "uk" ? "Служіння" : "Ministry"}
                        </Text>
                        <Text
                            style={[
                                styles.desktopPhone,
                                { color: palette.secondaryText },
                            ]}
                        >
                            {locale === "uk" ? "Телефон" : "Phone"}
                        </Text>
                        <View style={{ width: 22 }} />
                    </View>
                )}
                <ResourceRefresh error={resource.error && loadState === "ready"} refreshing={resource.refreshing} onRefresh={loadDirectory} />
                <View onLayout={(event) => setListHeight(event.nativeEvent.layout.height)} style={{ flex: 1, position: "relative" }}>
                <ScrollView
                    ref={webListRef}
                    testID="directory-scroll"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={[styles.webContent, { paddingRight: sections.length > 1 ? 24 : 0 }]}
                    keyboardShouldPersistTaps="handled"
                    style={styles.rosterScroll}
                >
                    {sections.length === 0
                        ? empty
                        : sections.map((section) => (
                              <View key={section.title} onLayout={(event) => { sectionOffsets.current[section.title] = event.nativeEvent.layout.y; }}>
                                  <Text
                                      style={[
                                          styles.sectionLetter,
                                          { color: palette.secondaryText },
                                      ]}
                                  >
                                      {section.title}
                                  </Text>
                                  {section.data.map((item) => (
                                      <MemberRow
                                          item={item}
                                          key={item.id}
                                          locale={locale}
                                          ministry={
                                              locale === "uk"
                                                  ? item.ministryUk
                                                  : item.ministry
                                          }
                                          onPress={() =>
                                              router.push(
                                                  `/members/${item.id}` as never,
                                              )
                                          }
                                      />
                                  ))}
                              </View>
                          ))}
                    {summary}
                </ScrollView>
                {alphabetIndex}
                </View>
                <WebTabBar />
            </View>
        );
    }

    return (
        <View style={[styles.safe, { backgroundColor: palette.background }]}>
            {stickyOverview}
            <ResourceRefresh error={resource.error && loadState === "ready"} refreshing={resource.refreshing} onRefresh={loadDirectory} />
            <View onLayout={(event) => setListHeight(event.nativeEvent.layout.height)} style={{ flex: 1, position: "relative" }}>
            <SectionList
                ref={nativeListRef}
                showsVerticalScrollIndicator={false}
                onScrollToIndexFailed={({ averageItemLength, index }) => {
                    if (++jumpAttempts.current > 8) return;
                    nativeListRef.current?.getScrollResponder()?.scrollTo({ y: averageItemLength * index, animated: false });
                    jumpRetry.current = setTimeout(() => {
                        const sectionIndex = pendingSection.current;
                        if (sectionIndex !== null && sections[sectionIndex]) nativeListRef.current?.scrollToLocation({ sectionIndex, itemIndex: 0, animated: true });
                    }, 150);
                }}
                refreshControl={<RefreshControl refreshing={resource.refreshing} onRefresh={loadDirectory} />}
                contentContainerStyle={[styles.content, { paddingRight: sections.length > 1 ? 24 : 0 }]}
                keyboardDismissMode="on-drag"
                keyboardShouldPersistTaps="handled"
                initialNumToRender={12}
                ListEmptyComponent={empty}
                renderItem={({ item }) => (
                    <MemberRow
                        item={item}
                        locale={locale}
                        ministry={
                            locale === "uk" ? item.ministryUk : item.ministry
                        }
                        onPress={() =>
                            router.push(`/members/${item.id}` as never)
                        }
                    />
                )}
                renderSectionHeader={({ section }) => (
                    <Text
                        style={[
                            styles.sectionLetter,
                            { color: palette.secondaryText },
                        ]}
                    >
                        {section.title}
                    </Text>
                )}
                removeClippedSubviews={false}
                sections={sections}
                ListFooterComponent={summary}
                stickySectionHeadersEnabled={false}
                windowSize={15}
            />
            {alphabetIndex}
            </View>
            <WebTabBar />
        </View>
    );
}

const scale = 1;
const px = (value: number) => value * scale;

const styles = StyleSheet.create({
    alphabetOverlay: { position: "absolute", right: 2, top: 0, bottom: 0, justifyContent: "center", alignItems: "center", width: 20 },
    alphabetIndex: { width: 20, alignItems: "center" },
    alphabetButton: { flex: 1, width: 20, alignItems: "center", justifyContent: "center" },
    skeletonText: { alignSelf: "flex-start", borderRadius: 4 },
    desktopScreen: {
        alignSelf: "center",
        maxWidth: 1200,
        width: "100%",
        paddingHorizontal: 20,
    },
    desktopMemberRow: { gap: 16, minHeight: 84, paddingVertical: 12 },
    desktopMemberCopy: { marginLeft: 0, minWidth: 0, flex: 1.3 },
    desktopMinistry: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 21 },
    desktopPhone: { width: 156, fontSize: 14, lineHeight: 20 },
    desktopColumnHeaders: {
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    desktopNameHeader: {
        flex: 1.3,
        marginLeft: 72,
        fontSize: 14,
        fontWeight: "600",
    },
    webContent: { paddingBottom: 28 },
    safe: { backgroundColor: "#F1F0EB", flex: 1 },
    rosterScroll: { flex: 1 },
    content: { paddingBottom: px(102) },
    stickyOverview: {
        backgroundColor: "#F1F0EB",
        borderBottomColor: "#D8D5CE",
        borderBottomWidth: StyleSheet.hairlineWidth,
        paddingBottom: px(10),
        shadowColor: "#17191C",
        shadowOffset: { height: px(2), width: 0 },
        shadowOpacity: Platform.OS === "ios" ? 0.08 : 0,
        shadowRadius: px(5),
        zIndex: 5,
    },
    titleRow: { paddingHorizontal: px(20), paddingTop: px(22) },
    title: {
        color: "#292D31",
        fontSize: px(30),
        fontWeight: "800",
        letterSpacing: px(-1.7),
        lineHeight: px(38),
    },
    pressed: { opacity: 0.68, transform: [{ scale: 0.985 }] },
    matchCount: { fontSize: px(14), marginHorizontal: px(20), marginTop: px(9) },
    searchField: {
        alignItems: "center",
        borderRadius: px(14),
        flexDirection: "row",
        marginHorizontal: px(20),
        marginTop: px(12),
        minHeight: px(44),
        paddingHorizontal: px(17),
    },
    searchIcon: { marginRight: px(13) },
    searchInput: {
        color: "#22262A",
        flex: 1,
        fontSize: px(14),
        paddingVertical: px(12),
    },
    filterButton: {
        alignItems: "center",
        justifyContent: "center",
        minHeight: px(40),
        minWidth: px(40),
        position: "relative",
    },
    filterCount: {
        alignItems: "center",
        borderRadius: px(8),
        height: px(16),
        justifyContent: "center",
        position: "absolute",
        right: px(-2),
        top: px(1),
        width: px(16),
    },
    filterCountText: { color: "#FFF", fontSize: px(10), fontWeight: "800" },
    filterPopover: {
        borderCurve: "continuous",
        borderRadius: px(16),
        borderWidth: StyleSheet.hairlineWidth,
        elevation: 8,
        marginTop: px(7),
        padding: px(12),
        position: "absolute",
        right: px(20),
        shadowColor: "#000",
        shadowOffset: { height: px(4), width: 0 },
        shadowOpacity: 0.18,
        shadowRadius: px(12),
        top: "100%",
        width: px(244),
        zIndex: 20,
    },
    filterPopoverHeader: {
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "space-between",
        minHeight: px(34),
        paddingHorizontal: px(4),
    },
    filterPopoverTitle: { fontSize: px(17), fontWeight: "800" },
    clearButton: {
        justifyContent: "center",
        minHeight: px(36),
        paddingLeft: px(12),
    },
    clearText: { fontSize: px(14), fontWeight: "700" },
    filterOption: {
        alignItems: "center",
        flexDirection: "row",
        gap: px(11),
        minHeight: px(44),
        paddingHorizontal: px(4),
    },
    checkbox: {
        alignItems: "center",
        borderRadius: px(6),
        borderWidth: 1.5,
        height: px(23),
        justifyContent: "center",
        width: px(23),
    },
    filterOptionText: { flex: 1, fontSize: px(15), fontWeight: "600" },
    doneButton: {
        alignItems: "center",
        borderRadius: px(11),
        justifyContent: "center",
        marginTop: px(7),
        minHeight: px(42),
    },
    doneText: { color: "#FFF", fontSize: px(15), fontWeight: "800" },
    sectionLetter: {
        color: "#4A4C4F",
        fontSize: px(17),
        fontWeight: "600",
        paddingBottom: px(5),
        paddingHorizontal: px(19),
        paddingTop: px(10),
    },
    memberRow: {
        alignItems: "center",
        borderBottomWidth: StyleSheet.hairlineWidth,
        flexDirection: "row",
        minHeight: px(74),
        paddingHorizontal: px(20),
        paddingVertical: px(1),
    },
    memberCopy: { flex: 1, marginLeft: px(5) },
    memberName: {
        color: "#090F19",
        fontSize: px(18),
        fontWeight: "600",
        letterSpacing: px(0.3),
    },
    memberMinistry: { color: "#737477", fontSize: px(16), marginTop: px(2) },
    memberPhone: { fontSize: px(14), marginTop: px(2) },
    summaryFooter: {
        borderTopWidth: StyleSheet.hairlineWidth,
        flexDirection: "row",
        gap: px(16),
        justifyContent: "center",
        marginTop: px(16),
        paddingHorizontal: px(12),
        paddingVertical: px(16),
    },
    summaryFooterText: { fontSize: px(13), fontWeight: "600" },
    empty: {
        alignItems: "center",
        paddingHorizontal: px(30),
        paddingTop: px(48),
    },
    emptyTitle: { color: "#20252A", fontSize: px(20), fontWeight: "700" },
    emptyDetail: {
        color: "#676A6E",
        fontSize: px(16),
        marginTop: px(8),
        textAlign: "center",
    },
    retry: {
        backgroundColor: "#EF5A24",
        borderRadius: px(11),
        marginTop: px(13),
        paddingHorizontal: px(16),
        paddingVertical: px(10),
    },
    retryText: { color: "#FFFFFF", fontSize: px(14), fontWeight: "700" },
});
