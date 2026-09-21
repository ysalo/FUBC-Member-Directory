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
import { useSession } from "@/features/session/SessionProvider";
import { WebTabBar } from "@/features/shell/WebTabBar";
import { errorMessage } from "@/lib/async-state";
import { ProfileAvatar } from "@/features/members/ProfileAvatar";
import { DeaconRow } from "./DeaconRow";
import { todayFixedPdt } from "./DutySummary";
import { currentPeriod, fridayBeforeSunday, nextPeriodForPerson, periodsByMonth, weekendLabel } from "./duty-domain";
import { dutyRepository, type DutyYear } from "./duty-repository";

const labels = {
  en: {
    title: "Duty schedule",
    today: "Today",
    onDuty: "On duty",
    loading: "Loading the duty schedule…",
    error: "Couldn’t load the duty schedule",
    retry: "Try again",
    empty: "No schedule has been generated for this year yet.",
    todayTag: "Today",
    youTag: "You",
    selectedTag: "Selected",
    pickDeacon: "View a deacon’s schedule",
    yourNext: "Your next duty",
    nextDutyFor: (name: string) => `${name}’s next duty`,
    noUpcoming: (name: string) => `${name} has no upcoming duty this year.`,
  },
  uk: {
    title: "Розклад чергування",
    today: "Сьогодні",
    onDuty: "На чергуванні",
    loading: "Завантаження розкладу…",
    error: "Не вдалося завантажити розклад",
    retry: "Спробувати ще раз",
    empty: "Розклад на цей рік ще не створено.",
    todayTag: "Сьогодні",
    youTag: "Ви",
    selectedTag: "Обрано",
    pickDeacon: "Переглянути розклад диякона",
    yourNext: "Ваше наступне чергування",
    nextDutyFor: (name: string) => `Наступне чергування: ${name}`,
    noUpcoming: (name: string) => `У ${name} немає майбутнього чергування цього року.`,
  },
} as const;

const monthLabel = (month: string, locale: "en" | "uk") =>
  new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-US", { month: "long", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`));

