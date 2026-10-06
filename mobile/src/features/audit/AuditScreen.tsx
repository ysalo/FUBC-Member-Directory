import { Redirect } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text, TextInput } from "@/features/accessibility/app-text";
import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { useSession } from "@/features/session/SessionProvider";
import { useDesktopLayout } from "@/features/shell/use-desktop-layout";
import { canManageAccounts } from "@/lib/permissions";
import { errorMessage, withTimeout } from "@/lib/async-state";
import { auditRepository, type AuditAction, type AuditChange, type AuditFilters, type AuditPage, type RollbackPreview } from "./audit-repository";

const labels = {
  en: { title: "Audit history", subtitle: "Member and group changes, newest first", actor: "Actor ID", action: "Action type", subject: "Member or group ID", from: "From (YYYY-MM-DD)", to: "Through (YYYY-MM-DD)", filter: "Apply filters", clear: "Clear filters", empty: "No matching actions", previous: "Previous", next: "Next", before: "Before", after: "After", unknown: "Unknown actor", legacy: "Legacy — snapshots and rollback unavailable", irreversible: "Irreversible", preview: "Preview rollback", reason: "Reason for rollback", confirm: "Confirm rollback", cancel: "Cancel", photos: "Previous photos are lost and cannot be restored. Directory restoration does not re-enable linked accounts.", account: "Directory restoration leaves account re-enablement separate.", success: "Rollback recorded. Directory reads have been refreshed.", retry: "Retry", changes: "Affected records", proposed: "Proposed", current: "Current", supported: "Restoration supported", loading: "Loading…" },
  uk: { title: "Історія змін", subtitle: "Зміни учасників і груп, спочатку найновіші", actor: "ID автора", action: "Тип дії", subject: "ID учасника або групи", from: "Від (РРРР-ММ-ДД)", to: "До (РРРР-ММ-ДД)", filter: "Застосувати фільтри", clear: "Очистити фільтри", empty: "Відповідних дій немає", previous: "Попередні", next: "Наступні", before: "До", after: "Після", unknown: "Невідомий автор", legacy: "Старий запис — знімки та відновлення недоступні", irreversible: "Незворотна дія", preview: "Переглянути відновлення", reason: "Причина відновлення", confirm: "Підтвердити відновлення", cancel: "Скасувати", photos: "Попередні фото втрачено; їх неможливо відновити. Відновлення довідника не вмикає доступ облікового запису.", account: "Відновлення доступу облікового запису виконується окремо.", success: "Відновлення записано. Дані довідника оновлено.", retry: "Повторити", changes: "Змінені записи", proposed: "Запропоновано", current: "Зараз", supported: "Відновлення підтримується", loading: "Завантаження…" },
} as const;

const restorationExplanations = {
  en: { legacy: "Legacy entry: before/after snapshots are unavailable.", irreversible: "Permanent deletion and directory replacement are irreversible.", conflict: "Conflicting later changes block the whole rollback.", photo_only: "Photo metadata only: previous image files cannot be restored.", invariant: "Current directory rules block the whole rollback.", record_changed: "Created record was subsequently changed or removed.", dependencies: "Later dependent records would be lost.", identifier_used: "Deleted record identifier is already in use.", field_changed: "This field changed after the selected action." },
  uk: { legacy: "Старий запис: знімки до та після недоступні.", irreversible: "Видалення назавжди та заміна довідника незворотні.", conflict: "Пізніші зміни конфліктують; відновлення всієї дії заблоковано.", photo_only: "Змінено лише дані фото: попередні файли зображень відновити неможливо.", invariant: "Поточні правила довідника блокують відновлення всієї дії.", record_changed: "Створений запис згодом було змінено або вилучено.", dependencies: "Буде втрачено пізніші пов’язані записи.", identifier_used: "Ідентифікатор видаленого запису вже використовується.", field_changed: "Це поле змінилося після вибраної дії." },
} as const;

