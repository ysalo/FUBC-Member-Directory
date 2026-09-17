import { Text, TextInput } from "@/features/accessibility/app-text";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { useSession } from "@/features/session/SessionProvider";
import { deleteAccount } from "./account-deletion";

const copy = {
  en: { selfTitle: "Delete your account", adminTitle: "Delete account", selfDetail: "This permanently removes your sign-in account and private app data. Your church directory record will be kept but unlinked. If you sign in again later, your new account will need approval again.", adminDetail: "This permanently removes the sign-in account and private app data. The church directory record will be kept but unlinked.", typePrompt: "Type the name below to confirm", confirmLabel: "Confirmation", delete: "Delete account permanently", cancel: "Cancel", required: "Type the name exactly as shown.", failed: "The account could not be deleted. Please try again.", lastAdmin: "The last active administrator cannot be deleted.", back: "Back" },
  uk: { selfTitle: "Видалити обліковий запис", adminTitle: "Видалити обліковий запис", selfDetail: "Це назавжди видалить ваш обліковий запис для входу та приватні дані застосунку. Запис у церковному довіднику буде збережено, але від’єднано. Якщо ви ввійдете знову, новий обліковий запис потрібно буде схвалити повторно.", adminDetail: "Це назавжди видалить обліковий запис для входу та приватні дані. Запис у довіднику буде збережено, але від’єднано.", typePrompt: "Введіть ім’я нижче для підтвердження", confirmLabel: "Підтвердження", delete: "Видалити назавжди", cancel: "Скасувати", required: "Введіть ім’я точно як показано.", failed: "Не вдалося видалити обліковий запис. Спробуйте ще раз.", lastAdmin: "Останній активний адміністратор не може бути видалений.", back: "Назад" },
} as const;

export function AccountDeletionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { locale } = useLocalization();
  const { palette } = useAppearance();
  const session = useSession();
  const params = useLocalSearchParams<{ targetAccountId?: string; displayName?: string; admin?: string }>();
  const isAdminDelete = params.admin === "true" && Boolean(params.targetAccountId);
  const displayName = String(params.displayName || (session.status === "ready" ? session.account.displayName : ""));
  const labels = copy[locale];
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = confirmation.trim() === displayName.trim() && displayName.trim().length > 0;
  const title = isAdminDelete ? labels.adminTitle : labels.selfTitle;
  const detail = isAdminDelete ? labels.adminDetail : labels.selfDetail;

  const failure = useMemo(() => error === "final-admin" ? labels.lastAdmin : error ? labels.failed : null, [error, labels]);
  async function submit() {
    if (!valid || busy) { setError("invalid"); return; }
    setBusy(true); setError(null);
    try {
      await deleteAccount({ confirmation: confirmation.trim(), ...(isAdminDelete ? { targetAccountId: params.targetAccountId } : {}) });
      if (isAdminDelete) router.replace("/manage" as Href);
      else router.replace("/(directory)" as Href);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "";
      setError(/last active administrator|final administrator/i.test(message) ? "final-admin" : "failed");
    } finally { setBusy(false); }
  }
  return <View style={[styles.screen, { backgroundColor: palette.background }]}>
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]} keyboardShouldPersistTaps="handled">
      <View style={[styles.icon, { backgroundColor: palette.accentSoft }]}><Ionicons accessibilityElementsHidden color={palette.accent} name="trash-outline" size={28} /></View>
      <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>{title}</Text>
      <Text selectable style={[styles.detail, { color: palette.secondaryText }]}>{detail}</Text>
      <View style={[styles.warning, { backgroundColor: palette.warningSoft, borderColor: palette.line }]}><Text selectable style={[styles.warningText, { color: palette.text }]}>{labels.typePrompt}</Text><Text selectable style={[styles.name, { color: palette.text }]}>{displayName || "—"}</Text></View>
      <TextInput accessibilityLabel={labels.confirmLabel} autoCapitalize="words" autoCorrect={false} editable={!busy} onChangeText={(value) => { setConfirmation(value); setError(null); }} placeholder={labels.confirmLabel} placeholderTextColor={palette.secondaryText} style={[styles.input, { backgroundColor: palette.surface, borderColor: error ? palette.accent : palette.line, color: palette.text }]} value={confirmation} />
      {error === "invalid" ? <Text accessibilityLiveRegion="polite" style={[styles.error, { color: palette.accent }]}>{labels.required}</Text> : null}
      {failure ? <Text accessibilityLiveRegion="polite" style={[styles.error, { color: palette.accent }]}>{failure}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityState={{ busy, disabled: busy || !valid }} disabled={busy || !valid} onPress={() => void submit()} style={({ pressed }) => [styles.deleteButton, { backgroundColor: valid ? palette.accent : palette.subtle }, pressed && styles.pressed]}>{busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.deleteText}>{labels.delete}</Text>}</Pressable>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => router.back()} style={styles.cancel}><Text style={[styles.cancelText, { color: palette.secondaryText }]}>{labels.cancel}</Text></Pressable>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, content: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 16 }, back: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 4, minHeight: 44 }, backText: { fontSize: 16, fontWeight: "600" }, icon: { alignItems: "center", borderRadius: 30, height: 60, justifyContent: "center", marginTop: 32, width: 60 }, title: { fontSize: 34, fontWeight: "800", letterSpacing: -0.8, marginTop: 18 }, detail: { fontSize: 16, lineHeight: 24, marginTop: 14 }, warning: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, marginTop: 28, padding: 16 }, warningText: { fontSize: 14, fontWeight: "600" }, name: { fontSize: 20, fontWeight: "800", marginTop: 8 }, input: { borderRadius: 12, borderWidth: 1, fontSize: 17, minHeight: 54, paddingHorizontal: 15, marginTop: 12 }, error: { fontSize: 14, lineHeight: 20, marginTop: 8 }, deleteButton: { alignItems: "center", borderRadius: 13, justifyContent: "center", marginTop: 28, minHeight: 54, paddingHorizontal: 18 }, deleteText: { color: "#FFF", fontSize: 16, fontWeight: "800" }, cancel: { alignItems: "center", minHeight: 48, justifyContent: "center", marginTop: 8 }, cancelText: { fontSize: 16, fontWeight: "600" }, pressed: { opacity: 0.75 }, });
