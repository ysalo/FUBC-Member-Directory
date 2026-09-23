import { Text } from "@/features/accessibility/app-text";
import { Image } from "expo-image";
import { useState } from "react";
import { StyleSheet, View, type ImageSourcePropType } from "react-native";
import { avatarInitials, avatarTone } from "./avatar-fallback";

type ProfileAvatarProps = {
  name: string;
  source?: ImageSourcePropType | null;
  size?: number;
};

/** Directory/profile repositories default to an empty object when a person has no photo path. */
export function hasImageSource(source?: ImageSourcePropType | null): boolean {
  return Boolean(source && (typeof source !== "object" || Array.isArray(source) || Object.keys(source).length > 0));
}

export function avatarSourceIdentity(source?: ImageSourcePropType | null) {
  if (!source) return "";
  if (typeof source === "number") return String(source);
  const image = (Array.isArray(source) ? source[0] : source) as { uri?: string; cacheKey?: string };
  return image?.cacheKey ?? image?.uri ?? "";
}

export function ProfileAvatar({ name, source, size = 40 }: ProfileAvatarProps) {
  const identity = avatarSourceIdentity(source);
  const requestIdentity = typeof source === "object" && source && "uri" in source ? source.uri : identity;
  const [failedSource, setFailedSource] = useState<string | undefined>();
  const failed = failedSource !== undefined && failedSource === requestIdentity;
  const hasSource = hasImageSource(source);
  const initials = avatarInitials(name);
  const tone = avatarTone(name);

  return hasSource && !failed ? (
    <Image accessibilityLabel={`${name} profile photo`} cachePolicy="memory" recyclingKey={identity} transition={0} contentFit="cover" onError={() => setFailedSource(requestIdentity)} source={source as never} style={{ borderRadius: size / 2, height: size, width: size }} />
  ) : (
    <View accessibilityLabel={`${name} initials`} style={[styles.fallback, { backgroundColor: tone.backgroundColor, borderRadius: size / 2, height: size, width: size }]}>
      <Text style={[styles.initials, { color: tone.textColor, fontSize: Math.max(13, size * 0.38) }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: "center", justifyContent: "center" },
  initials: { fontWeight: "800" },
});
