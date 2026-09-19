import { useDesktopLayout } from "@/features/shell/use-desktop-layout";
import { Alert } from "@/features/platform/alert";
import { Text, TextInput } from "@/features/accessibility/app-text";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Button, Host } from "@expo/ui";
import SegmentedControl from "@expo/ui/community/segmented-control";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { ProfileAvatar } from "@/features/members/ProfileAvatar";
import { withTimeout } from "@/lib/async-state";
import { managementRepository } from "./management-repository";
import type { GroupManagementState, ManagedGroup } from "./model";

const labels = {
  en: {
    name: "Group name", nameRequired: "Enter a group name.", type: "Group type", membership: "Membership", responsibility: "Care",
    typeDetail: "Membership groups organize the directory. Care groups may overlap with them.", deacons: "Responsible deacons",
    deaconDetail: "Choose up to two. A deacon can lead one group only.", members: "Group members", memberDetail: "Search and select multiple existing members.",
    selected: (count: number) => `${count} selected`, search: "Search members", save: "Save group", saving: "Saving…", loading: "Loading group…",
    unavailable: "This group is unavailable.", noDeacons: "No active deacons are available.", noMembers: "No members match your search.", assigned: "Assigned to this group",
    unassigned: "Not assigned", other: "Currently assigned to", leader: "Selected as responsible deacon", limit: "A group can have at most two deacons.",
    moveTitle: "Move existing assignments?", moveDetail: (count: number) => `${count} selected ${count === 1 ? "person is" : "people are"} assigned elsewhere and will be moved to this group.`,
    deleteSection: "Delete this group", deleteDetail: "Members will not be deleted. Their assignment to this group will simply be removed.", delete: "Delete group", deleting: "Deleting…",
    deleteTitle: (name: string) => `Delete “${name}”?`, deleteConfirm: "Delete", deleteFailed: "The group could not be deleted. Reload and try again.",
    cancel: "Cancel", move: "Move and save", failed: "The group could not be saved. Reload and try again.",
  },
  uk: {
    name: "Назва групи", nameRequired: "Введіть назву групи.", type: "Тип групи", membership: "Членська", responsibility: "Турботи",
    typeDetail: "Членські групи впорядковують каталог. Групи турботи можуть перетинатися з ними.", deacons: "Відповідальні диякони",
    deaconDetail: "Оберіть не більше двох. Диякон може відповідати лише за одну групу.", members: "Учасники групи", memberDetail: "Знайдіть і виберіть кількох наявних учасників.",
    selected: (count: number) => `Вибрано: ${count}`, search: "Пошук учасників", save: "Зберегти групу", saving: "Збереження…", loading: "Завантаження групи…",
    unavailable: "Ця група недоступна.", noDeacons: "Немає активних дияконів.", noMembers: "За пошуком учасників не знайдено.", assigned: "Призначено до цієї групи",
    unassigned: "Не призначено", other: "Зараз у групі", leader: "Вибрано відповідальним дияконом", limit: "У групі може бути не більше двох дияконів.",
    moveTitle: "Перемістити наявні призначення?", moveDetail: (count: number) => `${count} вибраних учасників уже призначено до інших груп. Їх буде переміщено до цієї групи.`,
    deleteSection: "Видалити цю групу", deleteDetail: "Учасників не буде видалено. Буде видалено лише їхнє призначення до цієї групи.", delete: "Видалити групу", deleting: "Видалення…",
    deleteTitle: (name: string) => `Видалити групу «${name}»?`, deleteConfirm: "Видалити", deleteFailed: "Не вдалося видалити групу. Оновіть дані й спробуйте ще раз.",
    cancel: "Скасувати", move: "Перемістити й зберегти", failed: "Не вдалося зберегти групу. Оновіть дані й спробуйте ще раз.",
  },
} as const;

type GroupKind = ManagedGroup["kind"];

