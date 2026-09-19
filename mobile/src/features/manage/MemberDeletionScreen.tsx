import { useDesktopLayout } from "@/features/shell/use-desktop-layout";
import { Button, Host } from "@expo/ui";
import { Text, TextInput } from "@/features/accessibility/app-text";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { useSession } from "@/features/session/SessionProvider";
import { canManageAccounts } from "@/lib/permissions";
import { deleteMember, MemberDeletionError } from "./member-deletion";
import { managementRepository } from "./management-repository";
import { MemberAvatar } from "./MemberAvatar";
import type { ManagedAccount, ManagedMember } from "./model";

const words = {
  en: {
    title: "Delete member permanently?", detail: "This cannot be undone. The member will disappear from the directory and every group.",
    account: "Linked sign-in account", accountDetail: "Their sign-in and private account data will also be deleted.", noAccount: "No sign-in account is linked.",
    visits: "Visit history", visitsDetail: "All scheduled and past visits for this member will be deleted, including participant responses and notifications.",
    photo: "Private photo and profile details will be deleted.", prompt: "Type the member’s full name to confirm", confirmation: "Member name",
    delete: "Delete member permanently", deleting: "Deleting member…", cancel: "Cancel", retry: "Try again", loading: "Loading member…",
    loadError: "This member could not be loaded.", missing: "This member no longer exists.", denied: "Only active administrators can delete members.",
    self: "You cannot delete your own linked member record. Ask another administrator to do this.", required: "Type the name exactly as shown.",
    conflict: "This member changed. Return to the editor, review the latest information, and try again.", finalAdmin: "Assign another active administrator before deleting this member.",
    failed: "The deletion did not finish. Reload and try again; linked sign-in access may already have been removed.",
  },
  uk: {
    title: "Видалити учасника назавжди?", detail: "Цю дію неможливо скасувати. Учасник зникне з довідника та всіх груп.",
    account: "Пов’язаний обліковий запис", accountDetail: "Його дані для входу та приватні дані облікового запису також буде видалено.", noAccount: "Обліковий запис для входу не пов’язано.",
    visits: "Історія відвідувань", visitsDetail: "Усі заплановані та минулі відвідування цього учасника буде видалено разом із відповідями та сповіщеннями.",
    photo: "Приватне фото й дані профілю буде видалено.", prompt: "Введіть повне ім’я учасника для підтвердження", confirmation: "Ім’я учасника",
    delete: "Видалити учасника назавжди", deleting: "Видаляємо учасника…", cancel: "Скасувати", retry: "Спробувати ще раз", loading: "Завантажуємо учасника…",
    loadError: "Не вдалося завантажити цього учасника.", missing: "Цього учасника більше не існує.", denied: "Лише активні адміністратори можуть видаляти учасників.",
    self: "Ви не можете видалити власний пов’язаний запис учасника. Попросіть іншого адміністратора.", required: "Введіть ім’я точно так, як показано.",
    conflict: "Дані учасника змінилися. Поверніться до редагування, перевірте актуальну інформацію та спробуйте ще раз.", finalAdmin: "Призначте іншого активного адміністратора перед видаленням цього учасника.",
    failed: "Видалення не завершено. Оновіть дані та спробуйте ще раз; пов’язаний доступ для входу вже міг бути видалений.",
  },
} as const;

type LoadState = "loading" | "ready" | "missing" | "denied" | "error";

