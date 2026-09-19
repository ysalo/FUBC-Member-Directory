import { Text, TextInput } from "@/features/accessibility/app-text";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, SectionList, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { WebTabBar } from "@/features/shell/WebTabBar";
import { useDesktopLayout } from "@/features/shell/use-desktop-layout";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { CareStatusBadges } from "@/features/members/care-status-badges";
import { LeadershipBadge } from "@/features/members/leadership-badge";
import { ProfileAvatar } from "@/features/members/ProfileAvatar";
import { formatPhoneNumber } from "@/lib/phone";

import { getDirectoryVisitCount, listDirectory } from "./directory-repository";
import type { Member } from "./members";

function SummaryAction({ accent, label, onPress, ring = false }: { accent: string; label: string; onPress: () => void; ring?: boolean }) {
  const { palette } = useAppearance();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.summaryAction, { backgroundColor: palette.elevated, borderColor: palette.line }, pressed && styles.pressed]}>
      <View style={[styles.statusMark, ring && styles.statusRing, { backgroundColor: ring ? "transparent" : accent, borderColor: accent, borderWidth: ring ? px(6) : 0 }]} />
      <Text adjustsFontSizeToFit minimumFontScale={0.88} numberOfLines={ring ? 2 : 1} style={[styles.summaryActionLabel, { color: palette.text }]}>{label}</Text>
      <Ionicons accessibilityElementsHidden color={palette.secondaryText} name="chevron-forward" size={px(21)} />
    </Pressable>
  );
}

function MemberRow({ item, locale, ministry, onPress }: { item: Member; locale: "en" | "uk"; ministry: string; onPress: () => void }) {
  const { palette } = useAppearance();
  const desktop = useDesktopLayout();
  const showsMinistry = Boolean(ministry) && !isLeadershipMinistryLabel(ministry, item.leadershipMinistry);
  const row = (
    <Pressable accessibilityHint={locale === "uk" ? `Відкрити профіль: ${item.name}` : `Opens ${item.name}’s member profile`} accessibilityRole={Platform.OS === "web" ? "link" : "button"} onPress={Platform.OS === "web" ? undefined : onPress} style={Platform.OS === "web" ? StyleSheet.flatten([styles.memberRow, desktop && styles.desktopMemberRow, { backgroundColor: palette.surface, borderBottomColor: palette.line }]) : ({ pressed }) => [styles.memberRow, { backgroundColor: palette.surface, borderBottomColor: palette.line }, pressed && styles.pressed]}>
      <ProfileAvatar name={item.name} size={desktop ? 56 : 72} source={item.avatar} />
      <View style={[styles.memberCopy, desktop && styles.desktopMemberCopy]}>
        <Text numberOfLines={1} style={[styles.memberName, { color: palette.text }]}>{item.name}</Text>
        {!desktop && showsMinistry ? <Text numberOfLines={1} style={[styles.memberMinistry, { color: palette.secondaryText }]}>{ministry}</Text> : null}
        {!desktop && item.phone ? <Text numberOfLines={1} selectable style={[styles.memberPhone, { color: palette.secondaryText }]}>{formatPhoneNumber(item.phone)}</Text> : null}
        {item.leadershipMinistry ? <LeadershipBadge leadershipMinistry={item.leadershipMinistry} locale={locale} /> : null}
        <CareStatusBadges isOrphan={item.isOrphan} isWidow={item.isWidow} />
      </View>
      {desktop ? <><Text style={[styles.desktopMinistry, { color: palette.secondaryText }]}>{showsMinistry ? ministry : "—"}</Text><Text style={[styles.desktopPhone, { color: palette.secondaryText }]}>{item.phone ? formatPhoneNumber(item.phone) : "—"}</Text></> : null}
      <Ionicons accessibilityElementsHidden color={palette.secondaryText} name="chevron-forward" size={px(22)} />
    </Pressable>
  );
  return Platform.OS === "web" ? <Link href={`/members/${item.id}`} asChild>{row}</Link> : row;
}

