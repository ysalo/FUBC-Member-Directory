import { Pressable } from "react-native";
import type { AboutLinkProps } from "./AboutLink";

export function AboutLink({ label, style, onOpen, children }: AboutLinkProps) {
  return <Pressable accessibilityLabel={label} accessibilityRole="button" style={style} onPress={onOpen}>{children}</Pressable>;
}
