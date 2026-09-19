import { Text } from "@/features/accessibility/app-text";
import { avatarInitials, avatarTone } from "@/features/members/avatar-fallback";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import type { ImageSourcePropType } from "react-native";
import { StyleSheet, View } from "react-native";

type MemberAvatarProps = {
  name: string;
  source?: ImageSourcePropType;
  size?: number;
  /** @deprecated Fallback tones are now assigned consistently from the member name. */
  backgroundColor?: string;
  /** @deprecated Fallback tones are now assigned consistently from the member name. */
  textColor?: string;
};

export function MemberAvatar({ name, source, size = 112 }: MemberAvatarProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [source]);
  const initials = avatarInitials(name);
  const tone = avatarTone(name);
  const style = { borderRadius: size / 2, height: size, width: size };
  return source && !failed ? (
    <Image accessibilityLabel={`${name} profile photo`} contentFit="cover" onError={() => setFailed(true)} source={source} style={[styles.avatar, style]} />
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
