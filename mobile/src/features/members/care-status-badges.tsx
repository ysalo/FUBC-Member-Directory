import { StyleSheet, Text, View } from "react-native";

import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";

export function CareStatusBadges({ isOrphan = false, isWidow = false }: { isOrphan?: boolean; isWidow?: boolean }) {
  const { palette } = useAppearance();
  const { locale } = useLocalization();
  if (!isOrphan && !isWidow) return null;
  return <View accessibilityLabel={[isOrphan ? (locale === "uk" ? "Сирота" : "Orphan") : "", isWidow ? (locale === "uk" ? "Вдова або вдівець" : "Widow or widower") : ""].filter(Boolean).join(", ")} style={styles.row}>
    {isOrphan ? <View style={[styles.badge, { backgroundColor: palette.warningSoft, borderColor: palette.line }]}><Text style={[styles.label, { color: palette.text }]}>{locale === "uk" ? "Сирота" : "Orphan"}</Text></View> : null}
    {isWidow ? <View style={[styles.badge, { backgroundColor: palette.subtle, borderColor: palette.line }]}><Text style={[styles.label, { color: palette.text }]}>{locale === "uk" ? "Вдова / вдівець" : "Widow / widower"}</Text></View> : null}
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 5 },
  badge: { alignItems: "center", borderCurve: "continuous", borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 7, paddingVertical: 4 },
  label: { fontSize: 11, fontWeight: "800", letterSpacing: 0.2, textTransform: "uppercase" },
});
