import { Text } from "@/features/accessibility/app-text";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
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
import { DeaconPickerSheet } from "./DeaconPickerSheet";
import { todayFixedPdt } from "./DutySummary";
import { currentPeriod, fridayBeforeSunday, nextPeriodForPerson, periodsByMonth, weekendLabel, type DutyCandidate } from "./duty-domain";
import { dutyRepository, type DutyYear } from "./duty-repository";

const labels = {
  en: {
    title: "Schedule",
    today: "Today",
    loading: "Loading the schedule…",
    error: "Couldn’t load the schedule",
    retry: "Try again",
    empty: "No schedule has been generated for this year yet.",
    todayTag: "Today",
    youTag: "You",
    selectedTag: "Selected",
    pickDeacon: "View a deacon’s schedule",
    pickerPlaceholder: "Choose a deacon",
    pickerTitle: "Select a deacon",
    pickerSearch: "Search deacons",
    pickerClear: "Everyone",
    pickerNoMatches: "No deacons match your search.",
    done: "Done",
    yourNext: "Your next duty",
    nextDutyFor: (name: string) => `${name}’s next duty`,
    noUpcoming: (name: string) => `${name} has no upcoming duty this year.`,
    options: "Options",
    showPastMonths: "Show previous months",
  },
  uk: {
    title: "Розклад",
    today: "Сьогодні",
    loading: "Завантаження розкладу…",
    error: "Не вдалося завантажити розклад",
    retry: "Спробувати ще раз",
    empty: "Розклад на цей рік ще не створено.",
    todayTag: "Сьогодні",
    youTag: "Ви",
    selectedTag: "Обрано",
    pickDeacon: "Переглянути розклад диякона",
    pickerPlaceholder: "Оберіть диякона",
    pickerTitle: "Обрати диякона",
    pickerSearch: "Пошук дияконів",
    pickerClear: "Усі",
    pickerNoMatches: "Дияконів не знайдено.",
    done: "Готово",
    yourNext: "Ваше наступне чергування",
    nextDutyFor: (name: string) => `Наступне чергування: ${name}`,
    noUpcoming: (name: string) => `У ${name} немає майбутнього чергування цього року.`,
    options: "Параметри",
    showPastMonths: "Показати минулі місяці",
  },
} as const;

const monthLabel = (month: string, locale: "en" | "uk") =>
  new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-US", { month: "long", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`));

function WeekendRow({
  personId,
  name,
  avatar,
  dateText,
  locale,
  tag,
  tagTone = "today",
}: {
  personId: string;
  name: string;
  avatar?: Member["avatar"];
  dateText: string;
  locale: "en" | "uk";
  tag?: string;
  tagTone?: "today" | "you";
}) {
  const { palette } = useAppearance();
  return (
    <View style={styles.weekendBlock}>
      <View style={styles.dateLine}>
        <Text style={[styles.dateText, { color: palette.text }]}>{dateText}</Text>
        {tag ? (
          <View style={[styles.tag, { backgroundColor: tagTone === "you" ? palette.text : palette.accent }]}>
            <Text style={[styles.tagText, { color: palette.surface }]}>{tag}</Text>
          </View>
        ) : null}
      </View>
      <DeaconRow avatar={avatar} card locale={locale} name={name} personId={personId} size={48} />
    </View>
  );
}

