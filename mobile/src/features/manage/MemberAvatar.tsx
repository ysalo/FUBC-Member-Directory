import { Text } from "@/features/accessibility/app-text";
import { avatarInitials, avatarTone } from "@/features/members/avatar-fallback";
import { Image } from "expo-image";
import { useState } from "react";
import { avatarSourceIdentity, hasImageSource } from "@/features/members/ProfileAvatar";
import type { ImageSourcePropType } from "react-native";
import { StyleSheet, View } from "react-native";

type MemberAvatarProps = {
  name: string;
  source?: ImageSourcePropType;
  size?: number;
};

export function MemberAvatar({ name, source, size = 112 }: MemberAvatarProps) {
  const identity = avatarSourceIdentity(source);
  const requestIdentity = typeof source === "object" && source && "uri" in source ? source.uri : identity;
  const [failedSource, setFailedSource] = useState<string | undefined>();
  const failed = failedSource !== undefined && failedSource === requestIdentity;
  const initials = avatarInitials(name);
  const tone = avatarTone(name);
  const style = { borderRadius: size / 2, height: size, width: size };
  return hasImageSource(source) && !failed ? (
    <Image accessibilityLabel={`${name} profile photo`} cachePolicy="memory" recyclingKey={identity} transition={0} contentFit="cover" onError={() => setFailedSource(requestIdentity)} source={source} style={[styles.avatar, style]} />
  ) : (
    <View accessibilityLabel={`${name} initials`} style={[styles.avatar, style, { backgroundColor: tone.backgroundColor }]}>
      <Text style={[styles.initial, { color: tone.textColor, fontSize: size * 0.34 }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  initial: { fontWeight: "800" },
});
