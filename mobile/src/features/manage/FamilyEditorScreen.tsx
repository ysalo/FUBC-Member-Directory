import { useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { MemberRow } from "@/features/directory/DirectoryScreen";
import type { Member } from "@/features/directory/members";
import { ProfileAvatar } from "@/features/members/ProfileAvatar";
import { useDesktopLayout } from "@/features/shell/use-desktop-layout";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, TextInput } from "@/features/accessibility/app-text";
import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { getFamilyCopy } from "@/features/family/family-copy";
import type { FamilyChanges, FamilySnapshot } from "@/features/family/family-repository";
import { useSession } from "@/features/session/SessionProvider";
import { formatMemberName } from "@/lib/member-name";
import { sessionCacheScope } from "@/lib/session-cache";
import { managementRepository } from "./management-repository";
import type { ManagedMember } from "./model";
import { clearFamilyDraft, holdFamilyDraft, takeFamilyDraft } from "./family-draft";
import { useUnsavedChanges } from "./use-unsaved-changes";

type Category = "parents" | "spouse" | "children" | "siblings";
const categories: Category[] = ["parents", "spouse", "children", "siblings"];
const emptyChanges: FamilyChanges = { parentIds: [], spouseId: null, childIds: [], siblingIds: [] };
function changesFromSnapshot(family: FamilySnapshot): FamilyChanges {
  return { parentIds: family.parents.map(p => p.id), spouseId: family.spouse?.id ?? null, childIds: family.children.map(p => p.id), siblingIds: family.siblings.filter(p => p.explicit).map(p => p.id) };
}