function isLeadershipMinistryLabel(ministry: string, leadershipMinistry: Member["leadershipMinistry"]) {
  const normalized = ministry.trim().toLocaleLowerCase();
  return leadershipMinistry === "deacon"
    ? normalized === "deacon" || normalized === "диякон"
    : leadershipMinistry === "pastor" && (normalized === "pastor" || normalized === "пастор");
}

export function DirectoryScreen() {
  const desktop = useDesktopLayout();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { copy, locale } = useLocalization();
  const { palette } = useAppearance();
  const [query, setQuery] = useState("");
  const [directoryMembers, setDirectoryMembers] = useState<Member[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "error" | "ready">("loading");
  const [visitCount, setVisitCount] = useState(0);
  type DirectoryFilter = "orphan" | "widow" | "deacon" | "pastor";
  const [filters, setFilters] = useState<DirectoryFilter[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);

  const loadDirectory = () => {
    setLoadState("loading");
    Promise.all([listDirectory(), getDirectoryVisitCount()]).then(([nextMembers, nextVisitCount]) => { setDirectoryMembers(nextMembers); setVisitCount(nextVisitCount); setLoadState("ready"); }).catch(() => setLoadState("error"));
  };
  useFocusEffect(useCallback(loadDirectory, []));

  const sections = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const surname = (name: string) => name.trim().split(/\s+/).at(-1) ?? name;
    const sorted = directoryMembers
      .filter((member) => filters.length === 0 || filters.some((filter) => filter === "orphan" ? member.isOrphan : filter === "widow" ? member.isWidow : member.leadershipMinistry === filter))
      .filter((member) => !needle || `${member.name} ${member.ministry} ${member.ministryUk}`.toLocaleLowerCase().includes(needle))
      .sort((a, b) => surname(a.name).localeCompare(surname(b.name), locale) || a.name.localeCompare(b.name, locale));
    return sorted.reduce<Array<{ title: string; data: Member[] }>>((groups, member) => {
      const title = surname(member.name).charAt(0).toLocaleUpperCase(locale) || "#";
      const existing = groups.at(-1);
      if (existing?.title === title) existing.data.push(member);
      else groups.push({ title, data: [member] });
      return groups;
    }, []);
  }, [directoryMembers, filters, locale, query]);

  const filterOptions: Array<{ id: DirectoryFilter; label: string }> = [
    { id: "orphan", label: locale === "uk" ? "Сироти" : "Orphans" },
    { id: "widow", label: locale === "uk" ? "Вдови та вдівці" : "Widows & widowers" },
    { id: "deacon", label: locale === "uk" ? "Диякони" : "Deacons" },
    { id: "pastor", label: locale === "uk" ? "Пастори" : "Pastors" },
  ];
  const toggleFilter = (filter: DirectoryFilter) => setFilters((current) => current.includes(filter) ? current.filter((value) => value !== filter) : [...current, filter]);

  const summary = (
    <View>
      {visitCount > 0 ? <Pressable accessibilityRole="button" onPress={() => router.push("/visitation")} style={[styles.visitAlert, { backgroundColor: palette.subtle }]}><Ionicons accessibilityElementsHidden color={palette.accent} name="notifications-outline" size={px(18)} /><Text style={[styles.visitAlertText, { color: palette.text }]}>{locale === "uk" ? `Відвідування: ${visitCount}` : `Active visitations: ${visitCount}`}</Text><Ionicons accessibilityElementsHidden color={palette.secondaryText} name="chevron-forward" size={px(18)} /></Pressable> : null}
      <View accessibilityLabel="Directory totals" style={[styles.summaryFooter, { backgroundColor: palette.surface, borderTopColor: palette.line }]}>
        <Text style={[styles.summaryFooterText, { color: palette.text }]}>{locale === "uk" ? "Усього" : "Total members"}: {directoryMembers.length}</Text>
        <Text style={[styles.summaryFooterText, { color: palette.secondaryText }]}>{locale === "uk" ? "Сироти" : "Orphans"}: {directoryMembers.filter((member) => member.isOrphan).length}</Text>
        <Text style={[styles.summaryFooterText, { color: palette.secondaryText }]}>{locale === "uk" ? "Вдови" : "Widows"}: {directoryMembers.filter((member) => member.isWidow).length}</Text>
      </View>
    </View>
  );

  const stickyOverview = (
    <View style={[styles.stickyOverview, { backgroundColor: palette.background, borderBottomColor: palette.line, paddingTop: Platform.OS === "web" ? 0 : insets.top }]}>
      <View style={styles.titleRow}><Text accessibilityRole="header" selectable style={[styles.title, { color: palette.text }]}>{copy.directory.title}</Text></View>
      <View style={[styles.searchField, { backgroundColor: palette.subtle }]}>
        <Ionicons accessibilityElementsHidden color={palette.secondaryText} name="search-outline" size={px(21)} style={styles.searchIcon} />
        <TextInput accessibilityLabel={copy.directory.searchLabel} autoCapitalize="none" clearButtonMode="while-editing" onChangeText={setQuery} placeholder={copy.directory.search} placeholderTextColor={palette.secondaryText} returnKeyType="search" style={[styles.searchInput, { color: palette.text }]} value={query} />
        <Pressable accessibilityLabel={locale === "uk" ? "Фільтри" : "Filters"} accessibilityRole="button" accessibilityState={{ expanded: filterOpen }} onPress={() => setFilterOpen((open) => !open)} style={styles.filterButton}><Ionicons accessibilityElementsHidden color={filters.length === 0 ? palette.secondaryText : palette.accent} name="options-outline" size={px(21)} />{filters.length ? <View style={[styles.filterCount, { backgroundColor: palette.accent }]}><Text style={styles.filterCountText}>{filters.length}</Text></View> : null}</Pressable>
      </View>
      {filterOpen ? <View accessibilityViewIsModal style={[styles.filterPopover, { backgroundColor: palette.elevated, borderColor: palette.line }]}><View style={styles.filterPopoverHeader}><Text accessibilityRole="header" style={[styles.filterPopoverTitle, { color: palette.text }]}>{locale === "uk" ? "Фільтри" : "Filters"}</Text>{filters.length ? <Pressable accessibilityRole="button" onPress={() => setFilters([])} style={styles.clearButton}><Text style={[styles.clearText, { color: palette.accent }]}>{locale === "uk" ? "Очистити" : "Clear"}</Text></Pressable> : null}</View>{filterOptions.map((option) => { const selected = filters.includes(option.id); return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} key={option.id} onPress={() => toggleFilter(option.id)} style={styles.filterOption}><View style={[styles.checkbox, { backgroundColor: selected ? palette.accent : "transparent", borderColor: selected ? palette.accent : palette.line }]}>{selected ? <Ionicons accessibilityElementsHidden color="#FFF" name="checkmark" size={15} /> : null}</View><Text style={[styles.filterOptionText, { color: palette.text }]}>{option.label}</Text></Pressable>; })}<Pressable accessibilityRole="button" onPress={() => setFilterOpen(false)} style={[styles.doneButton, { backgroundColor: palette.accent }]}><Text style={styles.doneText}>{locale === "uk" ? "Готово" : "Done"}</Text></Pressable></View> : null}
    </View>
  );

  const empty = loadState === "loading" ? <View style={styles.empty}><ActivityIndicator color={palette.accent} /><Text style={[styles.emptyDetail, { color: palette.secondaryText }]}>{locale === "uk" ? "Завантаження довідника…" : "Loading directory…"}</Text></View> : loadState === "error" ? (
    <View style={styles.empty}><Text style={[styles.emptyTitle, { color: palette.text }]}>{locale === "uk" ? "Не вдалося завантажити довідник" : "Unable to load the directory"}</Text><Pressable accessibilityRole="button" onPress={loadDirectory} style={[styles.retry, { backgroundColor: palette.accent }]}><Text style={styles.retryText}>{locale === "uk" ? "Спробувати ще раз" : "Try again"}</Text></Pressable></View>
  ) : (
    <View style={styles.empty}>
      <Text style={[styles.emptyTitle, { color: palette.text }]}>{copy.directory.emptyTitle}</Text>
      <Text style={[styles.emptyDetail, { color: palette.secondaryText }]}>{copy.directory.emptyDetail}</Text>
    </View>
  );

  if (Platform.OS === "web") {
    return (
      <View style={[styles.safe, desktop && styles.desktopScreen, { backgroundColor: palette.background }]}>
        {stickyOverview}
        {desktop && <View style={[styles.desktopColumnHeaders, { borderBottomColor: palette.line }]}><Text style={[styles.desktopNameHeader, { color: palette.secondaryText }]}>{locale === "uk" ? "Учасник" : "Member"}</Text><Text style={[styles.desktopMinistry, { color: palette.secondaryText }]}>{locale === "uk" ? "Служіння" : "Ministry"}</Text><Text style={[styles.desktopPhone, { color: palette.secondaryText }]}>{locale === "uk" ? "Телефон" : "Phone"}</Text><View style={{ width: 22 }} /></View>}
        <ScrollView contentContainerStyle={styles.webContent} keyboardShouldPersistTaps="handled" style={styles.rosterScroll}>
          {sections.length === 0 ? empty : sections.map((section) => (
            <View key={section.title}>
              <Text style={[styles.sectionLetter, { color: palette.secondaryText }]}>{section.title}</Text>
              {section.data.map((item) => <MemberRow item={item} key={item.id} locale={locale} ministry={locale === "uk" ? item.ministryUk : item.ministry} onPress={() => router.push(`/members/${item.id}` as never)} />)}
            </View>
          ))}
          {summary}
        </ScrollView>
        <WebTabBar />
      </View>
    );
  }

  return (
    <View style={[styles.safe, { backgroundColor: palette.background }]}>
      {stickyOverview}
      <SectionList
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        ListEmptyComponent={empty}
        renderItem={({ item }) => <MemberRow item={item} locale={locale} ministry={locale === "uk" ? item.ministryUk : item.ministry} onPress={() => router.push(`/members/${item.id}` as never)} />}
        renderSectionHeader={({ section }) => <Text style={[styles.sectionLetter, { color: palette.secondaryText }]}>{section.title}</Text>}
        removeClippedSubviews={false}
        sections={sections}
        ListFooterComponent={summary}
        stickySectionHeadersEnabled={false}
        windowSize={15}
      />
      <WebTabBar />
    </View>
  );
}

