import { useMemo } from "react";
import { StyleSheet, Text as NativeText, TextInput as NativeTextInput, type TextInputProps, type TextProps, type TextStyle } from "react-native";

import { useTextSize } from "./TextSizeProvider";

function scaledTypography(style: TextProps["style"] | TextInputProps["style"], scale: number): TextStyle {
  const flattened = StyleSheet.flatten(style) ?? {};
  return {
    fontSize: typeof flattened.fontSize === "number" ? flattened.fontSize * scale : undefined,
    lineHeight: typeof flattened.lineHeight === "number" ? flattened.lineHeight * scale : undefined,
  };
}

export function Text({ style, ...props }: TextProps) {
  const { scale } = useTextSize();
  const typography = useMemo(() => scaledTypography(style, scale), [scale, style]);
  return <NativeText {...props} style={[style, typography]} />;
}

export function TextInput({ style, ...props }: TextInputProps) {
  const { scale } = useTextSize();
  const typography = useMemo(() => scaledTypography(style, scale), [scale, style]);
  return <NativeTextInput {...props} style={[style, typography]} />;
}
