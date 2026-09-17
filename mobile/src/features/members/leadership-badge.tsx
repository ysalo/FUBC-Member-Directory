import { Ionicons } from "@react-native-vector-icons/ionicons";
import { StyleSheet, Text, View } from "react-native";

import { useAppearance } from "@/features/appearance/AppearanceProvider";

type LeadershipDesignation = "pastor" | "deacon";

export function LeadershipBadge({ designation, inverted = false, locale }: { designation: LeadershipDesignation; inverted?: boolean; locale: "en" | "uk" }) {
  const { palette } = useAppearance();
  const label = designation === "pastor" ? (locale === "uk" ? "Пастор" : "Pastor") : (locale === "uk" ? "Диякон" : "Deacon");
  const color = inverted ? "#FFFFFF" : palette.accent;
  return <View accessibilityLabel={label} style={[styles.badge, { backgroundColor: inverted ? "rgba(10,14,18,0.68)" : palette.accentSoft }]}><Ionicons accessibilityElementsHidden color={color} name={designation === "pastor" ? "book-outline" : "people-outline"} size={14} /><Text selectable style={[styles.label, { color }]}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  badge: { alignItems: "center", alignSelf: "flex-start", borderCurve: "continuous", borderRadius: 9, flexDirection: "row", gap: 5, minHeight: 28, paddingHorizontal: 9, paddingVertical: 5 },
  label: { fontSize: 12, fontWeight: "800", letterSpacing: 0.15 },
});
