import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { useSession } from "@/features/session/SessionProvider";
import { ProfileAvatar } from "@/features/members/ProfileAvatar";
import { getGroupsCopy } from "./groups-copy";
import { partitionGroups } from "./groups-display";
import { groupsRepository, type MinistryGroup } from "./groups-repository";

type LoadState = "loading" | "error" | "ready";

export function GroupsScreen() {
  const router = useRouter();
  const { palette } = useAppearance();
  const { locale } = useLocalization();
  const session = useSession();
  const copy = getGroupsCopy(locale);
  const [groups, setGroups] = useState<MinistryGroup[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [query, setQuery] = useState("");

  const load = () => {
    setState("loading");
    void groupsRepository.listGroups().then(setGroups).then(() => setState("ready")).catch(() => setState("error"));
  };

  useEffect(load, []);

  const account = session.status === "ready" ? session.account : null;
  const isDeacon = account?.designation === "deacon";
  const { assigned, others } = useMemo(
    () => partitionGroups(groups, isDeacon ? account.id : undefined),
    [account?.id, groups, isDeacon],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale);
    return others.filter((group) => !needle || `${group.name} ${group.nameUk}`.toLocaleLowerCase(locale).includes(needle));
  }, [locale, others, query]);

  const openGroup = (group: MinistryGroup) => router.push({ pathname: "/groups/[groupId]", params: { groupId: group.id } });

  return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.screen} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" style={{ backgroundColor: palette.background }}>
    <Text accessibilityRole="header" selectable style={[styles.title, { color: palette.text }]}>{copy.title}</Text>

    {state === "ready" && assigned ? <View style={styles.featuredSection}>
      <Text selectable style={[styles.sectionLabel, { color: palette.text }]}>{copy.myGroup}</Text>
      <GroupRow featured group={assigned} locale={locale} onPress={() => openGroup(assigned)} />
    </View> : null}

    {state === "ready" ? <View style={styles.browseHeading}>
      <Text selectable style={[styles.sectionLabel, { color: palette.text }]}>{assigned ? copy.otherGroups : copy.allGroups}</Text>
      <View style={[styles.search, { backgroundColor: palette.subtle }]}>
        <Ionicons accessibilityElementsHidden color={palette.secondaryText} name="search-outline" size={20} />
        <TextInput accessibilityLabel={copy.search} autoCapitalize="none" clearButtonMode="while-editing" onChangeText={setQuery} placeholder={copy.search} placeholderTextColor={palette.secondaryText} returnKeyType="search" style={[styles.input, { color: palette.text }]} value={query} />
      </View>
    </View> : null}

    {state === "loading" ? <State icon="sync-outline" title={copy.loading} />
      : state === "error" ? <State action={load} icon="cloud-offline-outline" title={copy.error} actionLabel={copy.retry} />
        : filtered.length === 0 ? <State icon="people-outline" title={assigned && !query.trim() ? copy.noOtherGroups : copy.noGroups} detail={assigned && !query.trim() ? copy.noOtherGroupsDetail : copy.noGroupsDetail} />
          : <View style={[styles.list, { backgroundColor: palette.surface, borderColor: palette.line }]}>{filtered.map((group, index) => <GroupRow group={group} key={group.id} last={index === filtered.length - 1} locale={locale} onPress={() => openGroup(group)} />)}</View>}
  </ScrollView>;
}

