import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Text, TextInput } from "@/features/accessibility/app-text";
import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { useSession } from "@/features/session/SessionProvider";
import { canManageAccounts } from "@/lib/permissions";
import { deleteMembers } from "./member-deletion";
import type { ManagedMember } from "./model";

const words = {
  en: {
    title: "Delete selected members?", selected: "Selected members", cancel: "Cancel", close: "Close", remove: "Delete permanently",
    warning: "This cannot be undone. These members, their linked sign-in accounts, private photos, group memberships, and all scheduled and past visits will be deleted, including visit responses and notifications.",
    prompt: "Type DELETE to confirm", token: "DELETE", busy: "Deleting members...", done: "Deletion complete", deleted: "Deleted", remaining: "Not confirmed deleted",
    stopped: "Deletion stopped. No further members were processed. Close to reload and review the remaining members before trying again. Sign-in access or photos for the failed member may already have been removed.",
    conflict: "The member changed. Review the latest record before deleting it.", self: "You cannot delete your own linked member record.", admin: "Another active administrator is required.", denied: "Only active administrators can delete members.",
  },
  uk: {
    title: "Видалити вибраних учасників?", selected: "Вибрані учасники", cancel: "Скасувати", close: "Закрити", remove: "Видалити назавжди",
    warning: "Цю дію неможливо скасувати. Буде видалено цих учасників, пов’язані облікові записи для входу, приватні фото, членство в групах і всі заплановані та минулі відвідування разом із відповідями та сповіщеннями.",
    prompt: "Введіть ВИДАЛИТИ для підтвердження", token: "ВИДАЛИТИ", busy: "Видаляємо учасників...", done: "Видалення завершено", deleted: "Видалено", remaining: "Видалення не підтверджено",
    stopped: "Видалення зупинено. Решту учасників не оброблено. Закрийте вікно, щоб оновити й переглянути решту записів перед повторною спробою. Доступ для входу або фото учасника з помилкою вже могли бути видалені.",
    conflict: "Дані учасника змінилися. Перегляньте актуальний запис перед видаленням.", self: "Ви не можете видалити власний пов’язаний запис учасника.", admin: "Потрібен інший активний адміністратор.", denied: "Лише активні адміністратори можуть видаляти учасників.",
  },
} as const;

export function BulkMemberDeletion({ members, onClose }: { members: readonly ManagedMember[]; onClose: (attempted: boolean) => void }) {
  const { palette } = useAppearance();
  const { locale } = useLocalization();
  const session = useSession();
  const copy = words[locale];
  const actor = session.status === "ready" ? session.account : null;
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof deleteMembers>> | null>(null);
  const submitting = useRef(false);
  const authorized = canManageAccounts(actor);
  const valid = authorized && members.length > 0 && members.every((member) => member.id !== actor?.personId && member.revision != null) && confirmation.trim() === copy.token;
  const completedIds = new Set(result?.completed.map((item) => item.deletedPersonId));
  const errorDetail = result?.error === "conflict" ? copy.conflict : result?.error === "self-delete" ? copy.self : result?.error === "final-admin" ? copy.admin : result?.error === "not-authorized" ? copy.denied : null;
  const close = () => { if (!submitting.current) onClose(result !== null); };

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      if (!submitting.current) onClose(result !== null);
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [onClose, result]);

  async function submit() {
    if (!valid || submitting.current || result) return;
    submitting.current = true;
    setBusy(true);
    try {
      setResult(await deleteMembers(members.map((member) => ({ personId: member.id, expectedRevision: member.revision!, confirmation: member.name.trim() }))));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return <Modal animationType="fade" transparent onRequestClose={close} visible>
    <View style={styles.backdrop}>
      <View role="dialog" aria-modal accessibilityLabel={copy.title} accessibilityViewIsModal style={[styles.dialog, { backgroundColor: palette.background }]}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>{result && !result.error ? copy.done : copy.title}</Text>
          <Text style={[styles.detail, { color: palette.secondaryText }]}>{copy.warning}</Text>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>{copy.selected}: {members.length}</Text>
          {members.map((member) => <View key={member.id} style={[styles.member, { borderBottomColor: palette.line }]}>
            <View style={styles.flex}>
              <Text style={[styles.name, { color: palette.text }]}>{member.name}</Text>
              {member.group ? <Text style={{ color: palette.secondaryText }}>{member.group}</Text> : null}
            </View>
            {result ? <Text style={[styles.memberStatus, { color: completedIds.has(member.id) ? palette.secondaryText : palette.danger }]}>{completedIds.has(member.id) ? copy.deleted : copy.remaining}</Text> : null}
          </View>)}
          {result ? <View accessibilityLiveRegion="polite" style={styles.feedback}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>{copy.deleted}: {result.completed.length} / {members.length}</Text>
            {result.error ? <Text style={[styles.detail, { color: palette.danger }]}>{errorDetail ? `${errorDetail} ` : ""}{copy.stopped}</Text> : null}
          </View> : <>
            {!authorized ? <Text style={{ color: palette.danger }}>{copy.denied}</Text> : null}
            <Text style={[styles.sectionTitle, { color: palette.text }]}>{copy.prompt}</Text>
            <TextInput accessibilityLabel={copy.prompt} autoCapitalize="characters" autoCorrect={false} editable={!busy} value={confirmation} onChangeText={setConfirmation} style={[styles.input, { borderColor: palette.line, color: palette.text, backgroundColor: palette.surface }]} />
          </>}
        </ScrollView>
        <View style={[styles.actions, { borderTopColor: palette.line }]}>
          {busy ? <View accessibilityLiveRegion="polite" style={styles.progress}><ActivityIndicator color={palette.danger} /><Text style={{ color: palette.text }}>{copy.busy}</Text></View> : null}
          {!result ? <Pressable accessibilityRole="button" accessibilityState={{ disabled: !valid || busy }} disabled={!valid || busy} onPress={() => void submit()} style={[styles.button, { backgroundColor: palette.danger, opacity: !valid || busy ? 0.5 : 1 }]}>
            <Ionicons accessibilityElementsHidden name="trash-outline" color="#FFF" size={20} />
            <Text style={styles.buttonText}>{copy.remove}</Text>
          </Pressable> : null}
          <Pressable accessibilityRole="button" disabled={busy} onPress={close} style={[styles.button, { opacity: busy ? 0.5 : 1 }]}><Text style={[styles.buttonText, { color: palette.text }]}>{result ? copy.close : copy.cancel}</Text></Pressable>
        </View>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 16 },
  dialog: { width: "100%", maxWidth: 600, maxHeight: "90%", borderRadius: 8, overflow: "hidden" },
  content: { padding: 20, gap: 14 }, title: { fontSize: 24, fontWeight: "700", lineHeight: 30 }, detail: { fontSize: 15, lineHeight: 22 },
  sectionTitle: { fontSize: 16, fontWeight: "700", lineHeight: 22 }, member: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1, minWidth: 120 }, name: { fontSize: 16, fontWeight: "600", lineHeight: 22 }, memberStatus: { maxWidth: "100%", fontSize: 13 },
  feedback: { gap: 10 }, input: { borderWidth: 1, borderRadius: 8, minHeight: 48, paddingHorizontal: 12, fontSize: 17 },
  actions: { borderTopWidth: StyleSheet.hairlineWidth, padding: 12, gap: 8 }, button: { minHeight: 48, padding: 12, borderRadius: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  buttonText: { color: "#FFF", fontSize: 16, fontWeight: "700", flexShrink: 1, textAlign: "center" }, progress: { flexDirection: "row", justifyContent: "center", gap: 10 },
});