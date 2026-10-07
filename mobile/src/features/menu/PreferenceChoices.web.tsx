import { useId } from "react";
import { useTextSize } from "@/features/accessibility/TextSizeProvider";
import type { ChoiceProps } from "./PreferenceChoices";
export function PreferenceChoices<T extends string>({label, value, options, onChange}: ChoiceProps<T>) {
  const name = useId();
  const {scale} = useTextSize();
  return <div className="menu-choices" role="radiogroup" aria-label={label} style={{fontSize: 16 * scale}}>
    {options.map(option => <label key={option.value} className="menu-choice" data-checked={value === option.value}>
      <input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} />
      <span>{option.label}</span>
    </label>)}
  </div>;
}