export function AuditScreen() {
  const desktop = useDesktopLayout(), session = useSession();
  const { palette } = useAppearance(), { locale } = useLocalization(), copy = labels[locale];
  const actor = session.status === "ready" ? session.account : null;
  const allowed = desktop && canManageAccounts(actor);
  const explanation = (code: string | undefined, fallback: string) => restorationExplanations[locale][code as keyof typeof restorationExplanations.en] ?? fallback;
  const [draft, setDraft] = useState<AuditFilters>({}), [filters, setFilters] = useState<AuditFilters>({});
  const [page, setPage] = useState<AuditPage<AuditAction>>({ items: [], total: 0 }), [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null), [details, setDetails] = useState<AuditPage<AuditChange>>({ items: [], total: 0 }), [detailOffset, setDetailOffset] = useState(0);
  const [plan, setPlan] = useState<RollbackPreview | null>(null), [planOffset, setPlanOffset] = useState(0), [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(false), [failure, setFailure] = useState<string | null>(null), [notice, setNotice] = useState<string | null>(null), [reload, setReload] = useState(0);
  const request = useRef(0), operation = useRef<{ key: string; id: string } | null>(null);
  useEffect(() => {
    const generation = ++request.current;
    setSelected(null); setDetails({ items: [], total: 0 }); setPlan(null); setReason(""); setFailure(null); setBusy(false);
    if (!allowed) { setPage({ items: [], total: 0 }); return; }
    setLoading(true);
    void withTimeout(auditRepository.history(filters, offset)).then(result => { if (request.current === generation) setPage(result); })
      .catch(error => { if (request.current === generation) setFailure(errorMessage(error)); })
      .finally(() => { if (request.current === generation) setLoading(false); });
    return () => { request.current++; };
  }, [allowed, actor?.id, filters, offset, reload]);

  async function expand(id: string, start = 0) {
    const generation = ++request.current;
    setSelected(id); setDetails({ items: [], total: 0 }); setDetailOffset(start); setPlan(null); setReason(""); setFailure(null); setBusy(true);
    try { const result = await withTimeout(auditRepository.details(id, start)); if (request.current === generation) setDetails(result); }
    catch (error) { if (request.current === generation) setFailure(errorMessage(error)); }
    finally { if (request.current === generation) setBusy(false); }
  }
  async function preview(start = 0) {
    if (!selected || busy) return;
    const generation = request.current;
    setBusy(true); setFailure(null);
    try { const result = await withTimeout(auditRepository.preview(selected, start)); if (request.current === generation) { setPlan(result); setPlanOffset(start); } }
    catch (error) { if (request.current === generation) setFailure(errorMessage(error)); }
    finally { if (request.current === generation) setBusy(false); }
  }
  async function confirm() {
    if (!selected || busy || !plan?.available || !reason.trim()) return;
    const generation = request.current, key = `${selected}:${reason.trim()}`;
    if (operation.current?.key !== key) operation.current = { key, id: crypto.randomUUID() };
    setBusy(true); setFailure(null);
    try {
      await withTimeout(auditRepository.rollback(selected, operation.current.id, reason.trim()));
      if (request.current === generation) { setReload(value => value + 1); setNotice(copy.success); }
    } catch (error) {
      if (request.current === generation) {
        setFailure(errorMessage(error));
        // Refresh authoritative conflicts after a stale preview; retain the same
        // operation ID/reason so a lost-response retry is safe.
        try { const fresh = await auditRepository.preview(selected, planOffset); if (request.current === generation) setPlan(fresh); } catch {}
      }
    } finally { if (request.current === generation) setBusy(false); }
  }
  if (!allowed) return <Redirect href="/manage" />;
  const inputStyle = [styles.input, { color: palette.text, backgroundColor: palette.surface, borderColor: palette.line }];
  return <ScrollView contentContainerStyle={styles.content} style={{ backgroundColor: palette.background }}>
    <Text style={[styles.title, { color: palette.text }]}>{copy.title}</Text>
    <Text style={{ color: palette.secondaryText }}>{copy.subtitle}</Text>
    <View style={styles.filters}>
      {([['from', copy.from], ['to', copy.to], ['actor', copy.actor], ['action', copy.action], ['subject', copy.subject]] as const).map(([key, label]) => <View key={key} style={styles.filter}>
        <Text style={{ color: palette.secondaryText }}>{label}</Text><TextInput accessibilityLabel={label} autoCapitalize="none" value={draft[key] ?? ""} onChangeText={value => setDraft(current => ({ ...current, [key]: value }))} style={inputStyle} />
      </View>)}
    </View>
    <View style={styles.buttons}><Action label={copy.filter} disabled={busy} onPress={() => { setOffset(0); setFilters({ ...draft }); }} /><Action label={copy.clear} disabled={busy} onPress={() => { setDraft({}); setFilters({}); setOffset(0); }} /></View>
    {failure ? <View><Text accessibilityLiveRegion="polite" selectable style={{ color: palette.danger }}>{failure}</Text><Action label={copy.retry} disabled={busy} onPress={() => selected ? void expand(selected, detailOffset) : setReload(value => value + 1)} /></View> : null}
    {notice ? <Text accessibilityLiveRegion="polite" style={{ color: palette.success }}>{notice}</Text> : null}
    {loading ? <ActivityIndicator accessibilityLabel={copy.loading} color={palette.accent} /> : <>
      {!page.items.length ? <Text style={{ color: palette.secondaryText }}>{copy.empty}</Text> : null}
      {page.items.map(action => <View key={action.id} style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.line }]}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: selected === action.id }} disabled={busy} onPress={() => selected === action.id ? (setSelected(null), setPlan(null)) : void expand(action.id)} style={styles.row}>
          <View style={styles.grow}><Text style={[styles.heading, { color: palette.text }]}>{action.action}</Text><Text selectable style={{ color: palette.secondaryText }}>{action.actor_name || copy.unknown} · {action.actor_id ?? '—'} · {new Date(action.created_at).toLocaleString(locale)}</Text></View>
          <Text style={{ color: palette.secondaryText }}>{action.change_count} · {action.restoration === "legacy" ? copy.legacy : action.restoration === "irreversible" ? copy.irreversible : copy.supported}</Text>
        </Pressable>
        {selected === action.id ? <View style={styles.expanded}>
          {action.original_action_id ? <Text selectable style={{ color: palette.secondaryText }}>{action.original_action_id} · {action.reason}</Text> : null}
          {busy ? <ActivityIndicator color={palette.accent} /> : null}
          <Text style={[styles.heading, { color: palette.text }]}>{copy.changes}</Text>
          {details.items.map(change => <View key={change.id} style={styles.record}><Text selectable style={{ color: palette.text }}>{change.entity} · {JSON.stringify(change.record_key)}</Text><Comparison left={change.before_data} right={change.after_data} leftLabel={copy.before} rightLabel={copy.after} /></View>)}
          <Pagination start={detailOffset} total={details.total} previous={() => void expand(action.id, detailOffset - 25)} next={() => void expand(action.id, detailOffset + 25)} />
          {action.restoration === "supported" ? <Action label={copy.preview} disabled={busy} onPress={() => void preview()} /> : null}
          {plan ? <View style={[styles.preview, { borderColor: palette.line }]}>
            <Text style={[styles.heading, { color: palette.text }]}>{copy.preview}</Text>
            <Text style={{ color: palette.secondaryText }}>{copy.account}</Text>
            {plan.photoLimitations ? <Text selectable style={{ color: palette.danger }}>{copy.photos}</Text> : null}
            {plan.reason ? <Text selectable style={{ color: palette.danger }}>{explanation(plan.reasonCode, plan.reason)}</Text> : null}
            {plan.conflicts.map((conflict, i) => <Text key={i} selectable style={{ color: palette.danger }}>{conflict.entity} {JSON.stringify(conflict.key)} · {conflict.field}: {explanation(conflict.code, conflict.reason)}</Text>)}
            {plan.changes.map((change, i) => <View key={i} style={styles.record}><Text selectable style={{ color: palette.text }}>{change.entity} · {JSON.stringify(change.key)} · {change.fields.join(', ')}</Text><Comparison left={change.current} right={change.proposed} leftLabel={copy.current} rightLabel={copy.proposed} /></View>)}
            <Pagination start={planOffset} total={plan.total} previous={() => void preview(planOffset - 25)} next={() => void preview(planOffset + 25)} />
            {plan.available ? <><Text style={{ color: palette.text }}>{copy.reason}</Text><TextInput accessibilityLabel={copy.reason} value={reason} editable={!busy} onChangeText={setReason} maxLength={2000} multiline style={inputStyle} /><View style={styles.buttons}><Action label={copy.confirm} disabled={busy || !reason.trim()} onPress={() => void confirm()} /><Action label={copy.cancel} disabled={busy} onPress={() => setPlan(null)} /></View></> : null}
          </View> : null}
        </View> : null}
      </View>)}
      <Pagination start={offset} total={page.total} previous={() => setOffset(offset - 25)} next={() => setOffset(offset + 25)} />
    </>}
  </ScrollView>;
  function Action({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
    return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.button, { backgroundColor: palette.accentSoft, opacity: disabled ? 0.5 : 1 }]}><Text style={{ color: palette.accent, fontWeight: "700" }}>{label}</Text></Pressable>;
  }
  function Comparison({ left, right, leftLabel, rightLabel }: { left: unknown; right: unknown; leftLabel: string; rightLabel: string }) {
    return <View style={styles.comparison}>{[[leftLabel, left], [rightLabel, right]].map(([label, value], index) => <View key={index} style={[styles.jsonColumn, { backgroundColor: palette.background }]}><Text style={{ color: palette.secondaryText }}>{String(label)}</Text><Text selectable style={[styles.json, { color: palette.text }]}>{JSON.stringify(value, null, 2)}</Text></View>)}</View>;
  }
  function Pagination({ start, total, previous, next }: { start: number; total: number; previous: () => void; next: () => void }) {
    if (total <= 25) return null;
    return <View style={styles.buttons}><Action label={copy.previous} disabled={busy || start === 0} onPress={previous} /><Text style={{ color: palette.secondaryText }}>{start + 1}–{Math.min(start + 25, total)} / {total}</Text><Action label={copy.next} disabled={busy || start + 25 >= total} onPress={next} /></View>;
  }
}
const styles = StyleSheet.create({
  content: { padding: 32, gap: 16, width: "100%", maxWidth: 1600, alignSelf: "center" }, title: { fontSize: 30, fontWeight: "800" }, heading: { fontSize: 17, fontWeight: "700" },
  filters: { flexDirection: "row", gap: 12, flexWrap: "wrap" }, filter: { flex: 1, minWidth: 170, gap: 6 }, input: { borderWidth: 1, borderRadius: 10, padding: 12, minHeight: 48, fontSize: 15 },
  buttons: { flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" }, button: { paddingHorizontal: 16, paddingVertical: 12, minHeight: 44, borderRadius: 10, justifyContent: "center" },
  card: { borderWidth: 1, borderRadius: 14, overflow: "hidden" }, row: { padding: 18, flexDirection: "row", gap: 18, flexWrap: "wrap" }, grow: { flex: 1, minWidth: 240, gap: 6 }, expanded: { padding: 18, gap: 16 }, record: { gap: 8 },
  comparison: { flexDirection: "row", gap: 12 }, jsonColumn: { flex: 1, minWidth: 0, padding: 14, borderRadius: 10, gap: 8 }, json: { fontFamily: "monospace", fontSize: 13, lineHeight: 20 }, preview: { borderWidth: 1, borderRadius: 12, padding: 18, gap: 14 },
});
