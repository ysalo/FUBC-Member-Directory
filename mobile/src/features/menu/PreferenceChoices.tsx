import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/features/accessibility/app-text";
import { useAppearance } from "@/features/appearance/AppearanceProvider";

export type ChoiceProps<T extends string> = { label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (value: T) => void };
export function PreferenceChoices<T extends string>({label, value, options, onChange}: ChoiceProps<T>) {
  const {palette} = useAppearance();
  return <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.group}>
    {options.map(option => <Pressable key={option.value} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{checked: value === option.value}} onPress={() => onChange(option.value)} style={({pressed}) => [styles.option, {backgroundColor: palette.elevated, borderColor: value === option.value ? palette.accent : palette.line}, pressed && {opacity: 0.7}]}>
      <View style={[styles.radio, {borderColor: value === option.value ? palette.accent : palette.secondaryText}]}>{value === option.value && <View style={[styles.dot, {backgroundColor: palette.accent}]} />}</View>
      <Text style={[styles.label, {color: palette.text}]}>{option.label}</Text>
    </Pressable>)}
  </View>;
}
const styles = StyleSheet.create({group: {gap: 8}, option: {borderWidth: 1, borderRadius: 10, flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, padding: 12}, radio: {width: 18, height: 18, borderWidth: 1.5, borderRadius: 9, alignItems: "center", justifyContent: "center"}, dot: {width: 8, height: 8, borderRadius: 4}, label: {fontSize: 16, fontWeight: "600", flex: 1}});
