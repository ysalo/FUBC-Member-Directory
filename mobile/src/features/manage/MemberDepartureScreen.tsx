import { useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text, TextInput } from "@/features/accessibility/app-text";
import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { NativeDateTimeField } from "@/features/forms/NativeDateTimeField";
import { acceptsDateFieldValue, localDateValue } from "@/features/forms/date-field";
import { useSession } from "@/features/session/SessionProvider";
import { Alert } from "@/features/platform/alert";
import { canManageDirectory } from "@/lib/permissions";
import { formatMemberName } from "@/lib/member-name";
import type { MemberDepartureRow } from "@/lib/database";
import { managementRepository } from "./management-repository";
import type { ManagedMember } from "./model";
import { useUnsavedChanges } from "./use-unsaved-changes";

type Reason = MemberDepartureRow["reason"];
const reasons: Reason[] = ["different_church", "died", "excommunicated", "other"];

export function MemberDepartureScreen() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const router = useRouter();
  const { palette } = useAppearance();
  const { locale } = useLocalization();
  const session = useSession();
  const allowed = session.status === "ready" && canManageDirectory(session.account);
  const [member, setMember] = useState<ManagedMember | null>(null);
  const [history, setHistory] = useState<MemberDepartureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateLeft, setDateLeft] = useState(localDateValue(new Date()));
  const [reason, setReason] = useState<Reason | null>(null);
  const [otherDetail, setOtherDetail] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [error, setError] = useState(false);
  const guard = useUnsavedChanges(Boolean(reason || notes || otherDetail || dateLeft !== localDateValue(new Date())));
  const copy = locale === "uk" ? {
    title: "Вихід із членства", date: "Дата виходу", reason: "Причина", different_church: "Перехід до іншої церкви", died: "Смерть", excommunicated: "Відлучення", other: "Інше", detail: "Коротко опишіть причину (до 160 символів)", notes: "Додаткова інформація", save: "Зберегти вихід із членства", cancel: "Скасувати", error: "Не вдалося зберегти або завантажити запис. Оновіть сторінку та спробуйте ще раз.", history: "Історія виходу з членства", confirm: "Зберегти запис і позначити учасника як того, хто вийшов із членства?", denied: "Немає доступу", restored: "Членство відновлено", legacy: "Історичний запис: дата взята з архівування, причину не було записано.", retry: "Спробувати ще раз"
  } : {
    title: "Leaving membership", date: "Date left", reason: "Reason", different_church: "Went to a different church", died: "Died", excommunicated: "Excommunicated", other: "Other", detail: "Brief reason (up to 160 characters)", notes: "Additional notes", save: "Save departure", cancel: "Cancel", error: "Unable to save or load this record. Reload and try again.", history: "Departure history", confirm: "Save this departure and mark the member as having left membership?", denied: "Access unavailable", restored: "Membership restored", legacy: "Historical record: date taken from archival; reason was not recorded.", retry: "Try again"
  };
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!allowed || !memberId) return;
    let alive = true;
    setLoading(true); setError(false);
    Promise.all([managementRepository.loadMember(memberId), managementRepository.listMemberDepartures(memberId)])
      .then(([person, records]) => { if (alive) { setMember(person ?? null); setHistory(records); } })
      .catch(() => { if (alive) setError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [allowed, memberId, reload]);
  const valid = Boolean(reason && dateLeft && acceptsDateFieldValue(dateLeft, "date", localDateValue(new Date())) && (reason !== "other" || (otherDetail.trim() && otherDetail.length <= 160 && !/[\n\r]/.test(otherDetail))) && notes.length <= 5000);
  function confirm() {
    if (!member || member.archived || !valid || saving.current || !reason) return;
    const person = member, selectedReason = reason;
    Alert.alert(copy.title, `${formatMemberName(person)}\n${copy.confirm}`, [
      { text: copy.cancel, style: "cancel" },
      { text: copy.save, style: "destructive", onPress: async () => {
        if (saving.current) return;
        saving.current = true; setBusy(true); setError(false);
        try {
          await managementRepository.recordMemberDeparture(person, { dateLeft, reason: selectedReason, otherDetail, notes });
          guard.allowLeave();
          router.replace("/manage");
        } catch { setError(true); setBusy(false); } finally { saving.current = false; }
      } }
    ]);
  }
  if (!allowed) return <View style={styles.page}><Text style={{ color: palette.text }}>{copy.denied}</Text></View>;
  const field = { backgroundColor: palette.surface, borderColor: palette.line, color: palette.text };
  return <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.page, { backgroundColor: palette.background }]}>
    <Text style={[styles.title, { color: palette.text }]}>{copy.title}</Text>
    {loading ? <ActivityIndicator color={palette.accent} /> : null}
    {error ? <View><Text accessibilityRole="alert" style={{ color: palette.danger }}>{copy.error}</Text>{!member && <Pressable accessibilityRole="button" onPress={() => setReload(value => value + 1)}><Text style={{ color: palette.accent }}>{copy.retry}</Text></Pressable>}</View> : null}
    {member ? <>
      <Text style={[styles.name, { color: palette.text }]}>{formatMemberName(member)}</Text>
      {!member.archived && <View style={styles.form}>
        <Text style={{ color: palette.text }}>{copy.date} *</Text>
        <NativeDateTimeField accessibilityLabel={copy.date} mode="date" maximumDate={new Date()} value={dateLeft} onChange={setDateLeft} disabled={busy} accentColor={palette.accent} backgroundColor={palette.surface} borderColor={palette.line} textColor={palette.text} />
        <Text style={{ color: palette.text }}>{copy.reason} *</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel={copy.reason}>
          {reasons.map(value => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={copy[value]} accessibilityState={{ checked: reason === value, disabled: busy }} aria-checked={reason === value} disabled={busy} onPress={() => setReason(value)} style={[styles.radio, { borderColor: palette.line, backgroundColor: palette.surface }]}><Text style={{ color: reason === value ? palette.accent : palette.text }}>{reason === value ? "◉" : "○"}  {copy[value]}</Text></Pressable>)}
        </View>
        {reason === "other" && <><Text style={{ color: palette.text }}>{copy.detail} *</Text><TextInput accessibilityLabel={copy.detail} editable={!busy} maxLength={160} value={otherDetail} onChangeText={setOtherDetail} style={[styles.input, field]} /></>}
        <Text style={{ color: palette.text }}>{copy.notes}</Text>
        <TextInput accessibilityLabel={copy.notes} editable={!busy} multiline maxLength={5000} value={notes} onChangeText={setNotes} style={[styles.input, styles.notes, field]} />
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !valid || busy }} disabled={!valid || busy} onPress={confirm} style={[styles.button, { backgroundColor: palette.danger, opacity: !valid || busy ? 0.5 : 1 }]}><Text style={{ color: "#fff", fontWeight: "700" }}>{busy ? "…" : copy.save}</Text></Pressable>
      </View>}
      {history.length > 0 && <Text style={[styles.name, { color: palette.text }]}>{copy.history}</Text>}
      {history.map(record => <View key={record.id} style={[styles.record, { backgroundColor: palette.surface, borderColor: palette.line }]}>
        <Text style={{ color: palette.text }}>{[record.first_name, record.patronymic, record.last_name].filter(Boolean).join(" ")}</Text>
        <Text style={{ color: palette.text }}>{copy.date}: {record.date_left}</Text>
        <Text style={{ color: palette.text }}>{copy.reason}: {record.legacy ? copy.legacy : copy[record.reason]}</Text>
        {!record.legacy && record.other_detail ? <Text style={{ color: palette.text }}>{record.other_detail}</Text> : null}
        {record.notes ? <Text style={{ color: palette.text }}>{copy.notes}: {record.notes}</Text> : null}
        {record.restored_at ? <Text style={{ color: palette.secondaryText }}>{copy.restored}: {localDateValue(new Date(record.restored_at))}</Text> : null}
      </View>)}
    </> : null}
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => guard.confirmLeave(() => router.replace(`/manage/member/${encodeURIComponent(memberId)}` as never))} style={styles.button}><Text style={{ color: palette.accent }}>{copy.cancel}</Text></Pressable>
  </ScrollView>;
}
const styles = StyleSheet.create({ page: { padding: 22, gap: 16, flexGrow: 1, width: "100%", maxWidth: 800, alignSelf: "center" }, title: { fontSize: 30, fontWeight: "800", marginTop: 20 }, name: { fontSize: 20, fontWeight: "600" }, form: { gap: 12 }, radio: { minHeight: 48, padding: 14, borderWidth: 1, borderRadius: 12, marginBottom: 8 }, input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16, minHeight: 48 }, notes: { minHeight: 110, textAlignVertical: "top" }, button: { minHeight: 48, borderRadius: 12, padding: 14, alignItems: "center", justifyContent: "center" }, record: { padding: 16, borderRadius: 12, borderWidth: 1, gap: 8 } });