export function DutyScheduleScreen() {
  const { palette } = useAppearance();
  const { locale } = useLocalization();
  const session = useSession();
  const copy = labels[locale];
  const today = todayFixedPdt();
  const [year, setYear] = useState(() => Number(today.slice(0, 4)));
  const [state, setState] = useState<{ status: "loading" | "error" | "ready"; year?: DutyYear; message?: string }>({ status: "loading" });

  const load = useCallback(() => {
    setState({ status: "loading" });
    dutyRepository
      .loadYear(year)
      .then((loaded) => setState({ status: "ready", year: loaded }))
      .catch((cause) => setState({ status: "error", message: errorMessage(cause) }));
  }, [year]);
  useFocusEffect(useCallback(load, [load]));

  const [directoryMembers, setDirectoryMembers] = useState<Member[]>([]);
  useFocusEffect(useCallback(() => {
    listDirectory().then(setDirectoryMembers).catch(() => setDirectoryMembers([]));
  }, []));

  const viewerPersonId = session.status === "ready" ? session.account.personId : null;
  const viewerIsDeacon = session.status === "ready" && session.account.leadershipMinistry === "deacon";
  const [focusPersonId, setFocusPersonId] = useState<string | null>(null);
  useFocusEffect(useCallback(() => {
    setFocusPersonId((current) => current ?? (viewerIsDeacon ? viewerPersonId : null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerIsDeacon, viewerPersonId]));

  const memberById = useMemo(() => new Map(directoryMembers.map((member) => [member.id, member])), [directoryMembers]);
  const eligibleDeacons = state.status === "ready" ? state.year!.eligibleDeacons : [];
  const active = state.status === "ready" ? currentPeriod(state.year!.periods, today) : null;
  const focused = state.status === "ready" && focusPersonId ? nextPeriodForPerson(state.year!.periods, focusPersonId, today) : null;
  const focusedMember = focusPersonId ? memberById.get(focusPersonId) : undefined;
  const months = state.status === "ready" ? periodsByMonth(state.year!.periods) : [];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>{copy.title}</Text>
        </View>
        <View style={styles.yearRow}>
          <Pressable accessibilityLabel="Previous year" onPress={() => setYear((y) => y - 1)} style={[styles.yearButton, { backgroundColor: palette.subtle }]}>
            <Ionicons color={palette.text} name="chevron-back" size={16} />
          </Pressable>
          <Text style={[styles.year, { color: palette.text }]}>{year}</Text>
          <Pressable accessibilityLabel="Next year" onPress={() => setYear((y) => y + 1)} style={[styles.yearButton, { backgroundColor: palette.subtle }]}>
            <Ionicons color={palette.text} name="chevron-forward" size={16} />
          </Pressable>
        </View>

        {state.status === "loading" ? (
          <View style={styles.center}>
            <ActivityIndicator color={palette.accent} />
            <Text style={[styles.centerText, { color: palette.secondaryText }]}>{copy.loading}</Text>
          </View>
        ) : state.status === "error" ? (
          <View style={styles.center}>
            <Text style={[styles.centerText, { color: palette.text }]}>{copy.error}</Text>
            <Pressable accessibilityRole="button" onPress={load} style={[styles.retryButton, { backgroundColor: palette.accent }]}>
              <Text style={styles.retryText}>{copy.retry}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {active ? (
              <View style={[styles.card, styles.todayCard, { backgroundColor: palette.surface, borderColor: palette.accent }]}>
                <Text style={[styles.eyebrow, { color: palette.secondaryText }]}>{copy.today}</Text>
                <DeaconRow
                  avatar={memberById.get(active.personId)?.avatar}
                  detail={weekendLabel(fridayBeforeSunday(active.sundayOn), active.sundayOn, locale)}
                  locale={locale}
                  name={memberById.get(active.personId)?.name ?? active.personId}
                  personId={active.personId}
                  size={48}
                  tag={copy.todayTag}
                />
              </View>
            ) : null}

            {eligibleDeacons.length > 0 ? (
              <View style={styles.pickerBlock}>
                <Text style={[styles.eyebrow, { color: palette.secondaryText }]}>{copy.pickDeacon}</Text>
                <ScrollView horizontal contentContainerStyle={styles.pickerRow} showsHorizontalScrollIndicator={false}>
                  {eligibleDeacons.map((deacon) => {
                    const selected = deacon.personId === focusPersonId;
                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        key={deacon.personId}
                        onPress={() => setFocusPersonId(selected ? null : deacon.personId)}
                        style={[styles.pickerChip, { backgroundColor: selected ? palette.accentSoft : palette.surface, borderColor: selected ? palette.accent : palette.line }]}
                      >
                        <ProfileAvatar name={deacon.name} size={28} source={memberById.get(deacon.personId)?.avatar} />
                        <Text numberOfLines={1} style={[styles.pickerChipText, { color: selected ? palette.accent : palette.text }]}>{deacon.name}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            {focusPersonId ? (
              <View style={[styles.card, { backgroundColor: palette.accentSoft, borderColor: palette.accent, borderStyle: "dashed" }]}>
                <Text style={[styles.eyebrow, { color: palette.secondaryText }]}>
                  {focusPersonId === viewerPersonId ? copy.yourNext : copy.nextDutyFor(focusedMember?.name ?? "")}
                </Text>
                {focused ? (
                  <DeaconRow
                    avatar={focusedMember?.avatar}
                    detail={weekendLabel(fridayBeforeSunday(focused.sundayOn), focused.sundayOn, locale)}
                    locale={locale}
                    name={focusedMember?.name ?? focusPersonId}
                    personId={focusPersonId}
                    size={48}
                    tag={focusPersonId === viewerPersonId ? copy.youTag : copy.selectedTag}
                    tagTone="you"
                  />
                ) : (
                  <Text style={{ color: palette.secondaryText }}>{copy.noUpcoming(focusedMember?.name ?? "")}</Text>
                )}
              </View>
            ) : null}

            {months.length === 0 ? (
              <Text style={[styles.centerText, { color: palette.secondaryText }]}>{copy.empty}</Text>
            ) : (
              months.map((group) => (
                <View key={group.month}>
                  <Text style={[styles.monthLabel, { color: palette.secondaryText }]}>{monthLabel(group.month, locale)}</Text>
                  {group.periods.map((period) => {
                    const member = memberById.get(period.personId);
                    const isToday = active?.sundayOn === period.sundayOn;
                    const isFocused = period.personId === focusPersonId && focused?.sundayOn === period.sundayOn;
                    return (
                      <View key={period.sundayOn} style={[styles.agendaRow, { borderBottomColor: palette.line }]}>
                        <DeaconRow
                          avatar={member?.avatar}
                          detail={weekendLabel(fridayBeforeSunday(period.sundayOn), period.sundayOn, locale)}
                          locale={locale}
                          name={member?.name ?? period.personId}
                          personId={period.personId}
                          tag={isToday ? copy.todayTag : isFocused ? (focusPersonId === viewerPersonId ? copy.youTag : copy.selectedTag) : undefined}
                          tagTone={isFocused && focusPersonId !== viewerPersonId ? "you" : "today"}
                        />
                      </View>
                    );
                  })}
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
      <WebTabBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingBottom: 100, paddingHorizontal: 20, paddingTop: 12 },
  headerRow: { marginBottom: 4 },
  title: { fontSize: 28, fontWeight: "700" },
  yearRow: { alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "center", marginVertical: 10 },
  year: { fontSize: 17, fontWeight: "800" },
  yearButton: { alignItems: "center", borderRadius: 8, height: 30, justifyContent: "center", width: 30 },
  center: { alignItems: "center", gap: 10, paddingVertical: 40 },
  centerText: { fontSize: 14, textAlign: "center" },
  retryButton: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { color: "#FFF", fontWeight: "700" },
  card: { borderRadius: 16, borderWidth: 1, marginBottom: 12, padding: 14 },
  todayCard: { borderWidth: 1.5 },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 0.4, marginBottom: 6, textTransform: "uppercase" },
  monthLabel: { fontSize: 12, fontWeight: "800", letterSpacing: 0.4, marginBottom: 4, marginTop: 16, textTransform: "uppercase" },
  agendaRow: { borderBottomWidth: StyleSheet.hairlineWidth },
  pickerBlock: { marginBottom: 12 },
  pickerRow: { gap: 8, paddingVertical: 2 },
  pickerChip: { alignItems: "center", borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 10, paddingVertical: 6 },
  pickerChipText: { fontSize: 13, fontWeight: "700", maxWidth: 120 },
});

