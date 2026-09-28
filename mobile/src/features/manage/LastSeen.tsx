import { Text } from "@/features/accessibility/app-text";
import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";

const copy = {
  en: { label: "Last Seen", unknown: "Unknown", close: "Close", name: "Last Seen exact time" },
  uk: { label: "Востаннє в мережі", unknown: "Невідомо", close: "Закрити", name: "Точний час останньої активності" },
} as const;

function relativeTime(value: string, locale: "en" | "uk", now: number) {
  const seconds = Math.max(0, Math.floor((now - new Date(value).getTime()) / 1000));
  const units: [number, Intl.RelativeTimeFormatUnit][] = [[31536000, "year"], [2592000, "month"], [86400, "day"], [3600, "hour"], [60, "minute"]];
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const [size, unit] of units) if (seconds >= size) return formatter.format(-Math.floor(seconds / size), unit);
  return formatter.format(-seconds, "second");
}

export function LastSeen({ value }: { value?: string | null }) {
  const { palette } = useAppearance();
  const { locale } = useLocalization();
  const words = copy[locale];
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!value) return;
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [value]);
  const relative = value ? relativeTime(value, locale, now) : null;
  const exact = value ? new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-US", {
    year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short",
  }).format(new Date(value)) : "";
  return <>
    <Pressable accessibilityRole={value ? "button" : undefined} accessibilityLabel={value ? `${words.label}: ${relative}. ${words.name}` : words.unknown} disabled={!value} onPress={() => setOpen(true)}>
      <Text selectable style={{ color: palette.secondaryText, fontSize: 13 }}>{words.label}: {relative ?? words.unknown}</Text>
    </Pressable>
    {value ? <Modal animationType="fade" onRequestClose={() => setOpen(false)} transparent visible={open}>
      <Pressable accessibilityRole="button" accessibilityLabel={words.close} onPress={() => setOpen(false)} style={styles.scrim}>
        <Pressable accessibilityViewIsModal onPress={(event) => event.stopPropagation()} style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.line }]}>
          <Text accessibilityRole="header" style={{ color: palette.text, fontSize: 17, fontWeight: "800" }}>{words.name}</Text>
          <Text selectable style={{ color: palette.text, fontSize: 16 }}>{exact}</Text>
          <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.close}><Text style={{ color: palette.accent, fontWeight: "700" }}>{words.close}</Text></Pressable>
        </Pressable>
      </Pressable>
    </Modal> : null}
  </>;
}

const styles = StyleSheet.create({ scrim: { alignItems: "center", backgroundColor: "#0009", flex: 1, justifyContent: "center", padding: 24 }, card: { borderRadius: 18, borderWidth: 1, gap: 14, maxWidth: 420, padding: 22, width: "100%" }, close: { alignItems: "flex-end", minHeight: 36, justifyContent: "center" } });
