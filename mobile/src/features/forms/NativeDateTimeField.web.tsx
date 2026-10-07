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
  placeholder?: string;
  /** Let the form validate typed dates against maximumDate when saving. */
  allowOutOfRange?: boolean;
};

export function NativeDateTimeField({ accessibilityLabel, accentColor, backgroundColor, borderColor, disabled, maximumDate, mode, onChange, textColor, value, placeholder, allowOutOfRange = false }: Props) {
  const { scale } = useTextSize();
  const maximum = mode === "date" && maximumDate ? localDateValue(maximumDate) : undefined;
  return <input aria-label={accessibilityLabel} title={placeholder} disabled={disabled} max={maximum} type={mode} value={value}
    onChange={(event) => {
      const next = event.currentTarget.value;
      if ((allowOutOfRange || event.currentTarget.validity.valid) && acceptsDateFieldValue(next, mode, allowOutOfRange ? undefined : maximum)) onChange(next);
    }}
    style={{ accentColor: String(accentColor), alignSelf: "stretch", background: String(backgroundColor), border: `1px solid ${String(borderColor)}`, borderRadius: 14, boxSizing: "border-box", color: String(textColor), display: "block", flexShrink: 1, font: "inherit", fontSize: 16 * scale, inlineSize: "auto", maxInlineSize: "100%", maxWidth: "100%", minHeight: 50, minInlineSize: 0, minWidth: 0, overflow: "hidden", padding: "10px", width: "auto" }} />;
}
