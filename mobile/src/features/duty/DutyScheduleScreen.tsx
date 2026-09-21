import { Text, TextInput } from "@/features/accessibility/app-text";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
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
  last,
}: {
  personId: string;
  name: string;
  avatar?: Member["avatar"];
  dateText: string;
  locale: "en" | "uk";
  tag?: string;
  tagTone?: "today" | "you";
  last: boolean;
}) {
  const router = useRouter();
  const { palette } = useAppearance();
  const onPress = () => router.push(`/members/${personId}` as never);
  const row = (
    <Pressable
      accessibilityHint={locale === "uk" ? `Відкрити профіль: ${name}` : `Opens ${name}’s member profile`}
      accessibilityRole={Platform.OS === "web" ? "link" : "button"}
      onPress={Platform.OS === "web" ? undefined : onPress}
      style={({ pressed }) => [styles.weekendRow, !last && { borderBottomColor: palette.line, borderBottomWidth: StyleSheet.hairlineWidth }, pressed && styles.pressed]}
    >
      <View style={styles.weekendCopy}>
        <View style={styles.dateLine}>
          <Text style={[styles.dateText, { color: palette.accent }]}>{dateText}</Text>
          {tag ? (
            <View style={[styles.tag, { backgroundColor: tagTone === "you" ? palette.text : palette.accent }]}>
              <Text style={[styles.tagText, { color: palette.surface }]}>{tag}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.nameLine}>
          <ProfileAvatar name={name} size={32} source={avatar} />
          <Text numberOfLines={1} style={[styles.name, { color: palette.text }]}>{name}</Text>
        </View>
      </View>
      <Ionicons accessibilityElementsHidden color={palette.secondaryText} name="chevron-forward" size={18} />
    </Pressable>
  );
  return Platform.OS === "web" ? (
    <Link asChild href={`/members/${personId}`}>
      {row}
    </Link>
  ) : (
    row
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
  const [pickerQuery, setPickerQuery] = useState("");

  const memberById = useMemo(() => new Map(directoryMembers.map((member) => [member.id, member])), [directoryMembers]);
  const eligibleDeacons = state.status === "ready" ? state.year!.eligibleDeacons : [];
  const filteredDeacons = useMemo(() => {
    const needle = pickerQuery.trim().toLocaleLowerCase(locale);
    if (!needle) return eligibleDeacons;
    return eligibleDeacons.filter((deacon) => deacon.name.toLocaleLowerCase(locale).includes(needle));
  }, [eligibleDeacons, pickerQuery, locale]);

  const active = state.status === "ready" ? currentPeriod(state.year!.periods, today) : null;
  const focused = state.status === "ready" && focusPersonId ? nextPeriodForPerson(state.year!.periods, focusPersonId, today) : null;
  const focusedMember = focusPersonId ? memberById.get(focusPersonId) : undefined;
  const months = state.status === "ready" ? periodsByMonth(state.year!.periods).filter((group) => group.month >= currentMonth) : [];

  const selectDeacon = (deacon: DutyCandidate | null) => {
    setFocusPersonId(deacon?.personId ?? null);
    setPickerOpen(false);
    setPickerQuery("");
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
                  <View style={[styles.monthCard, { backgroundColor: palette.surface, borderColor: palette.line }]}>
                    {group.periods.map((period, index) => {
                      const member = memberById.get(period.personId);
                      const isToday = active?.sundayOn === period.sundayOn;
                      const isFocused = period.personId === focusPersonId && focused?.sundayOn === period.sundayOn;
                      return (
                        <WeekendRow
                          avatar={member?.avatar}
                          dateText={weekendLabel(fridayBeforeSunday(period.sundayOn), period.sundayOn, locale)}
                          key={period.sundayOn}
                          last={index === group.periods.length - 1}
                          locale={locale}
                          name={member?.name ?? period.personId}
                          personId={period.personId}
                          tag={isToday ? copy.todayTag : isFocused ? (focusPersonId === viewerPersonId ? copy.youTag : copy.selectedTag) : undefined}
                          tagTone={isFocused && focusPersonId !== viewerPersonId ? "you" : "today"}
                        />
                      );
                    })}
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
      <WebTabBar />

      <Modal animationType="slide" onRequestClose={() => setPickerOpen(false)} presentationStyle="pageSheet" visible={pickerOpen}>
        <View accessibilityViewIsModal style={[styles.sheet, { backgroundColor: palette.background }]}>
          <View style={[styles.sheetHeader, { borderBottomColor: palette.line }]}>
            <Text accessibilityRole="header" style={[styles.sheetTitle, { color: palette.text }]}>{copy.pickerTitle}</Text>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setPickerOpen(false)} style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}>
              <Text style={[styles.doneText, { color: palette.accent }]}>{copy.done}</Text>
            </Pressable>
          </View>
          <View style={[styles.searchField, { backgroundColor: palette.subtle, margin: 20 }]}>
            <Ionicons accessibilityElementsHidden color={palette.secondaryText} name="search-outline" size={20} />
            <TextInput
              accessibilityLabel={copy.pickerSearch}
              autoCapitalize="none"
              autoFocus
              clearButtonMode="while-editing"
              onChangeText={setPickerQuery}
              placeholder={copy.pickerSearch}
              placeholderTextColor={palette.secondaryText}
              style={[styles.searchInput, { color: palette.text }]}
              value={pickerQuery}
            />
          </View>
          <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
            {!pickerQuery ? (
              <Pressable accessibilityRole="button" onPress={() => selectDeacon(null)} style={({ pressed }) => [styles.pickerRow, pressed && styles.pressed]}>
                <View style={[styles.everyoneIcon, { backgroundColor: palette.subtle }]}>
                  <Ionicons color={palette.accent} name="people-outline" size={20} />
                </View>
                <Text style={[styles.pickerRowName, { color: palette.text, flex: 1 }]}>{copy.pickerClear}</Text>
                {focusPersonId === null ? <Ionicons color={palette.accent} name="checkmark" size={20} /> : null}
              </Pressable>
            ) : null}
            {filteredDeacons.length === 0 ? (
              <Text style={[styles.centerText, { color: palette.secondaryText, marginTop: 20 }]}>{copy.pickerNoMatches}</Text>
            ) : (
              filteredDeacons.map((deacon) => {
                const member = memberById.get(deacon.personId);
                const selected = deacon.personId === focusPersonId;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={deacon.personId}
                    onPress={() => selectDeacon(deacon)}
                    style={({ pressed }) => [styles.pickerRow, pressed && styles.pressed]}
                  >
                    <ProfileAvatar name={deacon.name} size={42} source={member?.avatar} />
                    <Text numberOfLines={1} style={[styles.pickerRowName, { color: palette.text, flex: 1 }]}>{deacon.name}</Text>
                    {selected ? <Ionicons color={palette.accent} name="checkmark" size={20} /> : null}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingBottom: 100, paddingHorizontal: 20, paddingTop: 12 },
  title: { fontSize: 34, fontWeight: "800", letterSpacing: -1, marginBottom: 14 },
  center: { alignItems: "center", gap: 10, paddingVertical: 40 },
  centerText: { fontSize: 14, textAlign: "center" },
  retryButton: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { color: "#FFF", fontWeight: "700" },
  card: { borderRadius: 16, borderWidth: 1, marginBottom: 14, padding: 14 },
  todayCard: { borderWidth: 1.5 },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 0.4, marginBottom: 8, textTransform: "uppercase" },
  pickerBlock: { marginBottom: 14 },
  pickerTrigger: { alignItems: "center", borderRadius: 14, flexDirection: "row", gap: 10, minHeight: 52, paddingHorizontal: 14 },
  pickerTriggerText: { flex: 1, fontSize: 15, fontWeight: "700" },
  monthBlock: { marginBottom: 20 },
  monthLabel: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5, marginBottom: 10 },
  monthCard: { borderCurve: "continuous", borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  weekendRow: { alignItems: "center", flexDirection: "row", gap: 10, minHeight: 72, paddingHorizontal: 14, paddingVertical: 10 },
  pressed: { opacity: 0.65 },
  weekendCopy: { flex: 1, gap: 6, minWidth: 0 },
  dateLine: { alignItems: "center", flexDirection: "row", gap: 8 },
  dateText: { fontSize: 19, fontWeight: "800", letterSpacing: -0.3 },
  nameLine: { alignItems: "center", flexDirection: "row", gap: 8 },
  name: { flex: 1, fontSize: 14, fontWeight: "600" },
  tag: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  tagText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  sheet: { flex: 1 },
  sheetHeader: { alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", minHeight: 58, paddingHorizontal: 20 },
  sheetTitle: { flex: 1, fontSize: 20, fontWeight: "700" },
  doneButton: { alignItems: "center", justifyContent: "center", minHeight: 44, minWidth: 44 },
  doneText: { fontSize: 17, fontWeight: "600" },
  sheetContent: { paddingBottom: 40, paddingHorizontal: 20 },
  searchField: { alignItems: "center", borderRadius: 14, flexDirection: "row", gap: 10, minHeight: 46, paddingHorizontal: 14 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 11 },
  pickerRow: { alignItems: "center", flexDirection: "row", gap: 11, minHeight: 62, paddingVertical: 9 },
  pickerRowName: { fontSize: 16, fontWeight: "700" },
  everyoneIcon: { alignItems: "center", borderRadius: 20, height: 40, justifyContent: "center", width: 40 },
});


