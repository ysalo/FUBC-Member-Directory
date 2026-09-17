import { StyleSheet, Text, View } from "react-native";

import { useAppearance } from "@/features/appearance/AppearanceProvider";

type LeadershipDesignation = "pastor" | "deacon";

export function LeadershipBadge({ designation, inverted = false, locale }: { designation: LeadershipDesignation; inverted?: boolean; locale: "en" | "uk" }) {
  const { palette } = useAppearance();
  const label = designation === "pastor" ? (locale === "uk" ? "Пастор" : "Pastor") : (locale === "uk" ? "Диякон" : "Deacon");
  const color = inverted ? "#FFFFFF" : designation === "pastor" ? palette.accent : palette.success;
  const backgroundColor = inverted
    ? designation === "pastor" ? "rgba(172,61,20,0.86)" : "rgba(24,104,59,0.88)"
    : designation === "pastor" ? palette.accentSoft : palette.successSoft;
  return <View accessibilityLabel={label} style={[styles.badge, { backgroundColor }]}><Text selectable style={[styles.label, { color }]}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  badge: { alignItems: "center", alignSelf: "flex-start", borderCurve: "continuous", borderRadius: 9, justifyContent: "center", minHeight: 28, paddingHorizontal: 10, paddingVertical: 5 },
  label: { fontSize: 12, fontWeight: "800", letterSpacing: 0.15 },
});
