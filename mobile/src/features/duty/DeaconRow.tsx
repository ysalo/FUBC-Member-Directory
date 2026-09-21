import { Text } from "@/features/accessibility/app-text";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Link, useRouter } from "expo-router";
import { Platform, Pressable, StyleSheet, View, type ImageSourcePropType } from "react-native";

import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { ProfileAvatar } from "@/features/members/ProfileAvatar";

type DeaconRowProps = {
  personId: string;
  name: string;
  avatar?: ImageSourcePropType | null;
  card?: boolean;
  detail?: string;
  locale: "en" | "uk";
  size?: number;
  tag?: string;
  tagTone?: "today" | "you";
};

/** Every deacon mention behaves like a Directory member row: tap the name/avatar to open their profile. */
export function DeaconRow({ personId, name, avatar, card = false, detail, locale, size = 44, tag, tagTone = "today" }: DeaconRowProps) {
  const router = useRouter();
  const { palette } = useAppearance();
  const onPress = () => router.push(`/members/${personId}` as never);
  const row = (
    <Pressable
      accessibilityHint={locale === "uk" ? `Відкрити профіль: ${name}` : `Opens ${name}’s member profile`}
      accessibilityRole={Platform.OS === "web" ? "link" : "button"}
      onPress={Platform.OS === "web" ? undefined : onPress}
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
        {detail ? <Text style={[styles.detail, { color: palette.secondaryText }]}>{detail}</Text> : null}
      </View>
      <Ionicons accessibilityElementsHidden color={palette.secondaryText} name="chevron-forward" size={18} />
    </Pressable>
  );
  return Platform.OS === "web" ? (
    <Link asChild href={`/members/${personId}`}>
      {row}
    </Link>
  ) : (
    row
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
  tag: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  tagText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
});
