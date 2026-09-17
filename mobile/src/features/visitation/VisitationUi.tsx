import { Ionicons, type IoniconsIconName } from "@react-native-vector-icons/ionicons";
import type { PropsWithChildren, ReactNode } from "react";
import { ActivityIndicator, DynamicColorIOS, Platform, Pressable, StyleSheet, Text, View, type ColorValue } from "react-native";

const adaptive = (light: string, dark: string, token: string): ColorValue => {
  if (Platform.OS === "ios") return DynamicColorIOS({ light, dark });
  if (Platform.OS === "web") return `var(--app-${token})`;
  return light;
};

export const visitColors = {
  background: adaptive("#F1F0EB", "#111315", "background"),
  surface: adaptive("#FCFBF8", "#1A1D20", "surface"),
  surfaceMuted: adaptive("#E9E6DF", "#292D31", "subtle"),
  text: adaptive("#111722", "#F4F1EA", "text"),
  secondaryText: adaptive("#686B70", "#B2B4B7", "secondaryText"),
  line: adaptive("#D4D0C8", "#34383D", "line"),
  accent: adaptive("#EF5A24", "#FF8052", "accent"),
  accentSoft: adaptive("#FCE6DD", "#4A2820", "accentSoft"),
  success: adaptive("#237A46", "#74C88D", "success"),
  successSoft: adaptive("#E1F2E8", "#1E3A29", "successSoft"),
  danger: adaptive("#B42318", "#FF8B82", "danger"),
  dangerSoft: adaptive("#FCE8E6", "#492422", "dangerSoft"),
  white: "#FFFFFF",
};

export function SectionCard({ children, title, detail }: PropsWithChildren<{ title?: string; detail?: string }>) {
  return (
    <View style={styles.card}>
      {title ? <Text accessibilityRole="header" selectable style={styles.cardTitle}>{title}</Text> : null}
      {detail ? <Text selectable style={styles.cardDetail}>{detail}</Text> : null}
      {children}
    </View>
  );
}

export function ActionButton({
  label,
  icon,
  onPress,
  disabled = false,
  tone = "primary",
  accessibilityHint,
}: {
  label: string;
  icon?: IoniconsIconName;
  onPress: () => void;
  disabled?: boolean;
  tone?: "primary" | "secondary" | "danger" | "plain";
  accessibilityHint?: string;
}) {
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        tone === "primary" && styles.actionPrimary,
        tone === "secondary" && styles.actionSecondary,
        tone === "danger" && styles.actionDanger,
        tone === "plain" && styles.actionPlain,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {icon ? <Ionicons accessibilityElementsHidden color={tone === "primary" ? visitColors.white : tone === "danger" ? visitColors.danger : visitColors.text} name={icon} size={19} /> : null}
      <Text style={[styles.actionLabel, tone === "primary" && styles.actionLabelPrimary, tone === "danger" && styles.actionLabelDanger]}>{label}</Text>
    </Pressable>
  );
}

export function StatusPill({ label, tone = "neutral", icon }: { label: string; tone?: "neutral" | "accent" | "success" | "danger"; icon?: IoniconsIconName }) {
  const color = tone === "success" ? visitColors.success : tone === "danger" ? visitColors.danger : tone === "accent" ? visitColors.accent : visitColors.secondaryText;
  return (
    <View style={[styles.pill, tone === "success" && styles.pillSuccess, tone === "danger" && styles.pillDanger, tone === "accent" && styles.pillAccent]}>
      {icon ? <Ionicons accessibilityElementsHidden color={color} name={icon} size={14} /> : null}
      <Text style={[styles.pillLabel, { color }]}>{label}</Text>
    </View>
  );
}

export function DataRow({ icon, label, children, last = false }: { icon: IoniconsIconName; label: string; children: ReactNode; last?: boolean }) {
  return (
    <View style={[styles.dataRow, !last && styles.dataRowBorder]}>
      <Ionicons accessibilityElementsHidden color={visitColors.accent} name={icon} size={21} />
      <View style={styles.dataCopy}>
        <Text selectable style={styles.dataLabel}>{label}</Text>
        {typeof children === "string" ? <Text selectable style={styles.dataValue}>{children}</Text> : children}
      </View>
    </View>
  );
}

export function ScreenState({ icon, title, detail, actionLabel, onAction, loading = false }: { icon: IoniconsIconName; title: string; detail?: string; actionLabel?: string; onAction?: () => void; loading?: boolean }) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.state}>
      {loading ? <ActivityIndicator color={visitColors.accent} size="large" /> : <Ionicons accessibilityElementsHidden color={visitColors.secondaryText} name={icon} size={36} />}
      <Text accessibilityRole="header" selectable style={styles.stateTitle}>{title}</Text>
      {detail ? <Text selectable style={styles.stateDetail}>{detail}</Text> : null}
      {actionLabel && onAction ? <ActionButton label={actionLabel} onPress={onAction} tone="secondary" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: visitColors.surface, borderColor: visitColors.line, borderCurve: "continuous", borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, gap: 12, padding: 16 },
  cardTitle: { color: visitColors.text, fontSize: 17, fontWeight: "700", lineHeight: 23 },
  cardDetail: { color: visitColors.secondaryText, fontSize: 14, lineHeight: 20 },
  action: { alignItems: "center", borderCurve: "continuous", borderRadius: 13, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 48, paddingHorizontal: 16, paddingVertical: 11 },
  actionPrimary: { backgroundColor: visitColors.accent },
  actionSecondary: { backgroundColor: visitColors.surfaceMuted, borderColor: visitColors.line, borderWidth: StyleSheet.hairlineWidth },
  actionDanger: { backgroundColor: visitColors.dangerSoft },
  actionPlain: { backgroundColor: "transparent" },
  actionLabel: { color: visitColors.text, fontSize: 16, fontWeight: "700", textAlign: "center" },
  actionLabelPrimary: { color: visitColors.white },
  actionLabelDanger: { color: visitColors.danger },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.68, transform: [{ scale: 0.985 }] },
  pill: { alignItems: "center", alignSelf: "flex-start", backgroundColor: visitColors.surfaceMuted, borderRadius: 999, flexDirection: "row", gap: 5, minHeight: 28, paddingHorizontal: 10, paddingVertical: 5 },
  pillAccent: { backgroundColor: visitColors.accentSoft },
  pillSuccess: { backgroundColor: visitColors.successSoft },
  pillDanger: { backgroundColor: visitColors.dangerSoft },
  pillLabel: { fontSize: 13, fontWeight: "700" },
  dataRow: { alignItems: "flex-start", flexDirection: "row", gap: 12, paddingHorizontal: 15, paddingVertical: 14 },
  dataRowBorder: { borderBottomColor: visitColors.line, borderBottomWidth: StyleSheet.hairlineWidth },
  dataCopy: { flex: 1, gap: 3 },
  dataLabel: { color: visitColors.secondaryText, fontSize: 12, fontWeight: "600", textTransform: "uppercase" },
  dataValue: { color: visitColors.text, fontSize: 16, fontWeight: "600", lineHeight: 22 },
  state: { alignItems: "center", gap: 11, justifyContent: "center", minHeight: 280, paddingHorizontal: 28, paddingVertical: 40 },
  stateTitle: { color: visitColors.text, fontSize: 20, fontWeight: "700", lineHeight: 26, textAlign: "center" },
  stateDetail: { color: visitColors.secondaryText, fontSize: 15, lineHeight: 21, maxWidth: 380, textAlign: "center" },
});
