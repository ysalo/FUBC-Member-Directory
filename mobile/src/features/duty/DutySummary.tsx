import { Text } from "@/features/accessibility/app-text";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { useAppearance } from "@/features/appearance/AppearanceProvider";
import type { Member } from "@/features/directory/members";
import { formatFixedPdt, isoToFixedPdt } from "@/lib/dates";
import { DeaconRow } from "./DeaconRow";
import { currentPeriod, fridayBeforeSunday } from "./duty-domain";
import { dutyRepository } from "./duty-repository";

export function todayFixedPdt(): string {
  return isoToFixedPdt(new Date().toISOString()).date;
}

/** Compact Directory banner answering "who is on duty" without opening the full schedule. */
export function DutySummary({ locale, directoryMembers }: { locale: "en" | "uk"; directoryMembers: Member[] }) {
  const router = useRouter();
  const { palette } = useAppearance();
  const [state, setState] = useState<{ status: "loading" | "ready" | "empty"; sundayOn?: string; personId?: string }>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const today = todayFixedPdt();
    dutyRepository
      .loadYear(Number(today.slice(0, 4)))
      .then((year) => {
        if (cancelled) return;
        const active = currentPeriod(year.periods, today);
        setState(active ? { status: "ready", sundayOn: active.sundayOn, personId: active.personId } : { status: "empty" });
      })
      .catch(() => !cancelled && setState({ status: "empty" }));
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status !== "ready" || !state.sundayOn || !state.personId) return null;
  const deacon = directoryMembers.find((member) => member.id === state.personId);
  if (!deacon) return null;
  const fridayOn = fridayBeforeSunday(state.sundayOn);
  const dateRange = `${formatFixedPdt(`${fridayOn}T12:00:00Z`, locale).split(",")[0]} – ${formatFixedPdt(`${state.sundayOn}T12:00:00Z`, locale).split(",")[0]}`;

  return (
    <View style={[styles.card, { backgroundColor: palette.accentSoft, borderColor: palette.line }]}>
      <Text style={[styles.label, { color: palette.accent }]}>
        {locale === "uk" ? "На дежурстві цими вихідними" : "On duty this weekend"}
      </Text>
      <DeaconRow avatar={deacon.avatar} detail={dateRange} locale={locale} name={deacon.name} personId={deacon.id} />
      <Pressable accessibilityRole="button" onPress={() => router.push("/duty" as never)} style={styles.link}>
        <Text style={[styles.linkText, { color: palette.text }]}>
          {locale === "uk" ? "Переглянути розклад" : "View schedule"}
        </Text>
        <Ionicons accessibilityElementsHidden color={palette.secondaryText} name="chevron-forward" size={16} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, marginBottom: 14, marginHorizontal: 20, padding: 14 },
  label: { fontSize: 11, fontWeight: "800", letterSpacing: 0.4, marginBottom: 6, textTransform: "uppercase" },
  link: { alignItems: "center", flexDirection: "row", gap: 4, justifyContent: "flex-end", marginTop: 8 },
  linkText: { fontSize: 13, fontWeight: "700" },
});
