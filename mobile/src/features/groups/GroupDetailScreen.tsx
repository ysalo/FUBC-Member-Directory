import { Text, TextInput } from "@/features/accessibility/app-text";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";

import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { CareStatusBadges } from "@/features/members/care-status-badges";
import { ProfileAvatar } from "@/features/members/ProfileAvatar";
import { LeadershipBadge } from "@/features/members/leadership-badge";
import { useSession } from "@/features/session/SessionProvider";
import { disableBirthdayNotifications, syncBirthdayNotifications } from "./birthday-notifications";
import { upcomingBirthdays } from "./birthday-notification-plan";
import { getGroupsCopy } from "./groups-copy";
import { groupsRepository, type AuthorizedBirthday, type GroupDetail, type GroupMember, type GroupSummary } from "./groups-repository";

export function GroupDetailScreen({ groupId }: { groupId: string }) {
  const router = useRouter();
  const { locale } = useLocalization();
  const copy = getGroupsCopy(locale);
  const session = useSession();
  const { palette } = useAppearance();
  const account = session.status === "ready" ? session.account : null;
  const [group, setGroup] = useState<GroupDetail | null | undefined>(undefined);
  const [birthdays, setBirthdays] = useState<AuthorizedBirthday[]>([]);
  const [summary, setSummary] = useState<GroupSummary>({ total: 0, orphans: 0, widows: 0 });
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");

  const assignedDeacon = Boolean(group && account?.designation === "deacon" && group.responsibleDeaconIds.includes(account.id));
  const upcoming = useMemo(() => upcomingBirthdays(birthdays), [birthdays]);
  const filteredMembers = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale);
    if (!group || !needle) return group?.members ?? [];
    return group.members.filter((member) => member.name.toLocaleLowerCase(locale).includes(needle));
  }, [group, locale, query]);

  const load = () => {
    setGroup(undefined);
    setFailed(false);
    setNotificationError(null);
    void groupsRepository.getGroup(groupId).then(async (nextGroup) => {
      if (!nextGroup) { setGroup(null); return; }
      const mayManageBirthdays = account?.designation === "deacon" && nextGroup.responsibleDeaconIds.includes(account.id);
      const [nextSummary, nextBirthdays, nextSetting] = await Promise.all([
        groupsRepository.getSummary(groupId),
        mayManageBirthdays ? groupsRepository.getAuthorizedBirthdays(groupId) : Promise.resolve([]),
        mayManageBirthdays ? groupsRepository.getBirthdayNotificationsEnabled(groupId) : Promise.resolve(false),
      ]);
      setGroup(nextGroup);
      setSummary(nextSummary);
      setBirthdays(nextBirthdays);
      setNotificationsEnabled(nextSetting);
      if (mayManageBirthdays && nextSetting) {
        void syncBirthdayNotifications(groupId, nextBirthdays, locale, false).catch((cause) => setNotificationError(cause instanceof Error ? cause.message : copy.notificationError));
      }
    }).catch(() => { setFailed(true); setGroup(null); });
  };

  useEffect(load, [account?.designation, account?.id, groupId, locale]);

  async function toggleBirthdayNotifications(enabled: boolean) {
    if (!assignedDeacon || notificationBusy) return;
    setNotificationBusy(true);
    setNotificationError(null);
    try {
      if (enabled) {
        await syncBirthdayNotifications(groupId, birthdays, locale, true);
        try { await groupsRepository.setBirthdayNotificationsEnabled(groupId, true); }
        catch (cause) { await disableBirthdayNotifications(groupId); throw cause; }
      } else {
        await disableBirthdayNotifications(groupId);
        try { await groupsRepository.setBirthdayNotificationsEnabled(groupId, false); }
        catch (cause) { await syncBirthdayNotifications(groupId, birthdays, locale, false); throw cause; }
      }
      setNotificationsEnabled(enabled);
    } catch (cause) {
      setNotificationError(cause instanceof Error ? cause.message : copy.notificationError);
    } finally {
      setNotificationBusy(false);
    }
  }

  if (group === undefined) return <View style={[styles.state, { backgroundColor: palette.background }]}><ActivityIndicator color={palette.accent} /><Text selectable style={[styles.stateText, { color: palette.text }]}>{copy.loading}</Text></View>;
  if (!group || failed) return <View style={[styles.state, { backgroundColor: palette.background }]}><Ionicons color={palette.secondaryText} name="people-outline" size={30} /><Text selectable style={[styles.stateText, { color: palette.text }]}>{failed ? copy.error : copy.unavailable}</Text><Text selectable style={[styles.stateDetail, { color: palette.secondaryText }]}>{failed ? "" : copy.unavailableDetail}</Text>{failed ? <Pressable accessibilityRole="button" onPress={load} style={[styles.retry, { backgroundColor: palette.accent }]}><Text style={styles.retryText}>{copy.retry}</Text></Pressable> : null}</View>;

  const deacons = group.responsibleDeacons ?? [];
  return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[styles.screen, { backgroundColor: palette.background }]} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" stickyHeaderIndices={[1]} style={{ backgroundColor: palette.background }}>
    <View style={styles.topContent}>
      <Pressable accessibilityRole="button" accessibilityLabel={copy.back} onPress={() => router.back()} style={styles.back}><Ionicons accessibilityElementsHidden color={palette.accent} name="chevron-back" size={19} /><Text style={[styles.backText, { color: palette.accent }]}>{copy.back}</Text></Pressable>
      <View style={styles.header}><Text accessibilityRole="header" selectable style={[styles.title, { color: palette.text }]}>{locale === "uk" ? group.nameUk : group.name}</Text>{assignedDeacon ? <View style={[styles.myGroupBadge, { backgroundColor: palette.accentSoft }]}><Ionicons accessibilityElementsHidden color={palette.accent} name="people" size={15} /><Text selectable style={[styles.myGroupText, { color: palette.accent }]}>{copy.myGroup}</Text></View> : null}</View>
      <Section title={copy.responsibleDeacons}>{deacons.length ? deacons.map((member) => <PersonRow key={member.id} leader locale={locale} member={member} onPress={() => router.push(`/members/${member.id}` as never)} />) : <Text selectable style={[styles.empty, { color: palette.secondaryText }]}>{copy.noDeacons}</Text>}</Section>
      {assignedDeacon ? <Section title={copy.birthdays}>
        <View style={[styles.notificationRow, { borderBottomColor: palette.line }]}><View style={styles.notificationCopy}><Text selectable style={[styles.notificationTitle, { color: palette.text }]}>{copy.birthdayNotifications}</Text><Text selectable style={[styles.personDetail, { color: palette.secondaryText }]}>{copy.birthdayNotificationDetail}</Text></View>{notificationBusy ? <ActivityIndicator color={palette.accent} /> : <Switch accessibilityLabel={copy.birthdayNotifications} ios_backgroundColor={palette.line} onValueChange={(enabled) => void toggleBirthdayNotifications(enabled)} thumbColor="#FFFFFF" trackColor={{ false: palette.line, true: palette.accent }} value={notificationsEnabled} />}</View>
        {notificationError ? <Text accessibilityLiveRegion="polite" selectable style={[styles.notificationError, { color: palette.accent }]}>{notificationError}</Text> : null}
        {upcoming.length ? upcoming.map((member) => <PersonRow key={member.id} locale={locale} member={member} detail={formatBirthday(member.month, member.day, locale)} onPress={() => router.push(`/members/${member.id}` as never)} />) : <Text selectable style={[styles.empty, { color: palette.secondaryText }]}>{copy.noUpcomingBirthdays}</Text>}
      </Section> : null}
    </View>
    <View style={[styles.stickySearch, { backgroundColor: palette.background }]}><View style={[styles.search, { backgroundColor: palette.subtle }]}><Ionicons accessibilityElementsHidden color={palette.secondaryText} name="search-outline" size={20} /><TextInput accessibilityLabel={copy.searchMembers} autoCapitalize="none" clearButtonMode="while-editing" onChangeText={setQuery} placeholder={copy.searchMembers} placeholderTextColor={palette.secondaryText} returnKeyType="search" style={[styles.searchInput, { color: palette.text }]} value={query} /></View></View>
    <Section title={`${copy.members} (${filteredMembers.length})`}>{filteredMembers.length ? filteredMembers.map((member) => <PersonRow key={member.id} locale={locale} member={member} onPress={() => router.push(`/members/${member.id}` as never)} />) : <Text selectable style={[styles.empty, { color: palette.secondaryText }]}>{query.trim() ? copy.noMatchingMembers : copy.noMembers}</Text>}</Section>
    <Text accessibilityRole="summary" selectable style={[styles.summary, { color: palette.secondaryText }]}>{copy.summary(summary.total || group.members.length, summary.orphans, summary.widows)}</Text>
  </ScrollView>;
}

