import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { useSession } from "@/features/session/SessionProvider";
import { DeaconProfileRow } from "./deacon-profile-row";
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
          : <View style={styles.list}>{filtered.map((group) => <GroupRow group={group} key={group.id} locale={locale} onPress={() => openGroup(group)} />)}</View>}
  </ScrollView>;
}

function GroupRow({ featured = false, group, locale, onPress }: { featured?: boolean; group: MinistryGroup; locale: "en" | "uk"; onPress: () => void }) {
  const { palette } = useAppearance();
  const router = useRouter();
  const copy = getGroupsCopy(locale);
  const name = locale === "uk" ? group.nameUk : group.name;
  const description = locale === "uk" ? group.descriptionUk : group.description;
  const deacons = group.responsibleDeacons ?? [];

  return <View style={[styles.groupCard, { backgroundColor: featured ? palette.accentSoft : palette.surface, borderColor: palette.line }]}>
    <Pressable accessibilityHint={copy.openGroup} accessibilityLabel={`${name}, ${copy.memberCount(group.memberIds.length)}`} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.groupHeader, featured && styles.featuredHeader, pressed && styles.pressed]}>
      <View style={[featured ? styles.featuredIcon : styles.rowIcon, { backgroundColor: featured ? palette.accent : palette.subtle }]}>
        <Ionicons accessibilityElementsHidden color={featured ? "#FFF" : palette.accent} name={featured ? "people" : "people-outline"} size={featured ? 25 : 20} />
      </View>
      <View style={styles.cardCopy}>
        <Text selectable numberOfLines={2} style={[featured ? styles.featuredName : styles.groupName, { color: palette.text }]}>{name}</Text>
        {description ? <Text selectable numberOfLines={2} style={[styles.description, { color: palette.secondaryText }]}>{description}</Text> : null}
        <Text selectable style={[styles.meta, { color: featured ? palette.accent : palette.secondaryText }]}>{copy.memberCount(group.memberIds.length)}</Text>
      </View>
      <Ionicons accessibilityElementsHidden color={featured ? palette.accent : palette.secondaryText} name="chevron-forward" size={featured ? 24 : 20} />
    </Pressable>
    <View style={[styles.deaconSection, { borderTopColor: palette.line }]}>
      <Text accessibilityRole="header" selectable style={[styles.deaconHeading, { color: palette.secondaryText }]}>{copy.responsibleDeacons}</Text>
      {deacons.length ? <View style={[styles.deaconList, { backgroundColor: featured ? palette.elevated : palette.subtle }]}>
        {deacons.map((deacon, index) => <DeaconProfileRow accessibilityHint={copy.openDeaconProfile} deacon={deacon} key={deacon.id} roleLabel={copy.deacon} last={index === deacons.length - 1} onPress={() => router.push({ pathname: "/(directory)/members/[memberId]", params: { memberId: deacon.id } })} />)}
      </View> : <Text selectable style={[styles.noDeacons, { color: palette.secondaryText }]}>{copy.noDeaconsAssigned}</Text>}
    </View>
  </View>;
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
  groupCard: { borderCurve: "continuous", borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  groupHeader: { alignItems: "center", flexDirection: "row", gap: 12, minHeight: 80, paddingHorizontal: 14, paddingVertical: 12 },
  featuredHeader: { minHeight: 112, padding: 18 },
  featuredIcon: { alignItems: "center", borderRadius: 24, height: 48, justifyContent: "center", width: 48 },
  featuredName: { fontSize: 23, fontWeight: "800", letterSpacing: -.35 },
  browseHeading: { gap: 10 },
  search: { alignItems: "center", borderCurve: "continuous", borderRadius: 14, flexDirection: "row", gap: 10, minHeight: 46, paddingHorizontal: 14 },
  input: { flex: 1, fontSize: 16, paddingVertical: 11 },
  list: { gap: 12 },
  rowIcon: { alignItems: "center", borderRadius: 20, height: 40, justifyContent: "center", width: 40 },
  pressed: { opacity: .65 },
  cardCopy: { flex: 1, gap: 3 },
  groupName: { fontSize: 17, fontWeight: "700" },
  description: { fontSize: 14, lineHeight: 18 },
  meta: { fontSize: 13, fontWeight: "700", marginTop: 2 },
  deaconSection: { borderTopWidth: StyleSheet.hairlineWidth, gap: 8, paddingHorizontal: 12, paddingVertical: 12 },
  deaconHeading: { fontSize: 13, fontWeight: "700", paddingHorizontal: 2, textTransform: "uppercase" },
  deaconList: { borderCurve: "continuous", borderRadius: 12, overflow: "hidden" },
  noDeacons: { fontSize: 14, lineHeight: 20, paddingHorizontal: 2, paddingBottom: 2 },
  state: { alignItems: "center", gap: 9, paddingHorizontal: 28, paddingTop: 36 },
  stateTitle: { fontSize: 19, fontWeight: "700", textAlign: "center" },
  stateDetail: { fontSize: 15, textAlign: "center" },
  retry: { borderCurve: "continuous", borderRadius: 12, marginTop: 8, paddingHorizontal: 18, paddingVertical: 11 },
  retryText: { color: "#FFF", fontWeight: "700" },
});
