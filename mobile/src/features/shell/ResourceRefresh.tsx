import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Platform, Pressable, View } from "react-native";
import { Text } from "@/features/accessibility/app-text";
import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";

export function ResourceRefresh({ error, refreshing, onRefresh }: { error: boolean; refreshing: boolean; onRefresh: () => void }) {
    const { palette } = useAppearance();
    const { locale } = useLocalization();
    if (Platform.OS !== "web" && !error) return null;
    const label = locale === "uk" ? "Оновити" : "Refresh";
    return <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8, paddingHorizontal: 20 }}>
        {error && <Text accessibilityLiveRegion="polite" style={{ color: palette.secondaryText, flex: 1 }}>{locale === "uk" ? "Не вдалося оновити дані." : "Could not refresh data."}</Text>}
        <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ busy: refreshing, disabled: refreshing }} disabled={refreshing} onPress={onRefresh} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="refresh-outline" size={21} color={palette.secondaryText} />
        </Pressable>
    </View>;
}