export function MemberDeletionScreen() {
  const desktop = useDesktopLayout();
  const { memberId } = useLocalSearchParams<{ memberId?: string }>();
  const router = useRouter();
  const { locale } = useLocalization();
  const { palette } = useAppearance();
  const session = useSession();
  const copy = words[locale];
  const actor = session.status === "ready" ? session.account : null;
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [member, setMember] = useState<ManagedMember | null>(null);
  const [account, setAccount] = useState<ManagedAccount | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    if (session.status !== "ready") return () => { alive = false; };
    if (!canManageAccounts(session.account)) { setLoadState("denied"); return () => { alive = false; }; }
    if (!memberId) { setLoadState("missing"); return () => { alive = false; }; }
    setLoadState("loading"); setError(null);
    void managementRepository.load().then((state) => {
      if (!alive) return;
      const found = state.members.find((candidate) => candidate.id === memberId) ?? null;
      if (!found) { setLoadState("missing"); return; }
      setMember(found);
      setAccount(state.accounts.find((candidate) => candidate.personId === found.id) ?? null);
      setLoadState("ready");
    }).catch(() => { if (alive) setLoadState("error"); });
    return () => { alive = false; };
  }, [memberId, reload, session]);

  const selfDelete = Boolean(member && actor?.personId === member.id);
  const valid = Boolean(member && confirmation.trim() === member.name.trim() && !selfDelete);
  const errorText = useMemo(() => {
    if (!error) return null;
    if (error === "required") return copy.required;
    if (error === "conflict") return copy.conflict;
    if (error === "final-admin") return copy.finalAdmin;
    if (error === "self-delete") return copy.self;
    return copy.failed;
  }, [copy, error]);

  async function submit() {
    if (!member || member.revision == null || !valid || busy) { setError("required"); return; }
    setBusy(true); setError(null);
    try {
      await deleteMember({ personId: member.id, expectedRevision: member.revision, confirmation: confirmation.trim() });
      router.replace("/manage");
    } catch (cause) {
      setError(cause instanceof MemberDeletionError ? cause.code : "unexpected");
    } finally { setBusy(false); }
  }

  if (loadState !== "ready" || !member) {
    const message = loadState === "denied" ? copy.denied : loadState === "missing" ? copy.missing : loadState === "error" ? copy.loadError : copy.loading;
    return <View style={[styles.center, { backgroundColor: palette.background }]}>
      {loadState === "loading" ? <ActivityIndicator color={palette.accent} /> : <Ionicons accessibilityElementsHidden color={palette.danger} name="alert-circle-outline" size={32} />}
      <Text accessibilityLiveRegion="polite" selectable style={[styles.stateText, { color: palette.text }]}>{message}</Text>
      {loadState === "error" ? <Pressable accessibilityRole="button" onPress={() => setReload((value) => value + 1)} style={styles.stateAction}><Text style={{ color: palette.accent, fontWeight: "700" }}>{copy.retry}</Text></Pressable> : null}
      {loadState !== "loading" ? <Pressable accessibilityRole="button" onPress={() => (router.canGoBack() ? router.back() : router.replace("/manage"))} style={styles.stateAction}><Text style={{ color: palette.secondaryText, fontWeight: "600" }}>{copy.cancel}</Text></Pressable> : null}
    </View>;
  }

  return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[styles.content, desktop && styles.desktopContent]} keyboardShouldPersistTaps="handled" style={{ backgroundColor: palette.background }}>
    <View style={[styles.heroIcon, { backgroundColor: palette.dangerSoft }]}><Ionicons accessibilityElementsHidden color={palette.danger} name="trash-outline" size={30} /></View>
    <Text accessibilityRole="header" selectable style={[styles.title, { color: palette.text }]}>{copy.title}</Text>
    <Text selectable style={[styles.detail, { color: palette.secondaryText }]}>{copy.detail}</Text>

    <View style={[styles.identity, { backgroundColor: palette.surface }]}>
      <MemberAvatar backgroundColor={palette.dangerSoft} name={member.name} source={member.photo} size={54} textColor={palette.danger} />
      <View style={styles.flex}><Text selectable style={[styles.memberName, { color: palette.text }]}>{member.name}</Text>{member.group ? <Text numberOfLines={2} style={[styles.secondary, { color: palette.secondaryText }]}>{member.group}</Text> : null}</View>
    </View>

    <View style={[styles.consequences, { backgroundColor: palette.dangerSoft }]}>
      <Consequence icon="key-outline" title={copy.account} detail={account ? `${copy.accountDetail}${account.email ? ` ${account.email}` : ""}` : copy.noAccount} />
      <View style={[styles.separator, { backgroundColor: palette.line }]} />
      <Consequence icon="calendar-clear-outline" title={copy.visits} detail={copy.visitsDetail} />
      <View style={[styles.separator, { backgroundColor: palette.line }]} />
      <Consequence icon="image-outline" detail={copy.photo} />
    </View>

    {selfDelete ? <View style={[styles.inlineError, { borderColor: palette.danger }]}><Ionicons accessibilityElementsHidden color={palette.danger} name="lock-closed-outline" size={20} /><Text selectable style={[styles.inlineErrorText, { color: palette.danger }]}>{copy.self}</Text></View> : <>
      <Text selectable style={[styles.prompt, { color: palette.text }]}>{copy.prompt}</Text>
      <Text selectable style={[styles.confirmName, { color: palette.text }]}>{member.name}</Text>
      <TextInput accessibilityLabel={copy.confirmation} autoCapitalize="words" autoCorrect={false} editable={!busy} onChangeText={(value) => { setConfirmation(value); setError(null); }} placeholder={copy.confirmation} placeholderTextColor={palette.secondaryText} style={[styles.input, { backgroundColor: palette.surface, borderColor: errorText ? palette.danger : palette.line, color: palette.text }]} value={confirmation} />
    </>}

    {errorText ? <Text accessibilityLiveRegion="polite" selectable style={[styles.error, { color: palette.danger }]}>{errorText}</Text> : null}
    <Host style={styles.buttonHost}>
      <Button disabled={busy || !valid} label={busy ? copy.deleting : copy.delete} onPress={() => void submit()} style={{ backgroundColor: palette.danger, borderRadius: 13, height: 54, opacity: busy || !valid ? 0.5 : 1, width: "100%" }} />
    </Host>
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => (router.canGoBack() ? router.back() : router.replace("/manage"))} style={styles.cancel}><Text style={[styles.cancelText, { color: palette.secondaryText }]}>{copy.cancel}</Text></Pressable>
  </ScrollView>;

  function Consequence({ detail, icon, title }: { detail: string; icon: "calendar-clear-outline" | "image-outline" | "key-outline"; title?: string }) {
    return <View style={styles.consequence}><Ionicons accessibilityElementsHidden color={palette.danger} name={icon} size={21} /><View style={styles.flex}>{title ? <Text style={[styles.consequenceTitle, { color: palette.text }]}>{title}</Text> : null}<Text selectable style={[styles.consequenceDetail, { color: palette.secondaryText }]}>{detail}</Text></View></View>;
  }
}

