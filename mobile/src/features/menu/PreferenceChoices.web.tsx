import { useId } from "react";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useTextSize } from "@/features/accessibility/TextSizeProvider";
import { useAppearance } from "@/features/appearance/AppearanceProvider";
import type { ChoiceProps } from "./PreferenceChoices";

export function PreferenceChoices<T extends string>({ label, value, options, onChange }: ChoiceProps<T>) {
  const name = useId();
  const { scale } = useTextSize();
  const { palette } = useAppearance();
  return <div className="menu-choices" role="radiogroup" aria-label={label} style={{ fontSize: 15 * scale }}>
    {options.map(option => <label key={option.value} className="menu-choice" data-checked={value === option.value}>
      <input type="radio" name={name} value={option.value} aria-label={option.label} checked={value === option.value} onChange={() => onChange(option.value)} />
      {option.icon ? <Ionicons aria-hidden accessibilityElementsHidden name={option.icon} size={20} color={value === option.value ? palette.accent : palette.secondaryText} /> : null}
      {option.sampleSize ? <span aria-hidden="true" className="menu-choice-sample" style={{ fontSize: option.sampleSize * scale }}>Aa</span> : null}
      <span>{option.label}</span>
    </label>)}
  </div>;
}
