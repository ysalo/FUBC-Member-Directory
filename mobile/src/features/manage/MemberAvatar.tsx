import { Text } from "@/features/accessibility/app-text";
import { Image } from "expo-image";
import type { ImageSourcePropType } from "react-native";
import { StyleSheet, View } from "react-native";

type MemberAvatarProps = {
  name: string;
  source?: ImageSourcePropType;
  size?: number;
  backgroundColor: string;
  textColor: string;
};

export function MemberAvatar({ name, source, size = 112, backgroundColor, textColor }: MemberAvatarProps) {
  const initial = name.trim().slice(0, 1).toLocaleUpperCase() || "?";
  const style = { borderRadius: size / 2, height: size, width: size };
  return source ? (
    <Image accessibilityLabel={`${name} profile photo`} contentFit="cover" source={source} style={[styles.avatar, style]} />
  ) : (
    <View accessibilityLabel={`${name} profile photo placeholder`} style={[styles.avatar, style, { backgroundColor }]}>
      <Text style={[styles.initial, { color: textColor, fontSize: size * 0.38 }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  initial: { fontWeight: "800" },
});
