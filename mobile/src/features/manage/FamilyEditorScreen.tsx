import { useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, TextInput } from "@/features/accessibility/app-text";
import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { getFamilyCopy } from "@/features/family/family-copy";
import type { FamilyChanges, FamilySnapshot } from "@/features/family/family-repository";
import { useSession } from "@/features/session/SessionProvider";
import { sessionCacheScope } from "@/lib/session-cache";
import { managementRepository } from "./management-repository";
import type { ManagedMember } from "./model";

type Category = "parents" | "spouse" | "children" | "siblings";
const categories: Category[] = ["parents", "spouse", "children", "siblings"];
const emptyChanges: FamilyChanges = { parentIds: [], spouseId: null, childIds: [], siblingIds: [] };

export function FamilyEditorScreen() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const router = useRouter();
  useSession();
  const scope = (() => { try { return sessionCacheScope(); } catch { return null; } })();
  const identity = `${scope}:${memberId}`;
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const request = useRef(0);
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
  const [creating, setCreating] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState<"male" | "female" | null>(null);
  async function load() {
    const ticket = ++request.current;
    setLoaded(null); setMembers([]); setChanges(emptyChanges); setCategory(null); setCreating(false);
    setFirstName(""); setLastName(""); setGender(null); setConflict(false);
    setBusy(true); setError(null);
    if (scope === null) { setBusy(false); return; }
    try {
      const [family, catalog] = await Promise.all([managementRepository.loadFamily(memberId), managementRepository.load()]);
      if (!isCurrent(ticket)) return;
      if (family.memberId !== memberId) throw new Error("Family response belongs to another member");
      setLoaded({ identity, family }); setMembers(catalog.members);
      setChanges({ parentIds: family.parents.map(p => p.id), spouseId: family.spouse?.id ?? null, childIds: family.children.map(p => p.id), siblingIds: family.siblings.filter(p => p.explicit).map(p => p.id) });
      setConflict(false); setCategory(null); setCreating(false);
    } catch { if (isCurrent(ticket)) setError(copy.loadError); }
    finally { if (isCurrent(ticket)) setBusy(false); }
  }
  useEffect(() => { void load(); return () => { request.current++; }; }, [memberId, scope]);
  function exit() { router.canGoBack() ? router.back() : router.replace(`/manage/member/${memberId}`); }
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
  async function createMember() {
    if (busy || !category || !snapshot || scope === null) return;
    const ticket = request.current;
    if (!firstName.trim() || !lastName.trim() || !gender) { setError(copy.required); return; }
    setBusy(true); setError(null);
    try {
      const saved = await managementRepository.saveMemberDetails({ name: `${firstName.trim()} ${lastName.trim()}`, gender });
      if (!isCurrent(ticket)) return;
      if (!saved) throw new Error("Member was not returned.");
      setMembers(previous => [...previous, { ...saved, group: "", archived: false }]);
      select(category, saved.id); setCreating(false); setCategory(null); setFirstName(""); setLastName(""); setGender(null);
    } catch { if (isCurrent(ticket)) setError(copy.saveError); }
    finally { if (isCurrent(ticket)) setBusy(false); }
  }
  function action(label: string, onPress: () => void, disabled = busy) {
    return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[styles.button, { borderColor: palette.line }, disabled && styles.disabled]}><Text style={{ color: palette.accent }}>{label}</Text></Pressable>;
  }
  function memberLabel(id: string) {
    const member = members.find(p => p.id === id);
    return member ? `${member.name}${member.archived ? ` (${copy.archived})` : ""}` : id;
  }
  const visibleMembers = snapshot ? members : [];
  const candidates = visibleMembers.filter(p => p.id !== memberId && p.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const matching = visibleMembers.filter(p => p.id !== memberId && firstName.trim() && lastName.trim() && p.name.toLocaleLowerCase() === `${firstName.trim()} ${lastName.trim()}`.toLocaleLowerCase());
  return <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>{copy.edit}{visibleMembers.find(p => p.id === memberId)?.name ? ` · ${visibleMembers.find(p => p.id === memberId)?.name}` : ""}</Text>
      <View style={styles.actions}>{action(copy.cancel, exit)}{snapshot && action(copy.save, () => void save(), busy || conflict)}</View>
      {busy && <ActivityIndicator color={palette.accent} />}
      {error && <Text accessibilityRole="alert" style={{ color: palette.text }}>{error}</Text>}
      {(conflict || (!snapshot && !busy)) && action(conflict ? copy.refresh : copy.retry, () => void load())}
      {snapshot && categories.map(kind => <View key={kind} style={[styles.section, { borderColor: palette.line }]}>
        <Text accessibilityRole="header" style={[styles.heading, { color: palette.text }]}>{copy[kind]}</Text>
        {!ids(kind).length && <Text style={{ color: palette.secondaryText }}>{copy.empty}</Text>}
        {ids(kind).map(id => <View key={id} style={styles.row}>
          <Text style={[styles.name, { color: palette.text }]}>{memberLabel(id)}{kind === "siblings" ? ` · ${copy.explicit}` : ""}</Text>
          {action(`${copy.remove}: ${memberLabel(id)} (${copy[kind]})`, () => select(kind, id, true))}
        </View>)}
        {kind === "siblings" && snapshot.siblings.filter(sibling => sibling.supportingParents.length > 0).map(sibling => <View key={sibling.id} style={styles.inference}>
          <Text style={{ color: palette.text }}>{memberLabel(sibling.id)} · {copy.inferred}: {sibling.supportingParents.map(parent => `${parent.name}${parent.archived ? ` (${copy.archived})` : ""}`).join(", ")}</Text>
          <Text style={{ color: palette.secondaryText }}>{copy.inferenceHint}</Text>
        </View>)}
        {action(`${copy.add}: ${copy[kind]}`, () => { setCategory(kind); setCreating(false); setSearch(""); setError(null); })}
      </View>)}
      {snapshot && category && <View style={[styles.section, { borderColor: palette.line }]}>
        <Text accessibilityRole="header" style={[styles.heading, { color: palette.text }]}>{copy.add}: {copy[category]}</Text>
        {action(copy.cancel, () => { setCategory(null); setCreating(false); setError(null); })}
        {creating ? <>
          <Text style={{ color: palette.secondaryText }}>{copy.createHint}</Text>
          <TextInput accessibilityLabel={copy.firstName} placeholder={copy.firstName} value={firstName} onChangeText={setFirstName} editable={!busy} style={[styles.input, { color: palette.text, borderColor: palette.line }]} />
          <TextInput accessibilityLabel={copy.lastName} placeholder={copy.lastName} value={lastName} onChangeText={setLastName} editable={!busy} style={[styles.input, { color: palette.text, borderColor: palette.line }]} />
          <View accessibilityRole="radiogroup" accessibilityLabel={copy.gender} aria-required>
            {(["male", "female"] as const).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={copy[value]} accessibilityState={{ checked: gender === value, disabled: busy }} disabled={busy} onPress={() => setGender(value)} style={styles.button}><Text style={{ color: palette.text }}>{gender === value ? "◉ " : "○ "}{copy[value]}</Text></Pressable>)}
          </View>
          {matching.length > 0 && <Text style={{ color: palette.text }}>{copy.matches}</Text>}
          {matching.map(member => <View key={member.id}>{action(memberLabel(member.id), () => { select(category, member.id); setCategory(null); setCreating(false); setError(null); })}</View>)}
          {action(copy.createSelect, () => void createMember())}
        </> : <>
          <TextInput accessibilityLabel={copy.search} placeholder={copy.search} value={search} onChangeText={setSearch} editable={!busy} style={[styles.input, { color: palette.text, borderColor: palette.line }]} />
          {action(copy.create, () => { setCreating(true); setFirstName(""); setLastName(""); setGender(null); })}
          {candidates.filter(member => !ids(category).includes(member.id)).map(member => <View key={member.id}>{action(memberLabel(member.id), () => { select(category, member.id); setCategory(null); })}</View>)}
        </>}
      </View>}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1 }, content: { padding: 20, gap: 16, width: "100%", maxWidth: 900, alignSelf: "center", paddingBottom: 80 },
  title: { fontSize: 26, fontWeight: "700" }, heading: { fontSize: 20, fontWeight: "700" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 12 }, section: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 12 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }, name: { flexGrow: 1, flexShrink: 1 },
  button: { minHeight: 44, padding: 10, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, justifyContent: "center" },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 8, padding: 12 }, inference: { gap: 6 }, disabled: { opacity: 0.45 },
});
