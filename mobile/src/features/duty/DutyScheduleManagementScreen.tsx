import { Text } from "@/features/accessibility/app-text";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { canManageDirectory } from "@/lib/permissions";
import { useSession } from "@/features/session/SessionProvider";
import { errorMessage } from "@/lib/async-state";
import { DeaconRow } from "./DeaconRow";
import { todayFixedPdt } from "./DutySummary";
import { fridayBeforeSunday } from "./duty-domain";
import { dutyRepository, type DutyYear } from "./duty-repository";

const labels = {
  en: {
    title: "Duty schedule",
    subtitle: "Generate the year, then reassign individual weekends as needed.",
    year: "Year",
    generate: "Generate {year} schedule",
    replaceWarning: "This replaces every weekend already generated for {year}.",
    noAccess: "You don’t have permission to manage the duty schedule.",
    loading: "Loading…",
    error: "Couldn’t load the duty schedule",
    retry: "Try again",
    noDeacons: "No active deacons are available to schedule yet.",
    rotationOrder: "Rotation order (alphabetical by last name)",
    schedule: "Generated schedule",
    empty: "Nothing generated for this year yet.",
    reassign: "Tap a weekend, then choose a different deacon.",
  },
  uk: {
    title: "Розклад чергування",
    subtitle: "Створіть рік, потім за потреби змініть окремі вихідні.",
    year: "Рік",
    generate: "Створити розклад на {year}",
    replaceWarning: "Це замінить усі вже створені вихідні на {year}.",
    noAccess: "У вас немає дозволу керувати розкладом чергування.",
    loading: "Завантаження…",
    error: "Не вдалося завантажити розклад",
    retry: "Спробувати ще раз",
    noDeacons: "Поки немає активних дияконів для розкладу.",
    rotationOrder: "Порядок чергування (за алфавітом прізвищ)",
    schedule: "Створений розклад",
    empty: "На цей рік ще нічого не створено.",
    reassign: "Торкніться вихідних, щоб призначити іншого диякона.",
  },
} as const;

export function DutyScheduleManagementScreen() {
  const { palette } = useAppearance();
  const { locale } = useLocalization();
  const session = useSession();
  const copy = labels[locale];
  const actor = session.status === "ready" ? session.account : null;
  const allowed = canManageDirectory(actor);
  const today = todayFixedPdt();
  const [year, setYear] = useState(() => Number(today.slice(0, 4)));
  const [state, setState] = useState<{ status: "loading" | "error" | "ready"; year?: DutyYear; message?: string }>({ status: "loading" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!allowed) return;
    setState({ status: "loading" });
    dutyRepository
      .loadYear(year)
      .then((loaded) => setState({ status: "ready", year: loaded }))
      .catch((cause) => setState({ status: "error", message: errorMessage(cause) }));
  }, [allowed, year]);
  useFocusEffect(useCallback(load, [load]));

  const orderedIds = useMemo(() => (state.status === "ready" ? state.year!.eligibleDeacons.map((deacon) => deacon.personId) : []), [state]);

  const generate = () => {
    if (state.status !== "ready" || orderedIds.length === 0) return;
    setSaving(true);
    dutyRepository
      .saveRotation(year, orderedIds)
      .then((saved) => setState({ status: "ready", year: saved }))
      .catch((cause) => setState({ status: "error", message: errorMessage(cause) }))
      .finally(() => setSaving(false));
  };

  const reassign = (sundayOn: string, expectedRevision: number, personId: string) => {
    setSaving(true);
    dutyRepository
      .reassignPeriod(year, sundayOn, personId, expectedRevision)
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
              {state.year!.eligibleDeacons.length === 0 ? (
                <Text style={{ color: palette.secondaryText }}>{copy.noDeacons}</Text>
              ) : (
                state.year!.eligibleDeacons.map((deacon, index) => (
                  <View key={deacon.personId} style={styles.orderRow}>
                    <Text style={[styles.orderIndex, { color: palette.secondaryText }]}>{index + 1}</Text>
                    <Text style={{ color: palette.text }}>{deacon.name}</Text>
                  </View>
                ))
              )}
              <Text style={[styles.warning, { color: palette.secondaryText }]}>{copy.replaceWarning.replace("{year}", String(year))}</Text>
              <Pressable
                accessibilityRole="button"
                disabled={saving || state.year!.eligibleDeacons.length === 0}
                onPress={generate}
                style={[styles.generateButton, { backgroundColor: palette.accent, opacity: saving ? 0.6 : 1 }]}
              >
                <Text style={styles.generateText}>{copy.generate.replace("{year}", String(year))}</Text>
              </Pressable>
            </View>

            <Text style={[styles.eyebrow, { color: palette.secondaryText, marginTop: 20 }]}>{copy.schedule}</Text>
            <Text style={[styles.reassignHint, { color: palette.secondaryText }]}>{copy.reassign}</Text>
            {state.year!.periods.length === 0 ? (
              <Text style={{ color: palette.secondaryText }}>{copy.empty}</Text>
            ) : (
              state.year!.periods.map((period) => (
                <View key={period.sundayOn} style={[styles.periodRow, { borderBottomColor: palette.line }]}>
                  <Text style={[styles.periodDates, { color: palette.secondaryText }]}>
                    {fridayBeforeSunday(period.sundayOn)} – {period.sundayOn}
                  </Text>
                  <DeaconRow locale={locale} name={state.year!.eligibleDeacons.find((d) => d.personId === period.personId)?.name ?? period.personId} personId={period.personId} />
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
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
  orderRow: { alignItems: "center", flexDirection: "row", gap: 8, paddingVertical: 5 },
  orderIndex: { fontSize: 12, fontWeight: "800", width: 18 },
  warning: { fontSize: 12, marginTop: 10 },
  generateButton: { alignItems: "center", borderRadius: 10, marginTop: 12, paddingVertical: 12 },
  generateText: { color: "#FFF", fontWeight: "800" },
  reassignHint: { fontSize: 12, marginBottom: 8 },
  periodRow: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 6 },
  periodDates: { fontSize: 12, fontWeight: "700", marginBottom: 2 },
});