function GroupRow({ featured = false, group, last = false, locale, onPress }: { featured?: boolean; group: MinistryGroup; last?: boolean; locale: "en" | "uk"; onPress: () => void }) {
  const { palette } = useAppearance();
  const copy = getGroupsCopy(locale);
  const name = locale === "uk" ? group.nameUk : group.name;
  const description = locale === "uk" ? group.descriptionUk : group.description;

  const deaconNames = group.responsibleDeacons?.map((deacon) => deacon.name).join(", ") ?? "";

  return <Pressable accessibilityHint={copy.openGroup} accessibilityLabel={`${name}, ${copy.memberCount(group.memberIds.length)}${deaconNames ? `, ${copy.responsibleDeacons}: ${deaconNames}` : ""}`} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [featured ? styles.featuredCard : styles.row, featured ? { backgroundColor: palette.accentSoft } : !last && { borderBottomColor: palette.line, borderBottomWidth: StyleSheet.hairlineWidth }, pressed && styles.pressed]}>
    <View style={[featured ? styles.featuredIcon : styles.rowIcon, { backgroundColor: featured ? palette.accent : palette.subtle }]}>
      <Ionicons accessibilityElementsHidden color={featured ? "#FFF" : palette.accent} name={featured ? "people" : "people-outline"} size={featured ? 25 : 20} />
    </View>
    <View style={styles.cardCopy}>
      <Text selectable numberOfLines={2} style={[featured ? styles.featuredName : styles.groupName, { color: palette.text }]}>{name}</Text>
      {description ? <Text selectable numberOfLines={2} style={[styles.description, { color: palette.secondaryText }]}>{description}</Text> : null}
      <Text selectable style={[styles.meta, { color: featured ? palette.accent : palette.secondaryText }]}>{copy.memberCount(group.memberIds.length)}</Text>
      {group.responsibleDeacons?.length ? <View style={styles.deacons}><View style={styles.deaconAvatars}>{group.responsibleDeacons.slice(0, 2).map((deacon) => <ProfileAvatar backgroundColor={palette.subtle} key={deacon.id} name={deacon.name} source={deacon.photo} size={24} textColor={palette.accent} />)}</View><Text selectable numberOfLines={2} style={[styles.deaconNames, { color: palette.secondaryText }]}>{copy.responsibleDeacons}: {deaconNames}</Text></View> : null}
    </View>
    <Ionicons accessibilityElementsHidden color={featured ? palette.accent : palette.secondaryText} name="chevron-forward" size={featured ? 24 : 20} />
  </Pressable>;
}

export function State({ action, actionLabel, detail, icon, title }: { action?: () => void; actionLabel?: string; detail?: string; icon: "sync-outline" | "cloud-offline-outline" | "people-outline"; title: string }) {
  const { palette } = useAppearance();
  return <View accessibilityLiveRegion="polite" style={styles.state}>
    {icon === "sync-outline" ? <ActivityIndicator color={palette.accent} /> : <Ionicons accessibilityElementsHidden color={palette.secondaryText} name={icon} size={28} />}
    <Text selectable style={[styles.stateTitle, { color: palette.text }]}>{title}</Text>
    {detail ? <Text selectable style={[styles.stateDetail, { color: palette.secondaryText }]}>{detail}</Text> : null}
    {action ? <Pressable accessibilityRole="button" onPress={action} style={[styles.retry, { backgroundColor: palette.accent }]}><Text style={styles.retryText}>{actionLabel}</Text></Pressable> : null}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, gap: 22, padding: 20, paddingBottom: 110 },
  title: { fontSize: 36, fontWeight: "800", letterSpacing: -1 },
  featuredSection: { gap: 9 },
  sectionLabel: { fontSize: 20, fontWeight: "800", letterSpacing: -.25 },
  featuredCard: { alignItems: "center", borderCurve: "continuous", borderRadius: 16, flexDirection: "row", gap: 14, minHeight: 126, padding: 18 },
  featuredIcon: { alignItems: "center", borderRadius: 24, height: 48, justifyContent: "center", width: 48 },
  featuredName: { fontSize: 23, fontWeight: "800", letterSpacing: -.35 },
  browseHeading: { gap: 10 },
  search: { alignItems: "center", borderCurve: "continuous", borderRadius: 14, flexDirection: "row", gap: 10, minHeight: 46, paddingHorizontal: 14 },
  input: { flex: 1, fontSize: 16, paddingVertical: 11 },
  list: { borderCurve: "continuous", borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  row: { alignItems: "center", flexDirection: "row", gap: 12, minHeight: 76, paddingHorizontal: 14, paddingVertical: 10 },
  rowIcon: { alignItems: "center", borderRadius: 20, height: 40, justifyContent: "center", width: 40 },
  pressed: { opacity: .65 },
  cardCopy: { flex: 1, gap: 3 },
  groupName: { fontSize: 17, fontWeight: "700" },
  description: { fontSize: 14, lineHeight: 18 },
  meta: { fontSize: 13, fontWeight: "700", marginTop: 2 },
  deacons: { alignItems: "center", flexDirection: "row", gap: 7, marginTop: 4 },
  deaconAvatars: { flexDirection: "row", gap: 3 },
  deaconNames: { flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 16 },
  state: { alignItems: "center", gap: 9, paddingHorizontal: 28, paddingTop: 36 },
  stateTitle: { fontSize: 19, fontWeight: "700", textAlign: "center" },
  stateDetail: { fontSize: 15, textAlign: "center" },
  retry: { borderCurve: "continuous", borderRadius: 12, marginTop: 8, paddingHorizontal: 18, paddingVertical: 11 },
  retryText: { color: "#FFF", fontWeight: "700" },
});
