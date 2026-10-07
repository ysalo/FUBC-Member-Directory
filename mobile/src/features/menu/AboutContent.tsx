import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { Text } from "@/features/accessibility/app-text";
import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { menuCopy } from "./menu-copy";

export function AboutContent({ onClose, safeArea = false }: { onClose: () => void; safeArea?: boolean }) {
  const { palette } = useAppearance();
  const { locale } = useLocalization();
  const labels = menuCopy[locale];
  return <SafeAreaView edges={safeArea ? ["top", "bottom"] : []} style={[styles.sheet, { backgroundColor: palette.background }]}>
    <View style={[styles.header, { borderBottomColor: palette.line }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>{labels.about}</Text>
      <Pressable accessibilityRole="button" hitSlop={8} onPress={onClose}
        style={({ pressed }) => [styles.doneButton, pressed && { opacity: 0.68 }]}>
        <Text style={[styles.doneText, { color: palette.accent }]}>{labels.done}</Text>
      </Pressable>
    </View>
    <ScrollView style={styles.scroll} contentInsetAdjustmentBehavior={safeArea ? "never" : "automatic"} contentContainerStyle={styles.content}>
      <Text selectable style={[styles.versionText, { color: palette.secondaryText }]}>{labels.version} {Constants.expoConfig?.version ?? labels.unavailable}</Text>
      <Text accessibilityRole="header" style={[styles.licensesTitle, { color: palette.text }]}>{labels.licenses}</Text>
      <View style={[styles.licensePanel, { backgroundColor: palette.surface }]}>
        <Text selectable style={[styles.licenseTitle, { color: palette.text }]}>{labels.iconLicense}</Text>
        <Text selectable style={[styles.copyright, { color: palette.secondaryText }]}>{labels.iconCopyright}</Text>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  sheet: { flex: 1, minHeight: 0 },
  header: { alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", flexShrink: 0, minHeight: 58, gap: 16, paddingVertical: 8, paddingHorizontal: 20 },
  title: { flex: 1, fontSize: 20, fontWeight: "700" },
  doneButton: { alignItems: "center", justifyContent: "center", minHeight: 44, minWidth: 44 },
  doneText: { fontSize: 17, fontWeight: "600" },
  scroll: { flexGrow: 1, flexShrink: 1 },
  content: { gap: 18, padding: 20 },
  versionText: { fontSize: 15, lineHeight: 21 },
  licensesTitle: { fontSize: 22, fontWeight: "700" },
  licensePanel: { borderRadius: 16, padding: 18 },
  licenseTitle: { fontSize: 17, fontWeight: "700" },
  copyright: { fontSize: 14, lineHeight: 20, marginTop: 8 },
});
