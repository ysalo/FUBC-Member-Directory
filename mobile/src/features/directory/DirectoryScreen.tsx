import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, SectionList, StyleSheet, Text, TextInput, View } from "react-native";

import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { WebTabBar } from "@/features/shell/WebTabBar";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { CareStatusBadges } from "@/features/members/care-status-badges";

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

function MemberRow({ item, ministry, onPress }: { item: Member; ministry: string; onPress: () => void }) {
  const { palette } = useAppearance();
  return (
    <Pressable accessibilityHint={`Opens ${item.name}’s member profile`} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.memberRow, { backgroundColor: palette.surface, borderBottomColor: palette.line }, pressed && styles.pressed]}>
      <Image accessibilityLabel={`${item.name} profile photo`} contentFit="cover" source={item.avatar} style={styles.avatar} />
      <View style={styles.memberCopy}>
        <Text numberOfLines={1} style={[styles.memberName, { color: palette.text }]}>{item.name}</Text>
        <Text numberOfLines={1} style={[styles.memberMinistry, { color: palette.secondaryText }]}>{ministry}</Text>
        {item.phone ? <Text numberOfLines={1} selectable style={[styles.memberPhone, { color: palette.secondaryText }]}>{item.phone}</Text> : null}
        {item.designation !== "none" ? <View style={[styles.specialBadge, { backgroundColor: palette.subtle }]}><Text style={[styles.specialBadgeText, { color: palette.text }]}>{item.designation === "pastor" ? "Pastor" : "Deacon"}</Text></View> : null}
        <CareStatusBadges isOrphan={item.isOrphan} isWidow={item.isWidow} />
      </View>
      <Ionicons accessibilityElementsHidden color={palette.secondaryText} name="chevron-forward" size={px(22)} />
    </Pressable>
  );
}

export function DirectoryScreen() {
  const router = useRouter();
  const { copy, locale } = useLocalization();
  const { palette } = useAppearance();
  const [query, setQuery] = useState("");
  const [directoryMembers, setDirectoryMembers] = useState<Member[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "error" | "ready">("loading");
  const [visitCount, setVisitCount] = useState(0);
  const [filter, setFilter] = useState<"all" | "orphan" | "widow">("all");

  const loadDirectory = () => {
    setLoadState("loading");
    Promise.all([listDirectory(), getDirectoryVisitCount()]).then(([nextMembers, nextVisitCount]) => { setDirectoryMembers(nextMembers); setVisitCount(nextVisitCount); setLoadState("ready"); }).catch(() => setLoadState("error"));
  };
  useEffect(loadDirectory, []);

  const sections = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const surname = (name: string) => name.trim().split(/\s+/).at(-1) ?? name;
    const sorted = directoryMembers
      .filter((member) => filter === "all" || (filter === "orphan" ? member.isOrphan : member.isWidow))
      .filter((member) => !needle || `${member.name} ${member.ministry} ${member.ministryUk}`.toLocaleLowerCase().includes(needle))
      .sort((a, b) => surname(a.name).localeCompare(surname(b.name), locale) || a.name.localeCompare(b.name, locale));
    return sorted.reduce<Array<{ title: string; data: Member[] }>>((groups, member) => {
      const title = surname(member.name).charAt(0).toLocaleUpperCase(locale) || "#";
      const existing = groups.at(-1);
      if (existing?.title === title) existing.data.push(member);
      else groups.push({ title, data: [member] });
      return groups;
    }, []);
  }, [directoryMembers, filter, locale, query]);

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
    <View style={[styles.stickyOverview, { backgroundColor: palette.background, borderBottomColor: palette.line }]}>
      <View style={styles.titleRow}><Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>{copy.directory.title}</Text></View>
      <View style={[styles.searchField, { backgroundColor: palette.subtle }]}>
        <Ionicons accessibilityElementsHidden color={palette.secondaryText} name="search-outline" size={px(21)} style={styles.searchIcon} />
        <TextInput accessibilityLabel={copy.directory.searchLabel} autoCapitalize="none" clearButtonMode="while-editing" onChangeText={setQuery} placeholder={copy.directory.search} placeholderTextColor={palette.secondaryText} returnKeyType="search" style={[styles.searchInput, { color: palette.text }]} value={query} />
        <Pressable accessibilityLabel={locale === "uk" ? "Фільтр" : "Filter"} accessibilityRole="button" onPress={() => Alert.alert(locale === "uk" ? "Фільтр" : "Filter", undefined, [{ text: locale === "uk" ? "Усі" : "All", onPress: () => setFilter("all") }, { text: locale === "uk" ? "Сироти" : "Orphans", onPress: () => setFilter("orphan") }, { text: locale === "uk" ? "Вдови" : "Widows", onPress: () => setFilter("widow") }, { text: locale === "uk" ? "Скасувати" : "Cancel", style: "cancel" }])} style={styles.filterButton}><Ionicons accessibilityElementsHidden color={filter === "all" ? palette.secondaryText : palette.accent} name="funnel-outline" size={px(19)} /></Pressable>
      </View>
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
      <View style={[styles.safe, { backgroundColor: palette.background }]}>
        {stickyOverview}
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" style={styles.rosterScroll}>
          {sections.length === 0 ? empty : sections.map((section) => (
            <View key={section.title}>
              <Text style={[styles.sectionLetter, { color: palette.secondaryText }]}>{section.title}</Text>
              {section.data.map((item) => <MemberRow item={item} key={item.id} ministry={locale === "uk" ? item.ministryUk : item.ministry} onPress={() => router.push(`/members/${item.id}` as never)} />)}
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
        renderItem={({ item }) => <MemberRow item={item} ministry={locale === "uk" ? item.ministryUk : item.ministry} onPress={() => router.push(`/members/${item.id}` as never)} />}
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
    zIndex: 2,
  },
  titleRow: { paddingHorizontal: px(20), paddingTop: px(22) },
  title: { color: "#292D31", fontSize: px(48), fontWeight: "800", letterSpacing: px(-1.7), lineHeight: px(56) },
  pressed: { opacity: 0.68, transform: [{ scale: 0.985 }] },
  searchField: { alignItems: "center", borderRadius: px(14), flexDirection: "row", marginHorizontal: px(20), marginTop: px(12), minHeight: px(44), paddingHorizontal: px(17) },
  searchIcon: { marginRight: px(13) },
  searchInput: { color: "#22262A", flex: 1, fontSize: px(14), paddingVertical: px(12) },
  filterButton: { alignItems: "center", justifyContent: "center", minHeight: px(36), minWidth: px(36) },
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
  avatar: { borderRadius: px(36), height: px(72), width: px(72) },
  memberCopy: { flex: 1, marginLeft: px(5) },
  memberName: { color: "#090F19", fontSize: px(18), fontWeight: "600", letterSpacing: px(0.3) },
  memberMinistry: { color: "#737477", fontSize: px(16), marginTop: px(2) },
  memberPhone: { fontSize: px(14), marginTop: px(2) },
  specialBadge: { alignSelf: "flex-start", borderRadius: px(8), marginTop: px(4), paddingHorizontal: px(7), paddingVertical: px(2) },
  specialBadgeText: { fontSize: px(12), fontWeight: "700" },
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
