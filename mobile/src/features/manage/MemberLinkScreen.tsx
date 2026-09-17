import { Text, TextInput } from "@/features/accessibility/app-text";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { ProfileAvatar } from "@/features/members/ProfileAvatar";
import { managementRepository } from "./management-repository";
import type { ManagementState } from "./model";
import { managedAccountHref, normalizeAccountId } from "./route-params";

export function MemberLinkScreen() {
  const params = useLocalSearchParams<{ accountId?: string | string[] }>();
  const accountId = normalizeAccountId(params.accountId);
  const router = useRouter();
  const { palette } = useAppearance();
  const [state, setState] = useState<ManagementState | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => { managementRepository.load().then(setState); }, []);
  const members = useMemo(() => (state?.members ?? []).filter((m) => !m.archived && m.name.toLocaleLowerCase().includes(q.toLocaleLowerCase())), [state, q]);
  if (!state) return <View style={[styles.center, { backgroundColor: palette.background }]} />;

  return <View style={[styles.root, { backgroundColor: palette.background }]}>
    <Text style={[styles.title, { color: palette.text }]}>Link member</Text>
    <TextInput autoFocus onChangeText={setQ} placeholder="Search members" placeholderTextColor={palette.secondaryText} style={[styles.search, { backgroundColor: palette.surface, borderColor: palette.line, color: palette.text }]} value={q} />
    <FlatList contentInsetAdjustmentBehavior="automatic" data={members} keyExtractor={(m) => m.id} keyboardShouldPersistTaps="handled" renderItem={({ item }) => <Pressable disabled={!accountId} onPress={() => accountId ? void managementRepository.apply(state, { type: "link-account", accountId, personId: item.id }).then(() => { router.replace(managedAccountHref(accountId)); }) : undefined} style={[styles.row, { borderBottomColor: palette.line }]}>
      <ProfileAvatar backgroundColor={palette.accentSoft} name={item.name} source={item.photo} textColor={palette.accent} />
      <Text style={[styles.rowText, { color: palette.text }]}>{item.name}</Text>
    </Pressable>} ListEmptyComponent={<Text style={{ color: palette.secondaryText }}>No available members</Text>} />
  </View>;
}

const styles = StyleSheet.create({ root: { flex: 1, padding: 22 }, title: { fontSize: 32, fontWeight: "800", marginBottom: 16, marginTop: 20 }, search: { borderRadius: 12, borderWidth: 1, fontSize: 16, marginBottom: 10, padding: 14 }, row: { alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 12, paddingVertical: 12 }, rowText: { flex: 1, fontSize: 17, fontWeight: "700" }, center: { flex: 1 } });
