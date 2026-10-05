import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text, TextInput } from "@/features/accessibility/app-text";
import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { useSession } from "@/features/session/SessionProvider";
import { canManageAccounts } from "@/lib/permissions";
import { useUnsavedChanges } from "./use-unsaved-changes";
import { pickMemberCsv } from "./pick-member-csv";
import { importMemberCsv, MemberImportError, MemberCsvError, newMemberImportId, parseMemberCsv, type MemberImportResult, type MemberImportRow } from "./member-import";

const copy = {
  en: {
    title: "Import members", intro: "Choose a CSV with first_name, last_name, and gender (male or female). Optional columns: patronymic, email, phone, birth_date, membership_joined_at, address. Dates use YYYY-MM-DD. Up to 5,000 members and 2 MB.",
    pick: "Choose CSV", add: "Add members", replace: "Replace directory", replacement: "Replace all members, groups, family links, ministries assigned to people, visits, reminders, preferences, photos, and the deacon schedule. Sign-in accounts and their access roles remain. Account-to-member links are cleared and can be recreated afterward.",
    confirm: "Type REPLACE MEMBERS to confirm", review: "Preview", import: "Import members", retry: "Retry this import", busy: "Importing members and removing old photos…", cleanup: "Retry photo cleanup", pending: "Members were imported. Old photo cleanup is pending.", done: "Import completed", accounts: "Accounts can now be linked to the new members. Groups and the deacon schedule can be recreated.", denied: "Only active administrators can import members.", ready: "members ready to import", imported: "Imported", removed: "Replaced", rows: "Showing the first 10 members.", validation: "CSV needs corrections", failed: "Import could not be confirmed. Retry with this same file before starting another import.",
  },
  uk: {
    title: "Імпорт учасників", intro: "Оберіть CSV зі стовпцями first_name, last_name і gender (male або female). Необов’язкові: patronymic, email, phone, birth_date, membership_joined_at, address. Дати у форматі YYYY-MM-DD. До 5 000 учасників і 2 МБ.",
    pick: "Обрати CSV", add: "Додати учасників", replace: "Замінити довідник", replacement: "Буде замінено всіх учасників, групи, родинні зв’язки, призначені служіння, відвідування, нагадування, налаштування, фото й чергування дияконів. Облікові записи для входу та їхні права доступу зберігаються. Зв’язки з учасниками буде очищено; їх можна створити знову.",
    confirm: "Введіть REPLACE MEMBERS для підтвердження", review: "Попередній перегляд", import: "Імпортувати учасників", retry: "Повторити цей імпорт", busy: "Імпортуємо учасників і видаляємо старі фото…", cleanup: "Повторити очищення фото", pending: "Учасників імпортовано. Очищення старих фото ще не завершено.", done: "Імпорт завершено", accounts: "Тепер можна пов’язати облікові записи з новими учасниками, створити групи й розклад чергувань.", denied: "Лише активні адміністратори можуть імпортувати учасників.", ready: "учасників готові до імпорту", imported: "Імпортовано", removed: "Замінено", rows: "Показано перших 10 учасників.", validation: "CSV потребує виправлень", failed: "Результат імпорту не підтверджено. Повторіть імпорт цього файлу перед початком іншого.",
  },
} as const;