export function FamilyEditorScreen() {
  const { memberId, createdId } = useLocalSearchParams<{ memberId: string; createdId?: string }>();
  const router = useRouter();
  useSession();
  const scope = (() => { try { return sessionCacheScope(); } catch { return null; } })();
  const identity = `${scope}:${memberId}`;
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const request = useRef(0);
  const desktop = useDesktopLayout();
  const isCurrent = (ticket: number) => {
    try { return request.current === ticket && currentIdentity.current === identity && scope !== null && sessionCacheScope() === scope; }
    catch { return false; }
  };
  const { palette } = useAppearance();
  const { locale } = useLocalization();
  const copy = getFamilyCopy(locale);
  const [loaded, setLoaded] = useState<{ identity: string; family: FamilySnapshot } | null>(null);
  const snapshot = loaded?.identity === identity && loaded.family.memberId === memberId ? loaded.family : null;
  const [members, setMembers] = useState<ManagedMember[]>([]);
  const [changes, setChanges] = useState<FamilyChanges>(emptyChanges);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [category, setCategory] = useState<Category | null>(null);
  const [search, setSearch] = useState("");
  const original = snapshot && changesFromSnapshot(snapshot);
  const dirty = Boolean(original && JSON.stringify(changes) !== JSON.stringify(original));
  const guard = useUnsavedChanges(dirty);
  async function load() {
    const ticket = ++request.current;
    const draft = takeFamilyDraft(identity);
    setLoaded(null); setMembers([]); setChanges(emptyChanges); setCategory(null);
    setConflict(false);
    setBusy(true); setError(null);
    if (scope === null) { setBusy(false); return; }
    try {
      const [family, catalog] = await Promise.all([managementRepository.loadFamily(memberId), managementRepository.load()]);
      if (!isCurrent(ticket)) return;
      if (family.memberId !== memberId) throw new Error("Family response belongs to another member");
      setLoaded({ identity, family }); setMembers(catalog.members);
      const baseline = changesFromSnapshot(family);
      const next: FamilyChanges = draft ? { ...draft.changes } : baseline;
      if (draft && createdId && catalog.members.some(p => p.id === createdId)) {
        if (draft.category === "spouse") next.spouseId = createdId;
        else {
          const key = draft.category === "parents" ? "parentIds" : draft.category === "children" ? "childIds" : "siblingIds";
          next[key] = [...new Set([...next[key], createdId])];
        }
      }
      setChanges(next);
      setConflict(false); setCategory(null);
    } catch { if (isCurrent(ticket)) { if (draft) holdFamilyDraft(draft); setError(copy.loadError); } }
    finally { if (isCurrent(ticket)) setBusy(false); }
  }
  useEffect(() => { void load(); return () => { request.current++; }; }, [memberId, scope, createdId]);
  function exit() { clearFamilyDraft(); guard.allowLeave(); router.replace(`/manage/member/${memberId}`); }
  function cancel() { guard.confirmLeave(exit); }
  function ids(kind: Category) { return kind === "parents" ? changes.parentIds : kind === "children" ? changes.childIds : kind === "siblings" ? changes.siblingIds : changes.spouseId ? [changes.spouseId] : []; }
  function select(kind: Category, id: string, remove = false) {
    setChanges(previous => {
      if (kind === "spouse") return { ...previous, spouseId: remove ? null : id };
      const key = kind === "parents" ? "parentIds" : kind === "children" ? "childIds" : "siblingIds";
      return { ...previous, [key]: remove ? previous[key].filter(value => value !== id) : [...new Set([...previous[key], id])] };
    });
  }
  async function save() {
    if (!snapshot || snapshot.memberId !== memberId || busy || conflict || scope === null) return;
    const ticket = request.current;
    setBusy(true); setError(null);
    try { await managementRepository.saveFamily(memberId, snapshot.revision, changes); if (isCurrent(ticket)) exit(); }
    catch (cause) {
      if (!isCurrent(ticket)) return;
      const stale = typeof cause === "object" && cause !== null && "code" in cause && cause.code === "40001";
      const kind = typeof cause === "object" && cause !== null && "kind" in cause ? cause.kind : "unknown";
      const reason = kind === "spouse" ? copy.spouseConflict : kind === "cycle" ? copy.cycle : kind === "self" ? copy.self : copy.saveError;
      setConflict(stale); setError(stale ? copy.conflict : reason);
    } finally { if (isCurrent(ticket)) setBusy(false); }
  }
  function createMember() {
    if (!category || !snapshot || busy) return;
    holdFamilyDraft({ identity, changes, category });
    guard.allowLeave();
    router.replace(`/manage/member/new?familyReturn=${encodeURIComponent(memberId)}`);
  }
  function memberLabel(id: string) {
    const member = members.find(p => p.id === id);
    return member ? `${formatMemberName(member)}${member.archived ? ` (${copy.archived})` : ""}` : id;
  }
  function rowMember(id: string): Member {
    const member = members.find(p => p.id === id);
    const relative = snapshot && [...snapshot.parents, ...snapshot.children, ...snapshot.siblings, ...(snapshot.spouse ? [snapshot.spouse] : [])].find(p => p.id === id);
    return { id, name: member?.name ?? relative?.name ?? id, first_name: member?.first_name, last_name: member?.last_name, patronymic: member?.patronymic,
      avatar: member?.photo ?? relative?.photo ?? {}, phone: member?.phone ?? null, ministry: "", ministryUk: "", leadershipMinistry: null, isOrphan: false, isWidow: false };
  }
  const visibleMembers = snapshot ? members : [];
  const candidates = visibleMembers.filter(p => p.id !== memberId && [p.name, formatMemberName(p), p.patronymic ?? ""].some(value => value.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())));
  const subject = visibleMembers.find(p => p.id === memberId);
  function closePicker() { setCategory(null); setSearch(""); }
  function openPicker(kind: Category) { setCategory(kind); setSearch(""); setError(null); }
  function textAction(label: string, onPress: () => void, disabled = busy) {
    return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[styles.textButton, disabled && styles.disabled]}><Text style={[styles.actionText, { color: palette.accent }]}>{label}</Text></Pressable>;
  }
  return <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
    <View style={[styles.header, desktop && styles.desktopWidth, { borderBottomColor: palette.line }]}>
      {textAction(copy.cancel, cancel)}
      <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>{copy.family}</Text>
      {textAction(copy.save, () => void save(), !snapshot || busy || conflict)}
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, desktop && styles.desktopWidth]}>
      {subject && <View style={styles.subject}>
        <ProfileAvatar name={subject.name} source={subject.photo} size={64} />
        <View style={styles.subjectCopy}><Text style={[styles.subjectName, { color: palette.text }]}>{formatMemberName(subject)}</Text><Text style={[styles.body, { color: palette.secondaryText }]}>{copy.editHint}</Text></View>
      </View>}
      {busy && <ActivityIndicator color={palette.accent} />}
      {error && <Text accessibilityRole="alert" style={[styles.body, { color: palette.danger }]}>{error}</Text>}
      {(conflict || (!snapshot && !busy)) && textAction(conflict ? copy.refresh : copy.retry, () => void load())}
      {snapshot && categories.map(kind => {
        const inferred = kind === "siblings" ? snapshot.siblings.filter(p => p.supportingParents.length > 0) : [];
        const rowIds = [...new Set([...ids(kind), ...inferred.map(p => p.id)])];
        return <View key={kind} style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.line }]}>
          <View style={styles.sectionHeader}>
            <Text accessibilityRole="header" style={[styles.heading, { color: palette.text }]}>{copy[kind]} <Text style={{ color: palette.secondaryText }}>{rowIds.length}</Text></Text>
            <Pressable accessibilityLabel={`${copy.add}: ${copy[kind]}`} accessibilityRole="button" disabled={busy} onPress={() => openPicker(kind)} style={[styles.addButton, { backgroundColor: palette.accentSoft }, busy && styles.disabled]}>
              <Ionicons accessibilityElementsHidden name="add" size={18} color={palette.accent} /><Text style={[styles.actionText, { color: palette.accent }]}>{copy.add}</Text>
            </Pressable>
          </View>
          {kind === "children" && changes.spouseId && <Text style={[styles.hint, { color: palette.secondaryText }]}>{copy.sharedChildrenHint}</Text>}
          {!rowIds.length && <Text style={[styles.empty, { color: palette.secondaryText }]}>{copy.empty}</Text>}
          {rowIds.map(id => {
            const inferredSibling = inferred.find(p => p.id === id);
            const removable = ids(kind).includes(id);
            const detail = [members.find(p => p.id === id)?.archived ? copy.archived : "", inferredSibling ? `${copy.inferred}: ${inferredSibling.supportingParents.map(p => memberLabel(p.id)).join(", ")}` : kind === "siblings" ? copy.explicit : ""].filter(Boolean).join(" · ");
            return <MemberRow key={id} compact fullName item={rowMember(id)} locale={locale} ministry="" detail={detail}
              onPress={() => { if (removable) select(kind, id, true); else guard.confirmLeave(() => router.push(`/members/${id}`)); }}
              selection={removable ? { checked: true, label: `${copy.remove}: ${memberLabel(id)} (${copy[kind]})`, disabled: busy, mode: "remove" } : undefined} />;
          })}
          {inferred.length > 0 && <Text style={[styles.hint, { color: palette.secondaryText }]}>{copy.inferenceHint}</Text>}
        </View>;
      })}
    </ScrollView>
    {snapshot && <View style={[styles.footer, desktop && styles.desktopWidth, { backgroundColor: palette.background, borderTopColor: palette.line }]}>
      <Text style={[styles.hint, { color: palette.secondaryText }]}>{dirty ? copy.unsaved : copy.saved}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={copy.save} disabled={busy || conflict} onPress={() => void save()} style={[styles.primary, { backgroundColor: palette.accent }, (busy || conflict) && styles.disabled]}><Text style={styles.primaryText}>{copy.save}</Text></Pressable>
    </View>}
    {snapshot && category && <Modal animationType="slide" transparent onRequestClose={closePicker}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[styles.overlay, desktop && styles.desktopOverlay]}>
        <View style={[styles.sheet, { backgroundColor: palette.background }]}>
          <View style={[styles.pickerHeader, { borderBottomColor: palette.line }]}>
            <View style={styles.pickerTitle}><Text accessibilityRole="header" style={[styles.heading, { color: palette.text }]}>{copy[category]}</Text><Text style={[styles.hint, { color: palette.secondaryText }]}>{category === "spouse" ? copy.chooseOne : copy.chooseMany}</Text></View>
            {textAction(copy.done, closePicker)}
          </View>
          <View style={[styles.search, { backgroundColor: palette.surface, borderColor: palette.line }]}>
            <Ionicons accessibilityElementsHidden name="search" size={20} color={palette.secondaryText} />
            <TextInput autoFocus autoCapitalize="none" autoCorrect={false} accessibilityLabel={copy.search} placeholder={copy.search} placeholderTextColor={palette.secondaryText} value={search} onChangeText={setSearch} editable={!busy} style={[styles.searchInput, { color: palette.text }]} />
            {search !== "" && <Pressable accessibilityRole="button" accessibilityLabel={copy.clearSearch} onPress={() => setSearch("")} style={styles.clear}><Ionicons accessibilityElementsHidden name="close-circle" size={20} color={palette.secondaryText} /></Pressable>}
          </View>
          <FlatList data={candidates} keyExtractor={member => member.id} keyboardShouldPersistTaps="handled" initialNumToRender={12} maxToRenderPerBatch={12} style={styles.pickerList}
            extraData={changes} renderItem={({ item }) => <MemberRow compact fullName item={rowMember(item.id)} locale={locale} ministry="" detail={item.archived ? copy.archived : undefined}
              selection={{ checked: ids(category).includes(item.id), label: memberLabel(item.id), disabled: busy, mode: category === "spouse" ? "radio" : "checkbox" }}
              onPress={() => select(category, item.id, ids(category).includes(item.id))} />}
            ListEmptyComponent={<Text style={[styles.empty, { color: palette.secondaryText }]}>{copy.noMatches}</Text>} />
          <View style={[styles.pickerFooter, { borderTopColor: palette.line }]}>
            <Text style={[styles.hint, { color: palette.secondaryText }]}>{copy.selected(ids(category).length)}</Text>
            {textAction(copy.create, createMember)}
            <Text style={[styles.hint, { color: palette.secondaryText }]}>{copy.createHint}</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>}
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1 }, desktopWidth: { width: "100%", maxWidth: 900, alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, minHeight: 60, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 20, fontWeight: "800" }, content: { padding: 20, gap: 20, paddingBottom: 28 },
  subject: { flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 4 }, subjectCopy: { flex: 1, minWidth: 0 }, subjectName: { fontSize: 22, fontWeight: "800" },
  body: { fontSize: 16, lineHeight: 23 }, heading: { fontSize: 18, fontWeight: "800", flexShrink: 1 }, hint: { fontSize: 14, lineHeight: 20, paddingHorizontal: 16, paddingBottom: 12 },
  section: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, borderCurve: "continuous", overflow: "hidden" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 8 },
  addButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 12, minHeight: 44, borderRadius: 12 },
  empty: { fontSize: 15, lineHeight: 22, padding: 16 }, textButton: { padding: 12, minHeight: 44, justifyContent: "center" }, actionText: { fontSize: 16, fontWeight: "700" }, disabled: { opacity: 0.45 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, gap: 4 },
  primary: { minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 }, primaryText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" }, desktopOverlay: { alignItems: "center", justifyContent: "center", padding: 24 },
  sheet: { width: "100%", maxWidth: 640, height: "85%", borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden" },
  pickerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingLeft: 20, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth }, pickerTitle: { flex: 1 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, margin: 16, paddingHorizontal: 12 },
  searchInput: { flex: 1, minWidth: 0, minHeight: 46, fontSize: 16 }, clear: { minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" },
  pickerList: { flex: 1 }, pickerFooter: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, paddingBottom: 16 },
});