function formatBirthday(month: number, day: number, locale: "en" | "uk") {
  return new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-US", { month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(2000, month - 1, day)));
}

function Section({ children, title }: { children: React.ReactNode; title: string }) { const { palette } = useAppearance(); return <View style={styles.section}><Text accessibilityRole="header" selectable style={[styles.sectionTitle, { color: palette.text }]}>{title}</Text><View style={[styles.sectionCard, { backgroundColor: palette.surface, borderColor: palette.line }]}>{children}</View></View>; }
function PersonRow({ detail, leader = false, locale, member, onPress }: { detail?: string; leader?: boolean; locale: "en" | "uk"; member: Pick<GroupMember, "id" | "name" | "photo" | "designation" | "isOrphan" | "isWidow">; onPress: () => void }) { const { palette } = useAppearance(); return <Pressable accessibilityHint="Opens member profile" accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.person, leader && styles.leaderPerson, { borderBottomColor: palette.line }, pressed && styles.pressed]}><ProfileAvatar backgroundColor={leader ? palette.accentSoft : palette.subtle} name={member.name} source={member.photo} textColor={leader ? palette.accent : palette.text} /><View style={styles.personCopy}><Text selectable style={[styles.personName, { color: palette.text }]}>{member.name}</Text>{detail ? <Text selectable style={[styles.personDetail, { color: palette.secondaryText }]}>{detail}</Text> : null}{member.designation ? <LeadershipBadge designation={member.designation} locale={locale} /> : null}<CareStatusBadges isOrphan={member.isOrphan} isWidow={member.isWidow} /></View><Ionicons accessibilityElementsHidden color={palette.accent} name="chevron-forward" size={18} /></Pressable>; }

