import { useDesktopLayout } from "@/features/shell/use-desktop-layout";
import { Text, TextInput } from "@/features/accessibility/app-text";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    View,
} from "react-native";

import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { CareStatusBadges } from "@/features/members/care-status-badges";
import { ProfileAvatar } from "@/features/members/ProfileAvatar";
import { LeadershipBadge } from "@/features/members/leadership-badge";
import { useSession } from "@/features/session/SessionProvider";
import {
    birthdayNotificationsSupported,
    disableBirthdayNotifications,
    syncBirthdayNotifications,
} from "./birthday-notifications";
import { upcomingBirthdays } from "./birthday-notification-plan";
import { getGroupsCopy } from "./groups-copy";
import {
    groupsRepository,
    type AuthorizedBirthday,
    type GroupDetail,
    type GroupMember,
    type GroupSummary,
} from "./groups-repository";

type GroupMemberFilter = "orphan" | "widow" | "deacon" | "pastor";

export function GroupDetailScreen({ groupId }: { groupId: string }) {
    const router = useRouter();
    const desktop = useDesktopLayout();
    const { locale } = useLocalization();
    const copy = getGroupsCopy(locale);
    const session = useSession();
    const { palette } = useAppearance();
    const account = session.status === "ready" ? session.account : null;
    const [group, setGroup] = useState<GroupDetail | null | undefined>(
        undefined,
    );
    const [birthdays, setBirthdays] = useState<AuthorizedBirthday[]>([]);
    const [summary, setSummary] = useState<GroupSummary>({
        total: 0,
        orphans: 0,
        widows: 0,
    });
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [notificationBusy, setNotificationBusy] = useState(false);
    const [notificationError, setNotificationError] = useState<string | null>(
        null,
    );
    const [failed, setFailed] = useState(false);
    const [query, setQuery] = useState("");
    const [filters, setFilters] = useState<GroupMemberFilter[]>([]);
    const [filterOpen, setFilterOpen] = useState(false);
    const [birthdaysExpanded, setBirthdaysExpanded] = useState(true);

    const assignedDeacon = Boolean(
        group &&
        account?.leadershipMinistry === "deacon" &&
        group.responsibleDeaconIds.includes(account.id),
    );
    const upcoming = useMemo(() => upcomingBirthdays(birthdays), [birthdays]);
    const filteredMembers = useMemo(() => {
        const needle = query.trim().toLocaleLowerCase(locale);
        return (group?.members ?? [])
            .filter(
                (member) =>
                    filters.length === 0 ||
                    filters.some((filter) =>
                        filter === "orphan"
                            ? member.isOrphan
                            : filter === "widow"
                              ? member.isWidow
                              : member.leadershipMinistry === filter,
                    ),
            )
            .filter(
                (member) =>
                    !needle ||
                    member.name.toLocaleLowerCase(locale).includes(needle),
            );
    }, [filters, group, locale, query]);
    const filterOptions: Array<{ id: GroupMemberFilter; label: string }> = [
        { id: "orphan", label: locale === "uk" ? "Сироти" : "Orphans" },
        {
            id: "widow",
            label: locale === "uk" ? "Вдови та вдівці" : "Widows & widowers",
        },
        { id: "deacon", label: locale === "uk" ? "Диякони" : "Deacons" },
        { id: "pastor", label: locale === "uk" ? "Пастори" : "Pastors" },
    ];
    const toggleFilter = (filter: GroupMemberFilter) =>
        setFilters((current) =>
            current.includes(filter)
                ? current.filter((value) => value !== filter)
                : [...current, filter],
        );

    const load = () => {
        setGroup(undefined);
        setFailed(false);
        setNotificationError(null);
        void groupsRepository
            .getGroup(groupId)
            .then(async (nextGroup) => {
                if (!nextGroup) {
                    setGroup(null);
                    return;
                }
                const mayManageBirthdays =
                    account?.leadershipMinistry === "deacon" &&
                    nextGroup.responsibleDeaconIds.includes(account.id);
                const [nextSummary, nextBirthdays, nextSetting] =
                    await Promise.all([
                        groupsRepository.getSummary(groupId),
                        mayManageBirthdays
                            ? groupsRepository.getAuthorizedBirthdays(groupId)
                            : Promise.resolve([]),
                        mayManageBirthdays && birthdayNotificationsSupported
                            ? groupsRepository.getBirthdayNotificationsEnabled(
                                  groupId,
                              )
                            : Promise.resolve(false),
                    ]);
                setGroup(nextGroup);
                setSummary(nextSummary);
                setBirthdays(nextBirthdays);
                setNotificationsEnabled(nextSetting);
                if (
                    birthdayNotificationsSupported &&
                    mayManageBirthdays &&
                    nextSetting
                ) {
                    void syncBirthdayNotifications(
                        groupId,
                        nextBirthdays,
                        locale,
                        false,
                    ).catch((cause) =>
                        setNotificationError(
                            cause instanceof Error
                                ? cause.message
                                : copy.notificationError,
                        ),
                    );
                }
            })
            .catch(() => {
                setFailed(true);
                setGroup(null);
            });
    };

    useEffect(load, [
        account?.leadershipMinistry,
        account?.id,
        groupId,
        locale,
    ]);

    async function toggleBirthdayNotifications(enabled: boolean) {
        if (
            !birthdayNotificationsSupported ||
            !assignedDeacon ||
            notificationBusy
        )
            return;
        setNotificationBusy(true);
        setNotificationError(null);
        try {
            if (enabled) {
                await syncBirthdayNotifications(
                    groupId,
                    birthdays,
                    locale,
                    true,
                );
                try {
                    await groupsRepository.setBirthdayNotificationsEnabled(
                        groupId,
                        true,
                    );
                } catch (cause) {
                    await disableBirthdayNotifications(groupId);
                    throw cause;
                }
            } else {
                await disableBirthdayNotifications(groupId);
                try {
                    await groupsRepository.setBirthdayNotificationsEnabled(
                        groupId,
                        false,
                    );
                } catch (cause) {
                    await syncBirthdayNotifications(
                        groupId,
                        birthdays,
                        locale,
                        false,
                    );
                    throw cause;
                }
            }
            setNotificationsEnabled(enabled);
        } catch (cause) {
            setNotificationError(
                cause instanceof Error ? cause.message : copy.notificationError,
            );
        } finally {
            setNotificationBusy(false);
        }
    }

    if (group === undefined)
        return (
            <View
                style={[styles.state, { backgroundColor: palette.background }]}
            >
                <ActivityIndicator color={palette.accent} />
                <Text
                    selectable
                    style={[styles.stateText, { color: palette.text }]}
                >
                    {copy.loading}
                </Text>
            </View>
        );
    if (!group || failed)
        return (
            <View
                style={[styles.state, { backgroundColor: palette.background }]}
            >
                <Ionicons
                    color={palette.secondaryText}
                    name="people-outline"
                    size={30}
                />
                <Text
                    selectable
                    style={[styles.stateText, { color: palette.text }]}
                >
                    {failed ? copy.error : copy.unavailable}
                </Text>
                <Text
                    selectable
                    style={[
                        styles.stateDetail,
                        { color: palette.secondaryText },
                    ]}
                >
                    {failed ? "" : copy.unavailableDetail}
                </Text>
                {failed ? (
                    <Pressable
                        accessibilityRole="button"
                        onPress={load}
                        style={[
                            styles.retry,
                            { backgroundColor: palette.accent },
                        ]}
                    >
                        <Text style={styles.retryText}>{copy.retry}</Text>
                    </Pressable>
                ) : null}
                <Pressable
                    accessibilityRole="button"
                    onPress={() => router.replace("/groups")}
                    style={styles.back}
                >
                    <Text style={[styles.backText, { color: palette.accent }]}>
                        {copy.back}
                    </Text>
                </Pressable>
            </View>
        );

    const deacons = group.responsibleDeacons ?? [];
    return (
        <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={[
                styles.screen,
                desktop && styles.desktopScreen,
                { backgroundColor: palette.background },
            ]}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            stickyHeaderIndices={[1]}
            style={{ backgroundColor: palette.background }}
        >
            <View style={styles.topContent}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={copy.back}
                    onPress={() =>
                        router.canGoBack()
                            ? router.back()
                            : router.replace("/groups")
                    }
                    style={styles.back}
                >
                    <Ionicons
                        accessibilityElementsHidden
                        color={palette.accent}
                        name="chevron-back"
                        size={19}
                    />
                    <Text style={[styles.backText, { color: palette.accent }]}>
                        {copy.back}
                    </Text>
                </Pressable>
                <View style={styles.header}>
                    <Text
                        accessibilityRole="header"
                        selectable
                        style={[styles.title, { color: palette.text }]}
                    >
                        {locale === "uk" ? group.nameUk : group.name}
                    </Text>
                    {assignedDeacon ? (
                        <View
                            style={[
                                styles.myGroupBadge,
                                { backgroundColor: palette.accentSoft },
                            ]}
                        >
                            <Ionicons
                                accessibilityElementsHidden
                                color={palette.accent}
                                name="people"
                                size={15}
                            />
                            <Text
                                selectable
                                style={[
                                    styles.myGroupText,
                                    { color: palette.accent },
                                ]}
                            >
                                {copy.myGroup}
                            </Text>
                        </View>
                    ) : null}
                </View>
                <View
                    style={[
                        styles.relatedSections,
                        desktop && styles.relatedSectionsDesktop,
                    ]}
                >
                    <View style={desktop && styles.relatedColumn}>
                        <Section title={copy.responsibleDeacons}>
                            {deacons.length ? (
                                deacons.map((member) => (
                                    <PersonRow
                                        key={member.id}
                                        leader
                                        locale={locale}
                                        member={member}
                                        onPress={() =>
                                            router.push(
                                                `/members/${member.id}` as never,
                                            )
                                        }
                                    />
                                ))
                            ) : (
                                <Text
                                    selectable
                                    style={[
                                        styles.empty,
                                        { color: palette.secondaryText },
                                    ]}
                                >
                                    {copy.noDeacons}
                                </Text>
                            )}
                        </Section>
                    </View>
                    {assignedDeacon ? (
                        <View style={desktop && styles.relatedColumn}>
                            <Section
                                expanded={birthdaysExpanded}
                                onToggle={() =>
                                    setBirthdaysExpanded(
                                        (expanded) => !expanded,
                                    )
                                }
                                title={copy.birthdays}
                            >
                                {birthdayNotificationsSupported ? (
                                    <View
                                        style={[
                                            styles.notificationRow,
                                            { borderBottomColor: palette.line },
                                        ]}
                                    >
                                        <View style={styles.notificationCopy}>
                                            <Text
                                                selectable
                                                style={[
                                                    styles.notificationTitle,
                                                    { color: palette.text },
                                                ]}
                                            >
                                                {copy.birthdayNotifications}
                                            </Text>
                                            <Text
                                                selectable
                                                style={[
                                                    styles.personDetail,
                                                    {
                                                        color: palette.secondaryText,
                                                    },
                                                ]}
                                            >
                                                {
                                                    copy.birthdayNotificationDetail
                                                }
                                            </Text>
                                        </View>
                                        {notificationBusy ? (
                                            <ActivityIndicator
                                                color={palette.accent}
                                            />
                                        ) : (
                                            <Switch
                                                accessibilityLabel={
                                                    copy.birthdayNotifications
                                                }
                                                ios_backgroundColor={
                                                    palette.line
                                                }
                                                onValueChange={(enabled) =>
                                                    void toggleBirthdayNotifications(
                                                        enabled,
                                                    )
                                                }
                                                thumbColor="#FFFFFF"
                                                trackColor={{
                                                    false: palette.line,
                                                    true: palette.accent,
                                                }}
                                                value={notificationsEnabled}
                                            />
                                        )}
                                    </View>
                                ) : null}
                                {notificationError ? (
                                    <Text
                                        accessibilityLiveRegion="polite"
                                        selectable
                                        style={[
                                            styles.notificationError,
                                            { color: palette.accent },
                                        ]}
                                    >
                                        {notificationError}
                                    </Text>
                                ) : null}
                                {upcoming.length ? (
                                    upcoming.map((member) => (
                                        <PersonRow
                                            key={member.id}
                                            locale={locale}
                                            member={member}
                                            detail={formatBirthday(
                                                member.month,
                                                member.day,
                                                locale,
                                            )}
                                            onPress={() =>
                                                router.push(
                                                    `/members/${member.id}` as never,
                                                )
                                            }
                                        />
                                    ))
                                ) : (
                                    <Text
                                        selectable
                                        style={[
                                            styles.empty,
                                            { color: palette.secondaryText },
                                        ]}
                                    >
                                        {copy.noUpcomingBirthdays}
                                    </Text>
                                )}
                            </Section>
                        </View>
                    ) : null}
                </View>
            </View>
            <View
                style={[
                    styles.stickySearch,
                    { backgroundColor: palette.background },
                ]}
            >
                <View
                    style={[styles.search, { backgroundColor: palette.subtle }]}
                >
                    <Ionicons
                        accessibilityElementsHidden
                        color={palette.secondaryText}
                        name="search-outline"
                        size={20}
                    />
                    <TextInput
                        accessibilityLabel={copy.searchMembers}
                        autoCapitalize="none"
                        clearButtonMode="while-editing"
                        onChangeText={setQuery}
                        placeholder={copy.searchMembers}
                        placeholderTextColor={palette.secondaryText}
                        returnKeyType="search"
                        style={[styles.searchInput, { color: palette.text }]}
                        value={query}
                    />
                    <Pressable
                        accessibilityLabel={
                            locale === "uk" ? "Фільтри" : "Filters"
                        }
                        accessibilityRole="button"
                        accessibilityState={{ expanded: filterOpen }}
                        onPress={() => setFilterOpen((open) => !open)}
                        style={styles.filterButton}
                    >
                        <Ionicons
                            accessibilityElementsHidden
                            color={
                                filters.length
                                    ? palette.accent
                                    : palette.secondaryText
                            }
                            name="options-outline"
                            size={21}
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
                        <View style={styles.filterHeader}>
                            <Text
                                accessibilityRole="header"
                                style={[
                                    styles.filterTitle,
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
                                    accessibilityRole="checkbox"
                                    accessibilityState={{ checked: selected }}
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
            <Section title={`${copy.members} (${filteredMembers.length})`}>
                {filteredMembers.length ? (
                    filteredMembers.map((member) => (
                        <PersonRow
                            key={member.id}
                            locale={locale}
                            member={member}
                            onPress={() =>
                                router.push(`/members/${member.id}` as never)
                            }
                        />
                    ))
                ) : (
                    <Text
                        selectable
                        style={[styles.empty, { color: palette.secondaryText }]}
                    >
                        {query.trim() ? copy.noMatchingMembers : copy.noMembers}
                    </Text>
                )}
            </Section>
            <Text
                accessibilityRole="summary"
                selectable
                style={[styles.summary, { color: palette.secondaryText }]}
            >
                {copy.summary(
                    summary.total || group.members.length,
                    summary.orphans,
                    summary.widows,
                )}
            </Text>
        </ScrollView>
    );
}

function formatBirthday(month: number, day: number, locale: "en" | "uk") {
    return new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-US", {
        month: "long",
        day: "numeric",
        timeZone: "UTC",
    }).format(new Date(Date.UTC(2000, month - 1, day)));
}