export function GroupAssignmentScreen({ creating = false }: { creating?: boolean }) {
  const desktop = useDesktopLayout();
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const router = useRouter();
  const { palette } = useAppearance();
  const { locale } = useLocalization();
  const copy = labels[locale];
  const [data, setData] = useState<GroupManagementState | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<GroupKind>("membership");
  const [selectedDeacons, setSelectedDeacons] = useState<string[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [operation, setOperation] = useState<"saving" | "deleting" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = operation !== null;

  useEffect(() => {
    void withTimeout(managementRepository.loadGroupManagement()).then((next) => {
      const found = creating ? undefined : next.groups.find((candidate) => candidate.id === groupId);
      setData(next);
      setName(found?.name ?? "");
      setKind(found?.kind ?? "membership");
      setSelectedDeacons(found?.deaconIds ?? []);
      setSelectedMembers(found?.memberIds ?? []);
    }).catch(() => setError(copy.unavailable));
  }, [copy.unavailable, creating, groupId]);

  const group = creating ? undefined : data?.groups.find((candidate) => candidate.id === groupId);
  const targetKind = group?.kind ?? kind;
  const visibleMembers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!data) return [];
    if (!normalized) return data.members;
    return data.members.filter((member) => member.name.toLocaleLowerCase().includes(normalized));
  }, [data, query]);
  const moveCount = useMemo(() => {
    if (!data) return 0;
    const memberMoves = data.members.filter((member) => {
      if (!selectedMembers.includes(member.personId)) return false;
      const current = targetKind === "membership" ? member.currentMembershipGroupId : member.currentResponsibilityGroupId;
      return Boolean(current && current !== group?.id);
    }).length;
    const deaconMoves = data.deacons.filter((deacon) => selectedDeacons.includes(deacon.personId) && deacon.currentGroupId && deacon.currentGroupId !== group?.id).length;
    return memberMoves + deaconMoves;
  }, [data, group?.id, selectedDeacons, selectedMembers, targetKind]);

  function toggleDeacon(personId: string) {
    setError(null);
    setSelectedDeacons((current) => {
      if (current.includes(personId)) return current.filter((id) => id !== personId);
      if (current.length >= 2) { setError(copy.limit); return current; }
      setSelectedMembers((members) => members.filter((id) => id !== personId));
      return [...current, personId];
    });
  }

  function toggleMember(personId: string) {
    if (selectedDeacons.includes(personId)) return;
    setError(null);
    setSelectedMembers((current) => current.includes(personId) ? current.filter((id) => id !== personId) : [...current, personId]);
  }

  async function persist() {
    if ((!creating && !group) || busy) return;
    const nextName = name.trim();
    if (!nextName) { setError(copy.nameRequired); return; }
    setOperation("saving");
    setError(null);
    try {
      await managementRepository.saveGroup({
        p_id: group?.id ?? null,
        p_revision: group?.revision ?? null,
        p_name: nextName,
        p_kind: targetKind,
        p_archived: false,
        p_deacon_ids: selectedDeacons,
        p_member_ids: selectedMembers,
      });
      (router.canGoBack() ? router.back() : router.replace("/manage/groups"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy.failed);
      setOperation(null);
    }
  }

  function confirmSave() {
    if (!name.trim()) { setError(copy.nameRequired); return; }
    if (!moveCount) { void persist(); return; }
    Alert.alert(copy.moveTitle, copy.moveDetail(moveCount), [
      { text: copy.cancel, style: "cancel" },
      { text: copy.move, onPress: () => void persist() },
    ]);
  }

  async function removeGroup() {
    if (!group || busy) return;
    setOperation("deleting");
    setError(null);
    try {
      await managementRepository.deleteGroup(group.id, group.revision);
      (router.canGoBack() ? router.back() : router.replace("/manage/groups"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy.deleteFailed);
      setOperation(null);
    }
  }

  function confirmDelete() {
    if (!group || busy) return;
    Alert.alert(copy.deleteTitle(group.name), copy.deleteDetail, [
      { text: copy.cancel, style: "cancel" },
      { text: copy.deleteConfirm, style: "destructive", onPress: () => void removeGroup() },
    ]);
  }

  if (!data && !error) return <View style={[styles.state, { backgroundColor: palette.background }]}><ActivityIndicator color={palette.accent} /><Text selectable style={{ color: palette.secondaryText }}>{copy.loading}</Text></View>;
  if (!creating && !group) return <View style={[styles.state, { backgroundColor: palette.background }]}><Text selectable style={[styles.stateTitle, { color: palette.text }]}>{error ?? copy.unavailable}</Text></View>;
  const loaded = data!;

  return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[styles.content, desktop && styles.desktopContent]} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled" style={{ backgroundColor: palette.background }}>
    <View style={styles.field}>
      <Text style={[styles.label, { color: palette.secondaryText }]}>{copy.name}</Text>
      <TextInput accessibilityLabel={copy.name} autoCapitalize="sentences" autoCorrect={false} editable={!busy} maxLength={120} onChangeText={(value) => { setName(value); setError(null); }} returnKeyType="done" style={[styles.input, { backgroundColor: palette.surface, borderColor: error === copy.nameRequired ? palette.danger : palette.line, color: palette.text }]} value={name} />
    </View>

    {creating ? <View style={styles.field}>
      <Text style={[styles.label, { color: palette.secondaryText }]}>{copy.type}</Text>
      <SegmentedControl enabled={!busy} onValueChange={(value) => setKind(value === copy.responsibility ? "responsibility" : "membership")} selectedIndex={kind === "membership" ? 0 : 1} style={styles.segmented} values={[copy.membership, copy.responsibility]} />
      <Text selectable style={[styles.detail, { color: palette.secondaryText }]}>{copy.typeDetail}</Text>
    </View> : null}

    <View style={[styles.columns, desktop && styles.desktopColumns]}><View style={[styles.column, desktop && styles.columnDesktop]}><Text selectable style={[styles.sectionTitle, { color: palette.text }]}>{copy.deacons}</Text>
    <Text selectable style={[styles.detail, { color: palette.secondaryText }]}>{copy.deaconDetail}</Text>
    {error ? <Text accessibilityLiveRegion="polite" selectable style={[styles.error, { color: palette.danger }]}>{error}</Text> : null}
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.line }]}>
      {loaded.deacons.length ? loaded.deacons.map((deacon, index) => {
        const checked = selectedDeacons.includes(deacon.personId);
        const currentGroup = loaded.groups.find((candidate) => candidate.id === deacon.currentGroupId);
        const status = checked ? copy.assigned : currentGroup ? `${copy.other} ${currentGroup.name}` : copy.unassigned;
        return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked, disabled: busy }} disabled={busy} key={deacon.personId} onPress={() => toggleDeacon(deacon.personId)} style={[styles.row, index < loaded.deacons.length - 1 && { borderBottomColor: palette.line, borderBottomWidth: StyleSheet.hairlineWidth }]}>
          <ProfileAvatar backgroundColor={checked ? palette.accentSoft : palette.subtle} name={deacon.name} source={deacon.photo} textColor={checked ? palette.accent : palette.text} />
          <View style={styles.rowCopy}><Text selectable style={[styles.name, { color: palette.text }]}>{deacon.name}</Text><Text selectable style={[styles.rowDetail, { color: palette.secondaryText }]}>{status}</Text></View>
          <Ionicons color={checked ? palette.accent : palette.secondaryText} name={checked ? "checkmark-circle" : "ellipse-outline"} size={24} />
        </Pressable>;
      }) : <Text selectable style={[styles.empty, { color: palette.secondaryText }]}>{copy.noDeacons}</Text>}
    </View>

    </View><View style={[styles.column, desktop && styles.columnDesktop]}><View style={styles.sectionHeading}>
      <Text selectable style={[styles.sectionTitle, { color: palette.text }]}>{copy.members}</Text>
      <Text selectable style={[styles.count, { color: palette.accent }]}>{copy.selected(selectedMembers.length)}</Text>
    </View>
    <Text selectable style={[styles.detail, { color: palette.secondaryText }]}>{copy.memberDetail}</Text>
    <View style={[styles.search, { backgroundColor: palette.surface, borderColor: palette.line }]}>
      <Ionicons color={palette.secondaryText} name="search" size={20} />
      <TextInput accessibilityLabel={copy.search} autoCapitalize="none" autoCorrect={false} editable={!busy} onChangeText={setQuery} placeholder={copy.search} placeholderTextColor={palette.secondaryText} returnKeyType="search" style={[styles.searchInput, { color: palette.text }]} value={query} />
      {query ? <Pressable accessibilityLabel={copy.search} accessibilityRole="button" hitSlop={10} onPress={() => setQuery("")}><Ionicons color={palette.secondaryText} name="close-circle" size={20} /></Pressable> : null}
    </View>
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.line }]}>
      {visibleMembers.length ? visibleMembers.map((member, index) => {
        const checked = selectedMembers.includes(member.personId);
        const isLeader = selectedDeacons.includes(member.personId);
        const currentGroupId = targetKind === "membership" ? member.currentMembershipGroupId : member.currentResponsibilityGroupId;
        const currentGroup = loaded.groups.find((candidate) => candidate.id === currentGroupId);
        const status = isLeader ? copy.leader : checked ? copy.assigned : currentGroup ? `${copy.other} ${currentGroup.name}` : copy.unassigned;
        return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked, disabled: busy || isLeader }} disabled={busy || isLeader} key={member.personId} onPress={() => toggleMember(member.personId)} style={[styles.row, index < visibleMembers.length - 1 && { borderBottomColor: palette.line, borderBottomWidth: StyleSheet.hairlineWidth }, isLeader && styles.disabled]}>
          <ProfileAvatar backgroundColor={checked ? palette.accentSoft : palette.subtle} name={member.name} source={member.photo} textColor={checked ? palette.accent : palette.text} />
          <View style={styles.rowCopy}><Text selectable style={[styles.name, { color: palette.text }]}>{member.name}</Text><Text selectable style={[styles.rowDetail, { color: palette.secondaryText }]}>{status}</Text></View>
          <Ionicons color={checked ? palette.accent : palette.secondaryText} name={checked ? "checkmark-circle" : "ellipse-outline"} size={24} />
        </Pressable>;
      }) : <Text selectable style={[styles.empty, { color: palette.secondaryText }]}>{copy.noMembers}</Text>}
    </View>

    </View></View>
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={confirmSave} style={[styles.save, { backgroundColor: palette.accent }, busy && styles.disabled]}>{operation === "saving" ? <ActivityIndicator color="#FFF" /> : null}<Text style={styles.saveText}>{operation === "saving" ? copy.saving : copy.save}</Text></Pressable>

    {group ? <View style={[styles.deleteSection, { borderTopColor: palette.line }]}>
      <Text selectable style={[styles.deleteTitle, { color: palette.text }]}>{copy.deleteSection}</Text>
      <Text selectable style={[styles.detail, { color: palette.secondaryText }]}>{copy.deleteDetail}</Text>
      <Host style={styles.deleteHost}>
        <Button disabled={busy} label={operation === "deleting" ? copy.deleting : copy.delete} onPress={confirmDelete} style={{ backgroundColor: palette.danger, borderRadius: 13, height: 50, opacity: busy ? 0.55 : 1, width: "100%" }} />
      </Host>
    </View> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({ desktopContent: { padding: 32 }, columns: { gap: 10 }, desktopColumns: { flexDirection: "row", alignItems: "flex-start", gap: 28 }, columnDesktop: { flex: 1 }, column: { gap: 10, minWidth: 0 },
  content: { gap: 10, padding: 18, paddingBottom: 48 }, field: { gap: 7 }, label: { fontSize: 14, fontWeight: "600" },
  input: { borderCurve: "continuous", borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, fontSize: 18, fontWeight: "700", minHeight: 52, paddingHorizontal: 14, paddingVertical: 11 },
  segmented: { height: 36 }, sectionTitle: { fontSize: 19, fontWeight: "800", marginTop: 10 }, sectionHeading: { alignItems: "baseline", flexDirection: "row", justifyContent: "space-between" },
  count: { fontSize: 13, fontWeight: "700" }, detail: { fontSize: 14, lineHeight: 20 }, error: { fontSize: 14, fontWeight: "600", lineHeight: 20 },
  card: { borderCurve: "continuous", borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" }, row: { alignItems: "center", flexDirection: "row", gap: 12, minHeight: 68, padding: 12 },
  rowCopy: { flex: 1, gap: 3 }, name: { fontSize: 16, fontWeight: "700" }, rowDetail: { fontSize: 13 }, empty: { padding: 16 },
  search: { alignItems: "center", borderCurve: "continuous", borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 8, minHeight: 48, paddingHorizontal: 13 },
  searchInput: { flex: 1, fontSize: 16, minHeight: 46, paddingVertical: 10 }, save: { alignItems: "center", borderCurve: "continuous", borderRadius: 14, flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 10, minHeight: 50 },
  saveText: { color: "#FFF", fontSize: 16, fontWeight: "800" }, deleteSection: { borderTopWidth: StyleSheet.hairlineWidth, gap: 8, marginTop: 14, paddingTop: 22 }, deleteTitle: { fontSize: 18, fontWeight: "800" }, deleteHost: { minHeight: 50, width: "100%" }, disabled: { opacity: 0.55 }, state: { alignItems: "center", flex: 1, gap: 10, justifyContent: "center", padding: 28 }, stateTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
});
