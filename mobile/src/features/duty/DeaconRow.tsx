import { Text } from "@/features/accessibility/app-text";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View, type ImageSourcePropType } from "react-native";

import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { ProfileAvatar } from "@/features/members/ProfileAvatar";

type DeaconRowProps = {
  personId: string;
  name: string;
  avatar?: ImageSourcePropType | null;
  card?: boolean;
  detail?: string;
  emphasizeDetail?: boolean;
  locale: "en" | "uk";
  size?: number;
  tag?: string;
  tagTone?: "today" | "you";
};

/** Every deacon mention behaves like a Directory member row: tap the name/avatar to open their profile. */
export function DeaconRow({ personId, name, avatar, card = false, detail, emphasizeDetail = false, locale, size = 44, tag, tagTone = "today" }: DeaconRowProps) {
  const router = useRouter();
  const { palette } = useAppearance();
  const onPress = () => router.push(`/members/${personId}` as never);
  return (
    <Pressable
      accessibilityHint={locale === "uk" ? `Відкрити профіль: ${name}` : `Opens ${name}’s member profile`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        card && styles.card,
        card && { backgroundColor: palette.surface, borderColor: palette.line },
        pressed && styles.pressed,
      ]}
    >
      <ProfileAvatar name={name} size={size} source={avatar} />
      <View style={styles.copy}>
        <View style={styles.nameLine}>
          <Text numberOfLines={1} style={[styles.name, { color: palette.text }]}>{name}</Text>
          {tag ? (
            <View style={[styles.tag, { backgroundColor: tagTone === "you" ? palette.text : palette.accent }]}>
              <Text style={[styles.tagText, { color: palette.surface }]}>{tag}</Text>
            </View>
          ) : null}
        </View>
        {detail ? <Text style={[styles.detail, emphasizeDetail && styles.emphasizedDetail, { color: emphasizeDetail ? palette.text : palette.secondaryText }]}>{detail}</Text> : null}
      </View>
      <Ionicons accessibilityElementsHidden color={palette.secondaryText} name="chevron-forward" size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: "center", flexDirection: "row", gap: 10, paddingVertical: 6 },
  card: { borderCurve: "continuous", borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, gap: 11, minHeight: 70, padding: 12 },
  pressed: { opacity: 0.68 },
  copy: { flex: 1, minWidth: 0 },
  nameLine: { alignItems: "center", flexDirection: "row", gap: 6 },
  name: { fontSize: 16, fontWeight: "700" },
  detail: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  emphasizedDetail: { fontSize: 20, fontWeight: "800", lineHeight: 26, marginTop: 4 },
  tag: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  tagText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
});
