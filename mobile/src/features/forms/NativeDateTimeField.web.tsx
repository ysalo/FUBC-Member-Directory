import type { ColorValue } from "react-native";
import { useTextSize } from "@/features/accessibility/TextSizeProvider";
import { acceptsDateFieldValue, localDateValue } from "./date-field";

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

export function NativeDateTimeField({ accessibilityLabel, accentColor, backgroundColor, borderColor, disabled, maximumDate, mode, onChange, textColor, value }: Props) {
  const { scale } = useTextSize();
  const maximum = mode === "date" && maximumDate ? localDateValue(maximumDate) : undefined;
  return <input aria-label={accessibilityLabel} disabled={disabled} max={maximum} type={mode} value={value}
    onChange={(event) => {
      const next = event.currentTarget.value;
      if (event.currentTarget.validity.valid && acceptsDateFieldValue(next, mode, maximum)) onChange(next);
    }}
    style={{ accentColor: String(accentColor), background: String(backgroundColor), border: `1px solid ${String(borderColor)}`, borderRadius: 14, boxSizing: "border-box", color: String(textColor), display: "block", flexShrink: 1, font: "inherit", fontSize: 16 * scale, inlineSize: "100%", maxInlineSize: "100%", maxWidth: "100%", minHeight: 50, minInlineSize: 0, minWidth: 0, overflow: "hidden", padding: "10px", width: "100%" }} />;
}