export function MemberImportScreen() {
  const { palette } = useAppearance();
  const { locale } = useLocalization();
  const session = useSession();
  const labels = copy[locale];
  const allowed = session.status === "ready" && canManageAccounts(session.account);
  const [file, setFile] = useState<{ name: string; text: string; rows: MemberImportRow[] } | null>(null);
  const [mode, setMode] = useState<"add" | "replace">("add");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MemberImportResult | null>(null);
  const operationId = useRef(newMemberImportId());
  const running = useRef(false);
  useUnsavedChanges(busy || (attempted && result?.status !== "completed"));
  const button = { minHeight: 48, padding: 12, borderRadius: 10, backgroundColor: palette.accent };
  async function choose() {
    if (running.current || attempted) return;
    setError(null);
    try {
      const picked = await pickMemberCsv();
      if (!picked) return;
      const rows = parseMemberCsv(picked.text);
      setFile({ ...picked, rows });
      operationId.current = newMemberImportId();
    } catch (cause) {
      setFile(null);
      setError(cause instanceof MemberCsvError ? `${labels.validation}\n${cause.issues.slice(0, 20).map(issue => `${issue.row} · ${issue.field}: ${issue.message}`).join("\n")}` : cause instanceof Error ? cause.message : labels.validation);
    }
  }
  async function submit() {
    if (!allowed || !file || running.current || (mode === "replace" && confirmation !== "REPLACE MEMBERS")) return;
    running.current = true;
    setBusy(true); setAttempted(true); setError(null);
    try {
      setResult(await importMemberCsv(result?.status === "cleanup-pending"
        ? { action: "retry-cleanup", importId: operationId.current }
        : { action: "import", importId: operationId.current, csv: file.text, mode, confirmation }));
    } catch (cause) {
      if (cause instanceof MemberImportError && cause.outcome === "rejected" && !result) setAttempted(false);
      setError(cause instanceof Error ? cause.message : labels.failed);
    }
    finally { running.current = false; setBusy(false); }
  }
  if (!allowed) return <View style={styles.page}><Text style={{ color: palette.text }}>{labels.denied}</Text></View>;
  return <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <View style={styles.content}>
      <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>{labels.title}</Text>
      <Text style={{ color: palette.secondaryText }}>{labels.intro}</Text>
      <Pressable accessibilityRole="button" disabled={busy || attempted} accessibilityState={{ disabled: busy || attempted }} onPress={choose} style={[button, (busy || attempted) && styles.disabled]}><Text style={styles.buttonText}>{labels.pick}</Text></Pressable>
      {file ? <>
        <Text style={{ color: palette.text }}>{file.name} · {file.rows.length} {labels.ready}</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel={labels.title} style={styles.choices}>
          {(["add", "replace"] as const).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: mode === value, disabled: busy || attempted }} disabled={busy || attempted} onPress={() => setMode(value)} style={[styles.option, { borderColor: mode === value ? palette.accent : palette.line, backgroundColor: palette.surface }]}><Text style={{ color: palette.text }}>{mode === value ? "● " : "○ "}{labels[value]}</Text></Pressable>)}
        </View>
        {mode === "replace" ? <>
          <Text style={{ color: palette.text }}>{labels.replacement}</Text>
          <Text style={{ color: palette.text }}>{labels.confirm}</Text>
          <TextInput accessibilityLabel={labels.confirm} editable={!busy && !attempted} autoCapitalize="characters" autoCorrect={false} value={confirmation} onChangeText={setConfirmation} style={[styles.input, { color: palette.text, borderColor: palette.line, backgroundColor: palette.surface }]} />
        </> : null}
        <Text accessibilityRole="header" style={{ color: palette.text }}>{labels.review}</Text>
        <Text style={{ color: palette.secondaryText }}>{labels.rows}</Text>
        {file.rows.slice(0, 10).map((member, index) => <Text key={index} style={{ color: palette.text }}>{[member.first_name, member.patronymic, member.last_name].filter(Boolean).join(" ")} · {member.gender}</Text>)}
        {result ? <View accessibilityLiveRegion="polite" style={styles.feedback}>
          <Text style={{ color: palette.text }}>{result.status === "completed" ? labels.done : labels.pending}</Text>
          <Text style={{ color: palette.text }}>{labels.imported}: {result.importedCount} · {labels.removed}: {result.replacedCount}</Text>
          {mode === "replace" ? <Text style={{ color: palette.secondaryText }}>{labels.accounts}</Text> : null}
        </View> : null}
        {result?.status !== "completed" ? <Pressable accessibilityRole="button" disabled={busy || (mode === "replace" && confirmation !== "REPLACE MEMBERS")} accessibilityState={{ disabled: busy || (mode === "replace" && confirmation !== "REPLACE MEMBERS") }} onPress={submit} style={[button, (busy || (mode === "replace" && confirmation !== "REPLACE MEMBERS")) && styles.disabled]}><Text style={styles.buttonText}>{result?.status === "cleanup-pending" ? labels.cleanup : attempted ? labels.retry : labels.import}</Text></Pressable> : null}
      </> : null}
      {busy ? <View accessibilityLiveRegion="polite" style={styles.feedback}><ActivityIndicator color={palette.accent} /><Text style={{ color: palette.text }}>{labels.busy}</Text></View> : null}
      {error ? <Text accessibilityLiveRegion="polite" selectable style={{ color: palette.text }}>{error}</Text> : null}
    </View>
  </ScrollView>;
}
const styles = StyleSheet.create({
  page: { padding: 20, flexGrow: 1 }, content: { alignSelf: "center", width: "100%", maxWidth: 760, gap: 16 }, title: { fontSize: 28, fontWeight: "700" },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 12 }, option: { minHeight: 48, padding: 12, borderRadius: 10, borderWidth: 1 }, input: { minHeight: 48, padding: 12, borderRadius: 10, borderWidth: 1 }, buttonText: { color: "#fff", fontWeight: "700", textAlign: "center" }, disabled: { opacity: 0.5 }, feedback: { gap: 10 },
});
