import type { ComponentProps } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Text } from "@/features/accessibility/app-text";
import { useTextSize } from "@/features/accessibility/TextSizeProvider";
import { useAppearance } from "@/features/appearance/AppearanceProvider";

export type ChoiceProps<T extends string> = {
  label: string;
  value: T;
  options: readonly { value: T; label: string; sampleSize?: number; icon?: ComponentProps<typeof Ionicons>["name"] }[];
  onChange: (value: T) => void;
};

export function PreferenceChoices<T extends string>({ label, value, options, onChange }: ChoiceProps<T>) {
  const { palette } = useAppearance();
  const { scale } = useTextSize();
  return <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.group, { backgroundColor: palette.subtle }]}>
    {options.map(option => {
      const selected = value === option.value;
      return <Pressable key={option.value} accessibilityRole="radio" accessibilityLabel={option.label}
        accessibilityState={{ checked: selected }} onPress={() => onChange(option.value)}
        style={({ pressed }) => [styles.option, { flexBasis: 140 * scale, backgroundColor: selected ? palette.elevated : "transparent", borderColor: selected ? palette.accent : "transparent" }, pressed && { opacity: 0.7 }]}>
        {option.icon ? <Ionicons accessibilityElementsHidden importantForAccessibility="no" color={selected ? palette.accent : palette.secondaryText} name={option.icon} size={20} /> : null}
        {option.sampleSize ? <Text accessibilityElementsHidden importantForAccessibility="no" style={[styles.sample, { fontSize: option.sampleSize, color: palette.text }]}>Aa</Text> : null}
        <Text style={[styles.label, { color: selected ? palette.text : palette.secondaryText }]}>{option.label}</Text>
      </Pressable>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  group: { flexDirection: "row", flexWrap: "wrap", gap: 4, padding: 4, borderRadius: 12 },
  option: { flexGrow: 1, borderWidth: 2, borderRadius: 9, alignItems: "center", justifyContent: "center", gap: 6, minHeight: 48, paddingHorizontal: 8, paddingVertical: 10 },
  sample: { fontWeight: "700" },
  label: { fontSize: 15, fontWeight: "600", textAlign: "center" },
});
