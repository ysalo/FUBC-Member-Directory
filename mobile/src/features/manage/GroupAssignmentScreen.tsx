import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { withTimeout } from "@/lib/async-state";
import { ProfileAvatar } from "@/features/members/ProfileAvatar";
import { managementRepository } from "./management-repository";
import type { GroupManagementState } from "./model";

const labels = {
  en: { deacons: "Responsible deacons", detail: "Choose up to two. A deacon can lead one group only.", save: "Save assignments", saving: "Saving…", loading: "Loading group…", unavailable: "This group is unavailable.", none: "No linked active deacons are available.", assigned: "Assigned to this group", unassigned: "Not assigned", other: "Currently assigned to", limit: "A group can have at most two deacons.", moveTitle: "Move deacons?", moveDetail: (names: string, group: string) => `${names} will be moved from ${group} to this group.`, moveMultiple: (names: string) => `${names} will be moved from their current groups to this group.`, cancel: "Cancel", move: "Move and save", failed: "Assignments could not be saved. Reload and try again." },
  uk: { deacons: "Відповідальні диякони", detail: "Оберіть не більше двох. Диякон може відповідати лише за одну групу.", save: "Зберегти призначення", saving: "Збереження…", loading: "Завантаження групи…", unavailable: "Ця група недоступна.", none: "Немає активних дияконів із пов’язаним профілем.", assigned: "Призначено до цієї групи", unassigned: "Не призначено", other: "Зараз призначено до", limit: "У групі може бути не більше двох дияконів.", moveTitle: "Перемістити дияконів?", moveDetail: (names: string, group: string) => `${names} буде переміщено з групи «${group}» до цієї групи.`, moveMultiple: (names: string) => `${names} буде переміщено з поточних груп до цієї групи.`, cancel: "Скасувати", move: "Перемістити й зберегти", failed: "Не вдалося зберегти призначення. Оновіть дані й спробуйте ще раз." },
} as const;

export function GroupAssignmentScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const { palette } = useAppearance();
  const { locale } = useLocalization();
  const copy = labels[locale];
  const [data, setData] = useState<GroupManagementState | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void withTimeout(managementRepository.loadGroupManagement()).then((next) => { setData(next); setSelected(next.groups.find((group) => group.id === groupId)?.deaconIds ?? []); }).catch(() => setError(copy.unavailable)); }, [copy.unavailable, groupId]);
  const group = data?.groups.find((candidate) => candidate.id === groupId);
  const moves = useMemo(() => data?.deacons.filter((deacon) => selected.includes(deacon.accountId) && deacon.currentGroupId && deacon.currentGroupId !== groupId) ?? [], [data, groupId, selected]);

  function toggle(accountId: string) {
    setError(null);
    setSelected((current) => {
      if (current.includes(accountId)) return current.filter((id) => id !== accountId);
      if (current.length >= 2) { setError(copy.limit); return current; }
      return [...current, accountId];
    });
  }
  async function persist() {
    if (!group || busy) return;
    setBusy(true); setError(null);
    try {
      await managementRepository.saveGroup({ p_id: group.id, p_revision: group.revision, p_name: group.name, p_kind: group.kind, p_archived: false, p_deacon_ids: selected, p_member_ids: group.memberIds });
      router.back();
    } catch (cause) { setError(cause instanceof Error ? cause.message : copy.failed); setBusy(false); }
  }
  function confirmSave() {
    if (!moves.length) { void persist(); return; }
    const names = moves.map((deacon) => deacon.name).join(", ");
    const priorGroups = [...new Set(moves.map((deacon) => data?.groups.find((candidate) => candidate.id === deacon.currentGroupId)?.name).filter(Boolean))] as string[];
    Alert.alert(copy.moveTitle, priorGroups.length === 1 ? copy.moveDetail(names, priorGroups[0]) : copy.moveMultiple(names), [{ text: copy.cancel, style: "cancel" }, { text: copy.move, onPress: () => void persist() }]);
  }

  if (!data && !error) return <View style={[styles.state, { backgroundColor: palette.background }]}><ActivityIndicator color={palette.accent} /><Text selectable style={{ color: palette.secondaryText }}>{copy.loading}</Text></View>;
  if (!group) return <View style={[styles.state, { backgroundColor: palette.background }]}><Text selectable style={[styles.stateTitle, { color: palette.text }]}>{error ?? copy.unavailable}</Text></View>;
  const loaded = data!;
  return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" style={{ backgroundColor: palette.background }}><Text accessibilityRole="header" selectable style={[styles.title, { color: palette.text }]}>{group.name}</Text><Text selectable style={[styles.sectionTitle, { color: palette.text }]}>{copy.deacons}</Text><Text selectable style={[styles.detail, { color: palette.secondaryText }]}>{copy.detail}</Text>{error ? <Text accessibilityLiveRegion="polite" selectable style={[styles.error, { color: palette.accent }]}>{error}</Text> : null}<View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.line }]}>{loaded.deacons.length ? loaded.deacons.map((deacon, index) => { const checked = selected.includes(deacon.accountId); const currentGroup = loaded.groups.find((candidate) => candidate.id === deacon.currentGroupId); const status = checked ? copy.assigned : currentGroup ? `${copy.other} ${currentGroup.name}` : copy.unassigned; return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked, disabled: busy }} disabled={busy} key={deacon.accountId} onPress={() => toggle(deacon.accountId)} style={[styles.row, index < loaded.deacons.length - 1 && { borderBottomColor: palette.line, borderBottomWidth: StyleSheet.hairlineWidth }]}><ProfileAvatar backgroundColor={checked ? palette.accentSoft : palette.subtle} name={deacon.name} source={deacon.photo} textColor={checked ? palette.accent : palette.text} /><View style={styles.rowCopy}><Text selectable style={[styles.name, { color: palette.text }]}>{deacon.name}</Text><Text selectable style={[styles.rowDetail, { color: palette.secondaryText }]}>{status}</Text></View><Ionicons color={checked ? palette.accent : palette.secondaryText} name={checked ? "checkmark-circle" : "ellipse-outline"} size={24} /></Pressable>; }) : <Text selectable style={[styles.empty, { color: palette.secondaryText }]}>{copy.none}</Text>}</View><Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={confirmSave} style={[styles.save, { backgroundColor: palette.accent }, busy && styles.disabled]}>{busy ? <ActivityIndicator color="#FFF" /> : null}<Text style={styles.saveText}>{busy ? copy.saving : copy.save}</Text></Pressable></ScrollView>;
}

const styles = StyleSheet.create({ content: { gap: 10, padding: 18, paddingBottom: 48 }, title: { fontSize: 30, fontWeight: "800", letterSpacing: -0.5 }, sectionTitle: { fontSize: 19, fontWeight: "800", marginTop: 10 }, detail: { fontSize: 14, lineHeight: 20 }, error: { fontSize: 14, fontWeight: "600", lineHeight: 20 }, card: { borderCurve: "continuous", borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" }, row: { alignItems: "center", flexDirection: "row", gap: 12, minHeight: 68, padding: 12 }, rowCopy: { flex: 1, gap: 3 }, name: { fontSize: 16, fontWeight: "700" }, rowDetail: { fontSize: 13 }, empty: { padding: 16 }, save: { alignItems: "center", borderCurve: "continuous", borderRadius: 14, flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 10, minHeight: 50 }, saveText: { color: "#FFF", fontSize: 16, fontWeight: "800" }, disabled: { opacity: 0.55 }, state: { alignItems: "center", flex: 1, gap: 10, justifyContent: "center", padding: 28 }, stateTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" } });
