import { Text } from "@/features/accessibility/app-text";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { listDirectory } from "@/features/directory/directory-repository";
import type { Member } from "@/features/directory/members";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { canManageSettings } from "@/lib/permissions";
import { useSession } from "@/features/session/SessionProvider";
import { errorMessage } from "@/lib/async-state";
import { ProfileAvatar } from "@/features/members/ProfileAvatar";
import { DeaconPickerSheet } from "./DeaconPickerSheet";
import { todayFixedPdt } from "./DutySummary";
import { fridayBeforeSunday, moveCandidate, weekendLabel, type DutyCandidate } from "./duty-domain";
import { dutyRepository, type DutyYear } from "./duty-repository";

const labels = {
  en: {
    title: "Schedule",
    subtitle: "Generate the year, then reassign individual weekends as needed.",
    year: "Year",
    generate: "Generate {year} schedule",
    regenerate: "Regenerate {year} schedule",
    generating: "Generating…",
    replaceWarning: "This replaces every weekend already generated for {year}.",
    noAccess: "You don’t have permission to manage the schedule.",
    loading: "Loading…",
    error: "Couldn’t load the schedule",
    retry: "Try again",
    noDeacons: "No active deacons are available to schedule yet.",
    rotationOrder: "Rotation order",
    reorderHint: "Use the arrows to set the repeating order before generating.",
    moveUp: (name: string) => `Move ${name} up`,
    moveDown: (name: string) => `Move ${name} down`,
    schedule: "Generated schedule",
    empty: "Nothing generated for this year yet.",
    reassign: "Tap a weekend to reassign it to a different deacon.",
    pickerTitle: "Reassign this weekend",
    pickerSearch: "Search deacons",
    pickerNoMatches: "No deacons match your search.",
    done: "Done",
  },
  uk: {
    title: "Розклад",
    subtitle: "Створіть рік, потім за потреби змініть окремі вихідні.",
    year: "Рік",
    generate: "Створити розклад на {year}",
    regenerate: "Створити розклад на {year} знову",
    generating: "Створення…",
    replaceWarning: "Це замінить усі вже створені вихідні на {year}.",
    noAccess: "У вас немає дозволу керувати розкладом.",
    loading: "Завантаження…",
    error: "Не вдалося завантажити розклад",
    retry: "Спробувати ще раз",
    noDeacons: "Поки немає активних дияконів для розкладу.",
    rotationOrder: "Порядок чергування",
    reorderHint: "Стрілками встановіть порядок повторення перед створенням.",
    moveUp: (name: string) => `Перемістити ${name} вгору`,
    moveDown: (name: string) => `Перемістити ${name} вниз`,
    schedule: "Створений розклад",
    empty: "На цей рік ще нічого не створено.",
    reassign: "Торкніться вихідних, щоб призначити іншого диякона.",
    pickerTitle: "Змінити диякона на ці вихідні",
    pickerSearch: "Пошук дияконів",
    pickerNoMatches: "Дияконів не знайдено.",
    done: "Готово",
  },
} as const;

