import DateTimePicker from "@expo/ui/community/datetime-picker";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, View, type ColorValue } from "react-native";

import { Text, TextInput } from "@/features/accessibility/app-text";

type Props = {
  accessibilityLabel: string;
  accentColor: ColorValue;
  backgroundColor: ColorValue;
  borderColor: ColorValue;
  disabled?: boolean;
  maximumDate?: Date;
  mode: "date" | "time";
  onChange: (value: string) => void;
  textColor: ColorValue;
  value: string;
};

function pickerDate(value: string, mode: Props["mode"]) {
  if (mode === "time") {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    const date = new Date();
    date.setHours(Number(match?.[1] ?? 12), Number(match?.[2] ?? 0), 0, 0);
    return date;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12) : new Date();
}

function serializePickerDate(date: Date, mode: Props["mode"]) {
  if (mode === "time") return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function NativeDateTimeField({ accessibilityLabel, accentColor, backgroundColor, borderColor, disabled, maximumDate, mode, onChange, textColor, value }: Props) {
  const [open, setOpen] = useState(false);
  const date = pickerDate(value, mode);
  const picker = <DateTimePicker accentColor={accentColor as string} disabled={disabled} display={Platform.OS === "ios" ? "compact" : "default"} is24Hour maximumDate={maximumDate} mode={mode} onDismiss={() => setOpen(false)} onValueChange={(_, selected) => { onChange(serializePickerDate(selected, mode)); setOpen(false); }} style={Platform.OS === "ios" ? styles.iosPickerOverlay : undefined} value={date} />;

  if (Platform.OS === "ios") return <View accessibilityLabel={accessibilityLabel} style={[styles.field, styles.iosField, { backgroundColor, borderColor }]}><Text accessibilityElementsHidden style={[styles.value, { color: textColor }]}>{mode === "date" ? date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : value}</Text>{picker}</View>;
  if (Platform.OS === "android") return <><Pressable accessibilityLabel={accessibilityLabel} accessibilityRole="button" disabled={disabled} onPress={() => setOpen(true)} style={[styles.field, { backgroundColor, borderColor }]}><Text style={[styles.value, { color: textColor }]}>{value}</Text></Pressable>{open ? picker : null}</>;
  return <TextInput accessibilityLabel={accessibilityLabel} editable={!disabled} keyboardType="numbers-and-punctuation" onChangeText={onChange} style={[styles.field, styles.value, { backgroundColor, borderColor, color: textColor }]} value={value} />;
}

const styles = StyleSheet.create({
  field: { alignItems: "center", borderCurve: "continuous", borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", justifyContent: "flex-start", minHeight: 50, paddingHorizontal: 12 },
  iosField: { alignSelf: "stretch", flexShrink: 1, justifyContent: "center", minWidth: 0, overflow: "hidden", position: "relative", width: "auto" },
  iosPickerOverlay: { bottom: 0, left: 0, opacity: 0.01, position: "absolute", right: 0, top: 0 },
  value: { fontSize: 17, fontVariant: ["tabular-nums"] },
});