const styles = StyleSheet.create({
  screen: { flexGrow: 1, gap: 18, padding: 20, paddingBottom: 110 },
  topContent: { gap: 18 },
  back: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", minHeight: 32 },
  backText: { fontSize: 16, fontWeight: "600" },
  header: { gap: 3 },
  title: { fontSize: 30, fontWeight: "800", letterSpacing: -.6 },
  myGroupBadge: { alignItems: "center", alignSelf: "flex-start", borderRadius: 10, flexDirection: "row", gap: 6, marginTop: 5, paddingHorizontal: 10, paddingVertical: 6 },
  myGroupText: { fontSize: 13, fontWeight: "800" },
  section: { gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  sectionCard: { borderCurve: "continuous", borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  stickySearch: { marginHorizontal: -20, paddingBottom: 10, paddingHorizontal: 20, paddingTop: 2, zIndex: 2 },
  search: { alignItems: "center", borderCurve: "continuous", borderRadius: 14, flexDirection: "row", gap: 10, minHeight: 46, paddingHorizontal: 14 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 11 },
  person: { alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 11, minHeight: 62, paddingHorizontal: 14, paddingVertical: 9 },
  pressed: { opacity: .7 },
  leaderPerson: { backgroundColor: "rgba(255,255,255,0.025)" },
  avatar: { alignItems: "center", borderRadius: 19, height: 38, justifyContent: "center", width: 38 },
  avatarText: { fontSize: 16, fontWeight: "700" },
  personCopy: { flex: 1 },
  personName: { fontSize: 16, fontWeight: "600" },
  personDetail: { fontSize: 14, marginTop: 2 },
  notificationRow: { alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 12, minHeight: 70, paddingHorizontal: 14, paddingVertical: 10 },
  notificationCopy: { flex: 1 },
  notificationTitle: { fontSize: 16, fontWeight: "700" },
  notificationError: { fontSize: 13, lineHeight: 18, paddingHorizontal: 14, paddingTop: 10 },
  summary: { fontSize: 14, fontWeight: "600", paddingBottom: 16, textAlign: "center" },
  empty: { padding: 14 },
  state: { alignItems: "center", flex: 1, gap: 10, justifyContent: "center", padding: 30 },
  stateText: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  stateDetail: { textAlign: "center" },
  retry: { borderCurve: "continuous", borderRadius: 12, paddingHorizontal: 18, paddingVertical: 11 },
  retryText: { color: "#FFF", fontWeight: "700" },
});