const styles = StyleSheet.create({ desktopContent: { alignSelf: "center", width: "100%", maxWidth: 720, padding: 32 },
  content: { gap: 14, paddingBottom: 48, paddingHorizontal: 22, paddingTop: 26 }, center: { alignItems: "center", flex: 1, gap: 16, justifyContent: "center", padding: 28 },
  heroIcon: { alignItems: "center", borderCurve: "continuous", borderRadius: 30, height: 60, justifyContent: "center", width: 60 }, title: { fontSize: 32, fontWeight: "800", letterSpacing: -0.8, lineHeight: 38 }, detail: { fontSize: 16, lineHeight: 23 },
  identity: { alignItems: "center", borderCurve: "continuous", borderRadius: 16, flexDirection: "row", gap: 13, padding: 14 }, flex: { flex: 1, minWidth: 0 }, memberName: { fontSize: 19, fontWeight: "800", lineHeight: 24 }, secondary: { fontSize: 14, lineHeight: 19, paddingTop: 3 },
  consequences: { borderCurve: "continuous", borderRadius: 16, overflow: "hidden", paddingHorizontal: 15 }, consequence: { alignItems: "flex-start", flexDirection: "row", gap: 12, paddingVertical: 14 }, consequenceTitle: { fontSize: 15, fontWeight: "800", lineHeight: 20 }, consequenceDetail: { fontSize: 14, lineHeight: 20 }, separator: { height: StyleSheet.hairlineWidth },
  prompt: { fontSize: 15, fontWeight: "700", paddingTop: 8 }, confirmName: { fontSize: 20, fontWeight: "800" }, input: { borderCurve: "continuous", borderRadius: 13, borderWidth: 1, fontSize: 17, minHeight: 54, paddingHorizontal: 15 },
  inlineError: { alignItems: "flex-start", borderCurve: "continuous", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 10, padding: 14 }, inlineErrorText: { flex: 1, fontSize: 14, fontWeight: "600", lineHeight: 20 }, error: { fontSize: 14, fontWeight: "600", lineHeight: 20 },
  buttonHost: { minHeight: 54, width: "100%" }, cancel: { alignItems: "center", justifyContent: "center", minHeight: 48 }, cancelText: { fontSize: 16, fontWeight: "600" }, stateText: { fontSize: 17, fontWeight: "700", lineHeight: 24, textAlign: "center" }, stateAction: { alignItems: "center", justifyContent: "center", minHeight: 44, paddingHorizontal: 18 },
});
