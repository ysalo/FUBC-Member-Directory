import { Text } from "@/features/accessibility/app-text";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";

import { WebTabBar } from "./WebTabBar";

type Props = { title: string; detail: string };

export function PlaceholderScreen({ title, detail }: Props) {
  const router = useRouter();
  const { copy } = useLocalization();
  const { palette } = useAppearance();
  return (
    <View style={[styles.safe, { backgroundColor: palette.background }]}>
      <View style={styles.content}>
        <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>{title}</Text>
        <View style={[styles.rule, { backgroundColor: palette.accent }]} />
        <Text style={[styles.detail, { color: palette.secondaryText }]}>{detail}</Text>
        <Pressable onPress={() => router.replace("/(directory)" as never)} style={[styles.action, { backgroundColor: palette.text }]}>
          <Text style={[styles.actionLabel, { color: palette.background }]}>{copy.placeholders.return}</Text>
        </Pressable>
      </View>
      <WebTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: "#F1F0EB", flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 34 },
  title: { color: "#262A2E", fontSize: 44, fontWeight: "800", letterSpacing: -1.2 },
  rule: { backgroundColor: "#EF5A24", height: 4, marginTop: 16, width: 44 },
  detail: { color: "#5D6064", fontSize: 18, lineHeight: 26, marginTop: 28, maxWidth: 440 },
  action: { alignSelf: "flex-start", backgroundColor: "#3D4248", borderRadius: 13, marginTop: 30, paddingHorizontal: 18, paddingVertical: 13 },
  actionLabel: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
