import type { PropsWithChildren } from "react";
import { Pressable, type PressableProps } from "react-native";
import { useRouter } from "expo-router";

export type AboutLinkProps = PropsWithChildren<{ label: string; onOpen: () => void; style?: PressableProps["style"] }>;

export function AboutLink({ label, style, children }: AboutLinkProps) {
  const router = useRouter();
  return <Pressable accessibilityLabel={label} accessibilityRole="button" style={style}
    onPress={() => router.push("/menu/about" as never)}>{children}</Pressable>;
}
