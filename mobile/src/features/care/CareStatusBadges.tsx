import { Ionicons } from "@react-native-vector-icons/ionicons";
import { StyleSheet, Text, View } from "react-native";

import { useAppearance } from "@/features/appearance/AppearanceProvider";

export type CareStatusBadgesProps = {
  isOrphan?: boolean;
  maritalStatus?: string;
  locale?: "en" | "uk";
};

const WIDOWED_VALUES = new Set(["widow", "widowed", "вдова", "вдівець", "вдівець/вдова"]);

/**
 * Care statuses are intentionally separate from ministry designations. They
 * describe a member's care context, rather than their church responsibility.
 */
export function CareStatusBadges({ isOrphan, maritalStatus, locale = "en" }: CareStatusBadgesProps) {
  const { palette } = useAppearance();
  const isWidow = Boolean(maritalStatus && WIDOWED_VALUES.has(maritalStatus.trim().toLocaleLowerCase()));
  if (isOrphan !== true && !isWidow) return null;

  const labels = locale === "uk"
    ? { orphan: "Сирота", widow: "Вдова / вдівець" }
    : { orphan: "Orphan", widow: "Widow" };
  const statusLabels = [isOrphan === true ? labels.orphan : null, isWidow ? labels.widow : null].filter(Boolean);

  return (
    <View accessibilityLabel={statusLabels.join(", ")} style={styles.row}>
      {isOrphan === true ? <StatusBadge icon="person-outline" label={labels.orphan} palette={palette} /> : null}
      {isWidow ? <StatusBadge icon="heart-outline" label={labels.widow} palette={palette} /> : null}
    </View>
  );
}

function StatusBadge({ icon, label, palette }: { icon: "person-outline" | "heart-outline"; label: string; palette: ReturnType<typeof useAppearance>["palette"] }) {
  return (
    <View accessibilityLabel={label} style={[styles.badge, { backgroundColor: palette.warningSoft, borderColor: palette.line }]}>
      <Ionicons color={palette.text} name={icon} size={15} />
      <Text style={[styles.text, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
  badge: { alignItems: "center", borderRadius: 9, borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 5, minHeight: 32, paddingHorizontal: 10, paddingVertical: 6 },
  text: { fontSize: 13, fontWeight: "700" },
});