const scale = 1;
const px = (value: number) => value * scale;

const styles = StyleSheet.create({
  desktopScreen: { alignSelf: "center", maxWidth: 1200, width: "100%", paddingHorizontal: 20 },
  desktopMemberRow: { gap: 16, minHeight: 84, paddingVertical: 12 },
  desktopMemberCopy: { marginLeft: 0, minWidth: 0, flex: 1.3 },
  desktopMinistry: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 21 },
  desktopPhone: { width: 156, fontSize: 14, lineHeight: 20 },
  desktopColumnHeaders: { flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  desktopNameHeader: { flex: 1.3, marginLeft: 72, fontSize: 14, fontWeight: "600" },
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
  title: { color: "#292D31", fontSize: px(48), fontWeight: "800", letterSpacing: px(-1.7), lineHeight: px(56) },
  pressed: { opacity: 0.68, transform: [{ scale: 0.985 }] },
  searchField: { alignItems: "center", borderRadius: px(14), flexDirection: "row", marginHorizontal: px(20), marginTop: px(12), minHeight: px(44), paddingHorizontal: px(17) },
  searchIcon: { marginRight: px(13) },
  searchInput: { color: "#22262A", flex: 1, fontSize: px(14), paddingVertical: px(12) },
  filterButton: { alignItems: "center", justifyContent: "center", minHeight: px(40), minWidth: px(40), position: "relative" },
  filterCount: { alignItems: "center", borderRadius: px(8), height: px(16), justifyContent: "center", position: "absolute", right: px(-2), top: px(1), width: px(16) },
  filterCountText: { color: "#FFF", fontSize: px(10), fontWeight: "800" },
  filterPopover: { borderCurve: "continuous", borderRadius: px(16), borderWidth: StyleSheet.hairlineWidth, elevation: 8, marginTop: px(7), padding: px(12), position: "absolute", right: px(20), shadowColor: "#000", shadowOffset: { height: px(4), width: 0 }, shadowOpacity: 0.18, shadowRadius: px(12), top: "100%", width: px(244), zIndex: 20 },
  filterPopoverHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: px(34), paddingHorizontal: px(4) },
  filterPopoverTitle: { fontSize: px(17), fontWeight: "800" }, clearButton: { justifyContent: "center", minHeight: px(36), paddingLeft: px(12) }, clearText: { fontSize: px(14), fontWeight: "700" },
  filterOption: { alignItems: "center", flexDirection: "row", gap: px(11), minHeight: px(44), paddingHorizontal: px(4) }, checkbox: { alignItems: "center", borderRadius: px(6), borderWidth: 1.5, height: px(23), justifyContent: "center", width: px(23) }, filterOptionText: { flex: 1, fontSize: px(15), fontWeight: "600" },
  doneButton: { alignItems: "center", borderRadius: px(11), justifyContent: "center", marginTop: px(7), minHeight: px(42) }, doneText: { color: "#FFF", fontSize: px(15), fontWeight: "800" },
  visitationPanel: { borderRadius: px(16), marginHorizontal: px(18), marginTop: px(12), paddingBottom: px(10), paddingHorizontal: px(10), paddingTop: px(14) },
  panelHeadingRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingBottom: px(8), paddingHorizontal: px(1) },
  panelHeading: { color: "#111722", fontSize: px(21), fontWeight: "800", letterSpacing: px(-0.35) },
  viewAllAction: { alignItems: "center", flexDirection: "row" },
  viewAll: { color: "#6E7073", fontSize: px(13), fontWeight: "500", marginRight: px(2) },
  summaryRow: { flexDirection: "row", gap: px(9) },
  summaryAction: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DFDCD5", borderRadius: px(12), borderWidth: StyleSheet.hairlineWidth, flex: 1, flexDirection: "row", minHeight: px(60), paddingHorizontal: px(6) },
  statusMark: { borderRadius: px(11), flexShrink: 0, height: px(22), marginRight: px(6), width: px(22) },
  statusRing: { borderRadius: px(19), height: px(38), width: px(38) },
  summaryActionLabel: { color: "#101622", flex: 1, fontSize: px(14), fontWeight: "600", lineHeight: px(18) },
  sectionLetter: { color: "#4A4C4F", fontSize: px(17), fontWeight: "600", paddingBottom: px(5), paddingHorizontal: px(19), paddingTop: px(10) },
  memberRow: { alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", minHeight: px(74), paddingHorizontal: px(20), paddingVertical: px(1) },
  memberCopy: { flex: 1, marginLeft: px(5) },
  memberName: { color: "#090F19", fontSize: px(18), fontWeight: "600", letterSpacing: px(0.3) },
  memberMinistry: { color: "#737477", fontSize: px(16), marginTop: px(2) },
  memberPhone: { fontSize: px(14), marginTop: px(2) },
  filterRow: { alignItems: "center", flexDirection: "row", gap: px(7), marginHorizontal: px(20), marginTop: px(10) },
  filterChip: { borderRadius: px(16), minHeight: px(34), justifyContent: "center", paddingHorizontal: px(12) },
  filterChipText: { fontSize: px(13), fontWeight: "700" },
  summaryFooter: { borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: px(16), justifyContent: "center", marginTop: px(16), paddingHorizontal: px(12), paddingVertical: px(16) },
  summaryFooterText: { fontSize: px(13), fontWeight: "600" },
  visitAlert: { alignItems: "center", borderRadius: px(12), flexDirection: "row", gap: px(8), marginHorizontal: px(18), marginTop: px(14), minHeight: px(44), paddingHorizontal: px(12) },
  visitAlertText: { flex: 1, fontSize: px(14), fontWeight: "700" },
  empty: { alignItems: "center", paddingHorizontal: px(30), paddingTop: px(48) },
  emptyTitle: { color: "#20252A", fontSize: px(20), fontWeight: "700" },
  emptyDetail: { color: "#676A6E", fontSize: px(16), marginTop: px(8), textAlign: "center" },
  retry: { backgroundColor: "#EF5A24", borderRadius: px(11), marginTop: px(13), paddingHorizontal: px(16), paddingVertical: px(10) },
  retryText: { color: "#FFFFFF", fontSize: px(14), fontWeight: "700" },
});