function Section({
    children,
    expanded,
    onToggle,
    title,
}: {
    children: React.ReactNode;
    expanded?: boolean;
    onToggle?: () => void;
    title: string;
}) {
    const { palette } = useAppearance();
    const heading = (
        <Text
            accessibilityRole="header"
            selectable={!onToggle}
            style={[styles.sectionTitle, { color: palette.text }]}
        >
            {title}
        </Text>
    );
    return (
        <View style={styles.section}>
            {onToggle ? (
                <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    onPress={onToggle}
                    style={({ pressed }) => [
                        styles.sectionToggle,
                        pressed && styles.pressed,
                    ]}
                >
                    {heading}
                    <Ionicons
                        accessibilityElementsHidden
                        color={palette.secondaryText}
                        name={expanded ? "chevron-up" : "chevron-down"}
                        size={18}
                    />
                </Pressable>
            ) : (
                heading
            )}
            {expanded !== false ? (
                <View
                    style={[
                        styles.sectionCard,
                        {
                            backgroundColor: palette.surface,
                            borderColor: palette.line,
                        },
                    ]}
                >
                    {children}
                </View>
            ) : null}
        </View>
    );
}
function PersonRow({
    detail,
    leader = false,
    locale,
    member,
    onPress,
}: {
    detail?: string;
    leader?: boolean;
    locale: "en" | "uk";
    member: Pick<
        GroupMember,
        "id" | "name" | "photo" | "leadershipMinistry" | "isOrphan" | "isWidow"
    >;
    onPress: () => void;
}) {
    const { palette } = useAppearance();
    return (
        <Pressable
            accessibilityHint="Opens member profile"
            accessibilityRole="button"
            onPress={onPress}
            style={({ pressed }) => [
                styles.person,
                leader && styles.leaderPerson,
                { borderBottomColor: palette.line },
                pressed && styles.pressed,
            ]}
        >
            <ProfileAvatar name={member.name} source={member.photo} />
            <View style={styles.personCopy}>
                <Text
                    selectable
                    style={[styles.personName, { color: palette.text }]}
                >
                    {member.name}
                </Text>
                {detail ? (
                    <Text
                        selectable
                        style={[
                            styles.personDetail,
                            { color: palette.secondaryText },
                        ]}
                    >
                        {detail}
                    </Text>
                ) : null}
                {member.leadershipMinistry ? (
                    <LeadershipBadge
                        leadershipMinistry={member.leadershipMinistry}
                        locale={locale}
                    />
                ) : null}
                <CareStatusBadges
                    isOrphan={member.isOrphan}
                    isWidow={member.isWidow}
                />
            </View>
            <Ionicons
                accessibilityElementsHidden
                color={palette.accent}
                name="chevron-forward"
                size={18}
            />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    desktopScreen: {
        alignSelf: "center",
        maxWidth: 1120,
        width: "100%",
        paddingHorizontal: 32,
        paddingTop: 28,
    },
    relatedSections: { gap: 18 },
    relatedSectionsDesktop: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 24,
    },
    relatedColumn: { flex: 1, minWidth: 0 },
    screen: { flexGrow: 1, gap: 18, padding: 20, paddingBottom: 110 },
    topContent: { gap: 18 },
    back: {
        alignItems: "center",
        alignSelf: "flex-start",
        flexDirection: "row",
        minHeight: 32,
    },
    backText: { fontSize: 16, fontWeight: "600" },
    header: { gap: 3 },
    title: { fontSize: 30, fontWeight: "800", letterSpacing: -0.6 },
    myGroupBadge: {
        alignItems: "center",
        alignSelf: "flex-start",
        borderRadius: 10,
        flexDirection: "row",
        gap: 6,
        marginTop: 5,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    myGroupText: { fontSize: 13, fontWeight: "800" },
    section: { gap: 8 },
    sectionTitle: { fontSize: 18, fontWeight: "700" },
    sectionToggle: {
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "space-between",
        minHeight: 44,
    },
    sectionCard: {
        borderCurve: "continuous",
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: "hidden",
    },
    stickySearch: {
        marginHorizontal: -20,
        paddingBottom: 10,
        paddingHorizontal: 20,
        paddingTop: 2,
        zIndex: 2,
    },
    search: {
        alignItems: "center",
        borderCurve: "continuous",
        borderRadius: 14,
        flexDirection: "row",
        gap: 10,
        minHeight: 46,
        paddingHorizontal: 14,
    },
    searchInput: { flex: 1, fontSize: 16, paddingVertical: 11 },
    filterButton: {
        alignItems: "center",
        justifyContent: "center",
        minHeight: 40,
        minWidth: 40,
        position: "relative",
    },
    filterCount: {
        alignItems: "center",
        borderRadius: 8,
        height: 16,
        justifyContent: "center",
        position: "absolute",
        right: -2,
        top: 1,
        width: 16,
    },
    filterCountText: { color: "#FFF", fontSize: 10, fontWeight: "800" },
    filterPopover: {
        borderCurve: "continuous",
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        elevation: 8,
        marginTop: 7,
        padding: 12,
        position: "absolute",
        right: 20,
        shadowColor: "#000",
        shadowOffset: { height: 4, width: 0 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
        top: 50,
        width: 244,
        zIndex: 20,
    },
    filterHeader: {
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "space-between",
        minHeight: 34,
        paddingHorizontal: 4,
    },
    filterTitle: { fontSize: 17, fontWeight: "800" },
    clearButton: { justifyContent: "center", minHeight: 36, paddingLeft: 12 },
    clearText: { fontSize: 14, fontWeight: "700" },
    filterOption: {
        alignItems: "center",
        flexDirection: "row",
        gap: 11,
        minHeight: 44,
        paddingHorizontal: 4,
    },
    checkbox: {
        alignItems: "center",
        borderRadius: 6,
        borderWidth: 1.5,
        height: 23,
        justifyContent: "center",
        width: 23,
    },
    filterOptionText: { flex: 1, fontSize: 15, fontWeight: "600" },
    doneButton: {
        alignItems: "center",
        borderRadius: 11,
        justifyContent: "center",
        marginTop: 7,
        minHeight: 42,
    },
    doneText: { color: "#FFF", fontSize: 15, fontWeight: "800" },
    person: {
        alignItems: "center",
        borderBottomWidth: StyleSheet.hairlineWidth,
        flexDirection: "row",
        gap: 11,
        minHeight: 62,
        paddingHorizontal: 14,
        paddingVertical: 9,
    },
    pressed: { opacity: 0.7 },
    leaderPerson: { backgroundColor: "rgba(255,255,255,0.025)" },
    avatar: {
        alignItems: "center",
        borderRadius: 19,
        height: 38,
        justifyContent: "center",
        width: 38,
    },
    avatarText: { fontSize: 16, fontWeight: "700" },
    personCopy: { flex: 1 },
    personName: { fontSize: 16, fontWeight: "600" },
    personDetail: { fontSize: 14, marginTop: 2 },
    notificationRow: {
        alignItems: "center",
        borderBottomWidth: StyleSheet.hairlineWidth,
        flexDirection: "row",
        gap: 12,
        minHeight: 70,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    notificationCopy: { flex: 1 },
    notificationTitle: { fontSize: 16, fontWeight: "700" },
    notificationError: {
        fontSize: 13,
        lineHeight: 18,
        paddingHorizontal: 14,
        paddingTop: 10,
    },
    summary: {
        fontSize: 14,
        fontWeight: "600",
        paddingBottom: 16,
        textAlign: "center",
    },
    empty: { padding: 14 },
    state: {
        alignItems: "center",
        flex: 1,
        gap: 10,
        justifyContent: "center",
        padding: 30,
    },
    stateText: { fontSize: 18, fontWeight: "700", textAlign: "center" },
    stateDetail: { textAlign: "center" },
    retry: {
        borderCurve: "continuous",
        borderRadius: 12,
        paddingHorizontal: 18,
        paddingVertical: 11,
    },
    retryText: { color: "#FFF", fontWeight: "700" },
});