export function DutyScheduleScreen() {
  const { palette } = useAppearance();
  const { locale } = useLocalization();
  const session = useSession();
  const copy = labels[locale];
  const today = todayFixedPdt();
  const year = Number(today.slice(0, 4));
  const currentMonth = today.slice(0, 7);
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

  const [pickerOpen, setPickerOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [showPastMonths, setShowPastMonths] = useState(false);

  const memberById = useMemo(() => new Map(directoryMembers.map((member) => [member.id, member])), [directoryMembers]);
  const eligibleDeacons = state.status === "ready" ? state.year!.eligibleDeacons : [];

  const active = state.status === "ready" ? currentPeriod(state.year!.periods, today) : null;
  const focused = state.status === "ready" && focusPersonId ? nextPeriodForPerson(state.year!.periods, focusPersonId, today) : null;
  const focusedMember = focusPersonId ? memberById.get(focusPersonId) : undefined;
  const months = state.status === "ready" ? periodsByMonth(state.year!.periods).filter((group) => showPastMonths || group.month >= currentMonth) : [];

  const selectDeacon = (deacon: DutyCandidate | null) => {
    setFocusPersonId(deacon?.personId ?? null);
    setPickerOpen(false);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>{copy.title}</Text>

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
                <View style={styles.pickerAndOptions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setPickerOpen(true)}
                    style={[styles.pickerTrigger, { backgroundColor: palette.subtle }]}
                  >
                    {focusedMember ? (
                      <ProfileAvatar name={focusedMember.name} size={28} source={focusedMember.avatar} />
                    ) : (
                      <Ionicons color={palette.secondaryText} name="person-circle-outline" size={24} />
                    )}
                    <Text numberOfLines={1} style={[styles.pickerTriggerText, { color: focusedMember ? palette.text : palette.secondaryText }]}>
                      {focusedMember?.name ?? copy.pickerPlaceholder}
                    </Text>
                    <Ionicons color={palette.secondaryText} name="chevron-down" size={18} />
                  </Pressable>
                  <Pressable
                    accessibilityLabel={copy.options}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: optionsOpen }}
                    onPress={() => setOptionsOpen((open) => !open)}
                    style={[styles.optionsButton, { backgroundColor: showPastMonths ? palette.accentSoft : palette.subtle }]}
                  >
                    <Ionicons color={showPastMonths ? palette.accent : palette.secondaryText} name="options-outline" size={21} />
                  </Pressable>
                </View>
                {optionsOpen ? (
                  <View
                    accessibilityViewIsModal
                    style={[styles.optionsPopover, { backgroundColor: palette.elevated, borderColor: palette.line }]}
                  >
                    <Text accessibilityRole="header" style={[styles.optionsTitle, { color: palette.text }]}>{copy.options}</Text>
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: showPastMonths }}
                      onPress={() => setShowPastMonths((value) => !value)}
                      style={styles.optionRow}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          { backgroundColor: showPastMonths ? palette.accent : "transparent", borderColor: showPastMonths ? palette.accent : palette.line },
                        ]}
                      >
                        {showPastMonths ? <Ionicons color="#FFF" name="checkmark" size={15} /> : null}
                      </View>
                      <Text style={[styles.optionText, { color: palette.text }]}>{copy.showPastMonths}</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" onPress={() => setOptionsOpen(false)} style={[styles.optionsDone, { backgroundColor: palette.accent }]}>
                      <Text style={styles.optionsDoneText}>{copy.done}</Text>
                    </Pressable>
                  </View>
                ) : null}
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
                <View key={group.month} style={styles.monthBlock}>
                  <Text style={[styles.monthLabel, { color: palette.text }]}>{monthLabel(group.month, locale)}</Text>
                  {group.periods.map((period) => {
                    const member = memberById.get(period.personId);
                    const isToday = active?.sundayOn === period.sundayOn;
                    const isFocused = period.personId === focusPersonId && focused?.sundayOn === period.sundayOn;
                    return (
                      <WeekendRow
                        avatar={member?.avatar}
                        dateText={weekendLabel(fridayBeforeSunday(period.sundayOn), period.sundayOn, locale)}
                        key={period.sundayOn}
                        locale={locale}
                        name={member?.name ?? period.personId}
                        personId={period.personId}
                        tag={isToday ? copy.todayTag : isFocused ? (focusPersonId === viewerPersonId ? copy.youTag : copy.selectedTag) : undefined}
                        tagTone={isFocused && focusPersonId !== viewerPersonId ? "you" : "today"}
                      />
                    );
                  })}
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
      <WebTabBar />

      <DeaconPickerSheet
        clearOption={{ label: copy.pickerClear, selected: focusPersonId === null }}
        deacons={eligibleDeacons}
        doneLabel={copy.done}
        memberById={memberById}
        noMatchesLabel={copy.pickerNoMatches}
        onClose={() => setPickerOpen(false)}
        onSelect={(deacon) => selectDeacon(deacon)}
        onSelectClear={() => selectDeacon(null)}
        searchLabel={copy.pickerSearch}
        selectedPersonId={focusPersonId}
        title={copy.pickerTitle}
        visible={pickerOpen}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingBottom: 100, paddingHorizontal: 20, paddingTop: 16 },
  title: { fontSize: 34, fontWeight: "800", letterSpacing: -1, marginBottom: 20 },
  center: { alignItems: "center", gap: 10, paddingVertical: 40 },
  centerText: { fontSize: 14, textAlign: "center" },
  retryButton: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { color: "#FFF", fontWeight: "700" },
  card: { borderRadius: 16, borderWidth: 1, marginBottom: 20, padding: 16 },
  todayCard: { borderWidth: 1.5 },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 0.4, marginBottom: 10, textTransform: "uppercase" },
  pickerBlock: { marginBottom: 24, position: "relative", zIndex: 5 },
  pickerAndOptions: { flexDirection: "row", gap: 10 },
  pickerTrigger: { alignItems: "center", borderRadius: 14, flex: 1, flexDirection: "row", gap: 10, minHeight: 52, paddingHorizontal: 14 },
  pickerTriggerText: { flex: 1, fontSize: 15, fontWeight: "700" },
  optionsButton: { alignItems: "center", borderRadius: 14, height: 52, justifyContent: "center", width: 52 },
  optionsPopover: { borderCurve: "continuous", borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, elevation: 8, marginTop: 8, padding: 14, position: "absolute", right: 0, shadowColor: "#000", shadowOffset: { height: 4, width: 0 }, shadowOpacity: 0.18, shadowRadius: 12, top: "100%", width: 260, zIndex: 20 },
  optionsTitle: { fontSize: 15, fontWeight: "800", marginBottom: 8 },
  optionRow: { alignItems: "center", flexDirection: "row", gap: 11, minHeight: 44, paddingVertical: 4 },
  checkbox: { alignItems: "center", borderRadius: 6, borderWidth: 2, height: 22, justifyContent: "center", width: 22 },
  optionText: { flex: 1, fontSize: 14, fontWeight: "600" },
  optionsDone: { alignItems: "center", borderRadius: 10, marginTop: 10, paddingVertical: 9 },
  optionsDoneText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
  monthBlock: { marginBottom: 40 },
  monthLabel: { fontSize: 27, fontWeight: "800", letterSpacing: -0.5, marginBottom: 18 },
  weekendBlock: { marginBottom: 22 },
  dateLine: { alignItems: "center", flexDirection: "row", gap: 10, marginBottom: 12 },
  dateText: { fontSize: 20, fontWeight: "800", letterSpacing: -0.3, lineHeight: 25 },
  tag: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  tagText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
});


