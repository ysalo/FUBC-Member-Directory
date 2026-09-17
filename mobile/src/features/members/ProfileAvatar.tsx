import { Image } from "expo-image";
import { StyleSheet, Text, View, type ImageSourcePropType } from "react-native";

type ProfileAvatarProps = {
  name: string;
  source?: ImageSourcePropType | null;
  size?: number;
  backgroundColor: string;
  textColor: string;
};

export function ProfileAvatar({ name, source, size = 40, backgroundColor, textColor }: ProfileAvatarProps) {
  const hasSource = Boolean(source && (typeof source !== "object" || Array.isArray(source) || Object.keys(source).length > 0));
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase())
    .join("") || "?";

  return hasSource ? (
    <Image accessibilityLabel={`${name} profile photo`} contentFit="cover" source={source as never} style={{ borderRadius: size / 2, height: size, width: size }} />
  ) : (
    <View accessibilityLabel={`${name} initials`} style={[styles.fallback, { backgroundColor, borderRadius: size / 2, height: size, width: size }]}>
      <Text style={[styles.initials, { color: textColor, fontSize: Math.max(13, size * 0.38) }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: "center", justifyContent: "center" },
  initials: { fontWeight: "800" },
});
