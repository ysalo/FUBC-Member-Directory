import { Text } from "@/features/accessibility/app-text";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { type Href, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from "react-native";

import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { withTimeout } from "@/lib/async-state";
import { managementRepository } from "./management-repository";
import type { GroupManagementState } from "./model";

const labels = {
  en: { loading: "Loading groups…", error: "Groups could not be loaded.", retry: "Try again", empty: "No active groups", add: "Add group", memberCount: (count: number) => `${count} members`, deaconCount: (count: number) => `${count} of 2 deacons` },
  uk: { loading: "Завантаження груп…", error: "Не вдалося завантажити групи.", retry: "Спробувати ще раз", empty: "Немає активних груп", add: "Додати групу", memberCount: (count: number) => `${count} учасників`, deaconCount: (count: number) => `${count} з 2 дияконів` },
} as const;

export function GroupsManagementScreen() {
  const router = useRouter();
  const { palette } = useAppearance();
  const { locale } = useLocalization();
  const copy = labels[locale];
  const [data, setData] = useState<GroupManagementState | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => { setFailed(false); void withTimeout(managementRepository.loadGroupManagement()).then(setData).catch(() => setFailed(true)); }, []);
  useFocusEffect(load);

  if (!data) return <View style={[styles.state, { backgroundColor: palette.background }]}>{failed ? <><Ionicons color={palette.secondaryText} name="cloud-offline-outline" size={28} /><Text selectable style={[styles.stateTitle, { color: palette.text }]}>{copy.error}</Text><Pressable accessibilityRole="button" onPress={load} style={[styles.retry, { backgroundColor: palette.accent }]}><Text style={styles.retryText}>{copy.retry}</Text></Pressable></> : <><ActivityIndicator color={palette.accent} /><Text selectable style={{ color: palette.secondaryText }}>{copy.loading}</Text></>}</View>;

  return <FlatList contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content} data={data.groups} keyExtractor={(group) => group.id} ListHeaderComponent={<Pressable accessibilityRole="button" onPress={() => router.push("/manage/group/new" as Href)} style={({ pressed }) => [styles.add, { backgroundColor: palette.accent }, pressed && styles.pressed]}><Ionicons color="#FFF" name="add-circle-outline" size={22} /><Text style={styles.addText}>{copy.add}</Text></Pressable>} ListEmptyComponent={<Text selectable style={[styles.empty, { color: palette.secondaryText }]}>{copy.empty}</Text>} renderItem={({ item }) => <Pressable accessibilityRole="button" onPress={() => router.push(`/manage/group/${item.id}` as Href)} style={({ pressed }) => [styles.row, { backgroundColor: palette.surface, borderColor: palette.line }, pressed && styles.pressed]}><View style={styles.copy}><Text selectable style={[styles.name, { color: palette.text }]}>{item.name}</Text><Text selectable style={[styles.detail, { color: palette.secondaryText }]}>{copy.memberCount(item.memberIds.length)} · {copy.deaconCount(item.deaconIds.length)}</Text></View><Ionicons color={palette.secondaryText} name="chevron-forward" size={20} /></Pressable>} style={{ backgroundColor: palette.background }} />;
}

const styles = StyleSheet.create({ content: { gap: 10, padding: 18, paddingBottom: 48 }, add: { alignItems: "center", borderCurve: "continuous", borderRadius: 14, flexDirection: "row", gap: 8, justifyContent: "center", marginBottom: 4, minHeight: 50 }, addText: { color: "#FFF", fontSize: 16, fontWeight: "800" }, row: { alignItems: "center", borderCurve: "continuous", borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", minHeight: 70, padding: 16 }, copy: { flex: 1, gap: 4 }, name: { fontSize: 18, fontWeight: "700" }, detail: { fontSize: 14 }, pressed: { opacity: 0.72 }, empty: { paddingTop: 40, textAlign: "center" }, state: { alignItems: "center", flex: 1, gap: 10, justifyContent: "center", padding: 28 }, stateTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" }, retry: { borderCurve: "continuous", borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 }, retryText: { color: "#FFF", fontWeight: "700" } });