export function DutyScheduleManagementScreen() {
  const { palette } = useAppearance();
  const { locale } = useLocalization();
  const session = useSession();
  const copy = labels[locale];
  const actor = session.status === "ready" ? session.account : null;
  const allowed = canManageSettings(actor);
  const today = todayFixedPdt();
  const [year, setYear] = useState(() => Number(today.slice(0, 4)));
  const [state, setState] = useState<{ status: "loading" | "error" | "ready"; year?: DutyYear; message?: string }>({ status: "loading" });
  const [saving, setSaving] = useState(false);
  const [reassignSundayOn, setReassignSundayOn] = useState<string | null>(null);
  const [orderedDeacons, setOrderedDeacons] = useState<DutyCandidate[]>([]);

  const load = useCallback(() => {
    if (!allowed) return;
    setState({ status: "loading" });
    dutyRepository
      .loadYear(year)
      .then((loaded) => {
        setState({ status: "ready", year: loaded });
        setOrderedDeacons(loaded.eligibleDeacons);
      })
      .catch((cause) => setState({ status: "error", message: errorMessage(cause) }));
  }, [allowed, year]);
  useFocusEffect(useCallback(load, [load]));

  const [directoryMembers, setDirectoryMembers] = useState<Member[]>([]);
  useFocusEffect(useCallback(() => {
    listDirectory().then(setDirectoryMembers).catch(() => setDirectoryMembers([]));
  }, []));
  const memberById = useMemo(() => new Map(directoryMembers.map((member) => [member.id, member])), [directoryMembers]);

  const orderedIds = useMemo(() => orderedDeacons.map((deacon) => deacon.personId), [orderedDeacons]);
  const hasGeneratedSchedule = state.status === "ready" && state.year!.periods.length > 0;

  const generate = () => {
    if (state.status !== "ready" || orderedIds.length === 0) return;
    setSaving(true);
    dutyRepository
      .saveRotation(year, orderedIds)
      .then((saved) => setState({ status: "ready", year: saved }))
      .catch((cause) => setState({ status: "error", message: errorMessage(cause) }))
      .finally(() => setSaving(false));
  };

  const reassigningPeriod = state.status === "ready" ? state.year!.periods.find((period) => period.sundayOn === reassignSundayOn) : undefined;

  const reassign = (deacon: DutyCandidate) => {
    if (!reassigningPeriod) return;
    setSaving(true);
    setReassignSundayOn(null);
    dutyRepository
      .reassignPeriod(year, reassigningPeriod.sundayOn, deacon.personId, reassigningPeriod.revision)
      .then((saved) => setState({ status: "ready", year: saved }))
      .catch((cause) => setState({ status: "error", message: errorMessage(cause) }))
      .finally(() => setSaving(false));
  };

  if (!allowed) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
        <Text style={[styles.title, { color: palette.text }]}>{copy.title}</Text>
        <Text style={[styles.subtitle, { color: palette.secondaryText }]}>{copy.noAccess}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>{copy.title}</Text>
        <Text style={[styles.subtitle, { color: palette.secondaryText }]}>{copy.subtitle}</Text>

        <View style={styles.yearRow}>
          <Text style={[styles.yearLabel, { color: palette.secondaryText }]}>{copy.year}</Text>
          <Text style={[styles.year, { color: palette.text }]}>{year}</Text>
        </View>

        {state.status === "loading" ? (
          <ActivityIndicator color={palette.accent} style={styles.spacerTop} />
        ) : state.status === "error" ? (
          <View style={styles.spacerTop}>
            <Text style={{ color: palette.text }}>{copy.error}</Text>
            <Pressable accessibilityRole="button" onPress={load} style={[styles.retryButton, { backgroundColor: palette.accent }]}>
              <Text style={styles.retryText}>{copy.retry}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.line }]}>
              <Text style={[styles.eyebrow, { color: palette.secondaryText }]}>{copy.rotationOrder}</Text>
              <Text style={[styles.reorderHint, { color: palette.secondaryText }]}>{copy.reorderHint}</Text>
              {orderedDeacons.length === 0 ? (
                <Text style={{ color: palette.secondaryText }}>{copy.noDeacons}</Text>
              ) : (
                <View style={styles.orderList}>
                  {orderedDeacons.map((deacon, index) => (
                    <View key={deacon.personId} style={[styles.row, { backgroundColor: palette.background, borderColor: palette.line }]}>
                      <View style={[styles.orderBadge, { backgroundColor: palette.accentSoft }]}>
                        <Text style={[styles.orderBadgeText, { color: palette.accent }]}>{index + 1}</Text>
                      </View>
                      <ProfileAvatar name={deacon.name} size={40} source={memberById.get(deacon.personId)?.avatar} />
                      <Text numberOfLines={1} style={[styles.cardTitle, { color: palette.text, flex: 1 }]}>{deacon.name}</Text>
                      <View style={styles.reorderControls}>
                        <Pressable
                          accessibilityLabel={copy.moveUp(deacon.name)}
                          accessibilityRole="button"
                          accessibilityState={{ disabled: saving || index === 0 }}
                          disabled={saving || index === 0}
                          hitSlop={4}
                          onPress={() => setOrderedDeacons((current) => moveCandidate(current, deacon.personId, -1))}
                          style={({ pressed }) => [styles.reorderButton, { opacity: index === 0 ? 0.3 : pressed ? 0.6 : 1 }]}
                        >
                          <Ionicons accessibilityElementsHidden color={palette.secondaryText} name="chevron-up" size={19} />
                        </Pressable>
                        <Pressable
                          accessibilityLabel={copy.moveDown(deacon.name)}
                          accessibilityRole="button"
                          accessibilityState={{ disabled: saving || index === orderedDeacons.length - 1 }}
                          disabled={saving || index === orderedDeacons.length - 1}
                          hitSlop={4}
                          onPress={() => setOrderedDeacons((current) => moveCandidate(current, deacon.personId, 1))}
                          style={({ pressed }) => [styles.reorderButton, { opacity: index === orderedDeacons.length - 1 ? 0.3 : pressed ? 0.6 : 1 }]}
                        >
                          <Ionicons accessibilityElementsHidden color={palette.secondaryText} name="chevron-down" size={19} />
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              )}
              <Text style={[styles.warning, { color: palette.secondaryText }]}>{copy.replaceWarning.replace("{year}", String(year))}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ busy: saving, disabled: saving || orderedDeacons.length === 0 }}
                disabled={saving || orderedDeacons.length === 0}
                onPress={generate}
                style={[styles.generateButton, { backgroundColor: palette.accent, opacity: saving ? 0.6 : 1 }]}
              >
                <Text style={styles.generateText}>
                  {saving
                    ? copy.generating
                    : (hasGeneratedSchedule ? copy.regenerate : copy.generate).replace("{year}", String(year))}
                </Text>
              </Pressable>
            </View>

            <Text style={[styles.eyebrow, { color: palette.secondaryText, marginTop: 24 }]}>{copy.schedule}</Text>
            <Text style={[styles.reassignHint, { color: palette.secondaryText }]}>{copy.reassign}</Text>
            {state.year!.periods.length === 0 ? (
              <Text style={{ color: palette.secondaryText }}>{copy.empty}</Text>
            ) : (
              state.year!.periods.map((period) => {
                const member = memberById.get(period.personId);
                const name = state.year!.eligibleDeacons.find((deacon) => deacon.personId === period.personId)?.name ?? period.personId;
                return (
                  <View key={period.sundayOn} style={styles.weekendBlock}>
                    <Text style={[styles.periodDates, { color: palette.text }]}>
                      {weekendLabel(fridayBeforeSunday(period.sundayOn), period.sundayOn, locale)}
                    </Text>
                    <Pressable
                      accessibilityHint={copy.reassign}
                      accessibilityRole="button"
                      disabled={saving}
                      onPress={() => setReassignSundayOn(period.sundayOn)}
                      style={({ pressed }) => [styles.row, { backgroundColor: palette.surface, borderColor: palette.line }, pressed && styles.pressed]}
                    >
                      <ProfileAvatar name={name} size={40} source={member?.avatar} />
                      <Text numberOfLines={1} style={[styles.cardTitle, { color: palette.text, flex: 1 }]}>{name}</Text>
                      <Ionicons accessibilityElementsHidden color={palette.secondaryText} name="create-outline" size={19} />
                    </Pressable>
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      <DeaconPickerSheet
        deacons={state.status === "ready" ? state.year!.eligibleDeacons : []}
        doneLabel={copy.done}
        memberById={memberById}
        noMatchesLabel={copy.pickerNoMatches}
        onClose={() => setReassignSundayOn(null)}
        onSelect={reassign}
        searchLabel={copy.pickerSearch}
        selectedPersonId={reassigningPeriod?.personId ?? null}
        title={copy.pickerTitle}
        visible={reassignSundayOn !== null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingBottom: 60, paddingHorizontal: 20, paddingTop: 16 },
  title: { fontSize: 24, fontWeight: "700" },
  subtitle: { fontSize: 14, marginTop: 4 },
  yearRow: { alignItems: "center", flexDirection: "row", gap: 8, marginTop: 16 },
  yearLabel: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  year: { fontSize: 18, fontWeight: "800" },
  spacerTop: { marginTop: 20 },
  retryButton: { alignSelf: "flex-start", borderRadius: 10, marginTop: 10, paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { color: "#FFF", fontWeight: "700" },
  card: { borderRadius: 16, borderWidth: 1, marginTop: 12, padding: 14 },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase" },
  reorderHint: { fontSize: 12, lineHeight: 17, marginTop: 5 },
  orderList: { gap: 8, marginTop: 12 },
  row: { alignItems: "center", borderCurve: "continuous", borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 11, minHeight: 62, padding: 10 },
  pressed: { opacity: 0.72 },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  orderBadge: { alignItems: "center", borderRadius: 12, height: 24, justifyContent: "center", width: 24 },
  orderBadgeText: { fontSize: 12, fontWeight: "800" },
  reorderControls: { flexDirection: "row", gap: 2 },
  reorderButton: { alignItems: "center", height: 40, justifyContent: "center", width: 34 },
  warning: { fontSize: 12, marginTop: 12 },
  generateButton: { alignItems: "center", borderRadius: 10, marginTop: 12, paddingVertical: 12 },
  generateText: { color: "#FFF", fontWeight: "800" },
  reassignHint: { fontSize: 12, marginBottom: 12 },
  weekendBlock: { marginBottom: 14 },
  periodDates: { fontSize: 15, fontWeight: "800", marginBottom: 8 },
});
