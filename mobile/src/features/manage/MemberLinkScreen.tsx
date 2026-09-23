import { useDesktopLayout } from "@/features/shell/use-desktop-layout";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { Text, TextInput } from "@/features/accessibility/app-text";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { ProfileAvatar } from "@/features/members/ProfileAvatar";
import { managementRepository } from "./management-repository";
import type { ManagementState } from "./model";
import { managedAccountHref, normalizeAccountId } from "./route-params";

export function MemberLinkScreen() {
  const desktop = useDesktopLayout();
  const { locale } = useLocalization();
  const copy = locale === "uk" ? { title: "Пов’язати учасника", search: "Пошук учасників", empty: "Немає доступних учасників", error: "Не вдалося завершити дію. Спробуйте ще раз.", retry: "Спробувати ще раз", invalid: "Недійсне посилання на обліковий запис." } : { title: "Link member", search: "Search members", empty: "No available members", error: "Unable to complete this action. Please try again.", retry: "Try again", invalid: "This account link is invalid." };
  const params = useLocalSearchParams<{ accountId?: string | string[] }>();
  const accountId = normalizeAccountId(params.accountId);
  const router = useRouter();
  const { palette } = useAppearance();
  const [state, setState] = useState<ManagementState | null>(null);
  const [q, setQ] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setError(null);
    void managementRepository.load().then((next) => { if (active) setState(next); }).catch(() => { if (active) setError(copy.error); });
    return () => { active = false; };
  }, [reload, copy.error]);
  async function linkMember(personId: string) {
    if (!accountId || !state || busy) return;
    setBusy(true); setError(null);
    try {
      await managementRepository.apply(state, { type: "link-account", accountId, personId });
      router.replace(managedAccountHref(accountId));
    } catch { setError(copy.error); setBusy(false); }
  }
  const members = useMemo(() => (state?.members ?? []).filter((m) => !m.archived && m.name.toLocaleLowerCase().includes(q.toLocaleLowerCase())), [state, q]);
  if (!accountId || !state) return <View style={[styles.center, { backgroundColor: palette.background }]}>{!accountId || error ? <><Text accessibilityLiveRegion="polite" style={{ color: palette.text }}>{!accountId ? copy.invalid : error}</Text>{accountId ? <Pressable accessibilityRole="button" onPress={() => setReload((value) => value + 1)}><Text style={{ color: palette.accent }}>{copy.retry}</Text></Pressable> : null}</> : <ActivityIndicator color={palette.accent} />}</View>;

  return <View style={[styles.root, desktop && styles.desktopRoot, { backgroundColor: palette.background }]}>
    <Text style={[styles.title, { color: palette.text }]}>{copy.title}</Text>
    {error ? <Text accessibilityLiveRegion="polite" style={{ color: palette.danger }}>{error}</Text> : null}
    <TextInput accessibilityLabel={copy.search} autoFocus onChangeText={setQ} placeholder={copy.search} placeholderTextColor={palette.secondaryText} style={[styles.search, { backgroundColor: palette.surface, borderColor: palette.line, color: palette.text }]} value={q} />
    <FlatList contentInsetAdjustmentBehavior="automatic" data={members} keyExtractor={(m) => m.id} keyboardShouldPersistTaps="handled" renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityState={{ busy, disabled: busy }} disabled={busy} onPress={() => void linkMember(item.id)} style={[styles.row, { borderBottomColor: palette.line }]}>
      <ProfileAvatar name={item.name} source={item.photo} />
      <Text style={[styles.rowText, { color: palette.text }]}>{item.name}</Text>
    </Pressable>} ListEmptyComponent={<Text style={{ color: palette.secondaryText }}>{copy.empty}</Text>} />
  </View>;
}

const styles = StyleSheet.create({ desktopRoot: { alignSelf: "center", width: "100%", maxWidth: 1000, padding: 32 }, root: { flex: 1, padding: 22 }, title: { fontSize: 32, fontWeight: "800", marginBottom: 16, marginTop: 20 }, search: { borderRadius: 12, borderWidth: 1, fontSize: 16, marginBottom: 10, padding: 14 }, row: { alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 12, paddingVertical: 12 }, rowText: { flex: 1, fontSize: 17, fontWeight: "700" }, center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 20, padding: 24 } });
