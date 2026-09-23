import { useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { ActivityIndicator, Platform, View } from "react-native";
import { Text } from "@/features/accessibility/app-text";
import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";

export function ResourceRefresh({ error, refreshing, onRefresh }: { error: boolean; refreshing: boolean; onRefresh: () => void }) {
    const { palette } = useAppearance();
    const { locale } = useLocalization();
    useFocusEffect(useCallback(() => {
        if (Platform.OS !== "web" || refreshing) return;
        const container = document.getElementById("app-content");
        if (!container) return;
        let start: { x: number; y: number } | null = null;
        let distance = 0;
        const cancel = () => { start = null; distance = 0; };
        const begin = (event: TouchEvent) => {
            cancel();
            if (event.touches.length !== 1 || !(event.target instanceof Element)) return;
            if (event.target.closest("input, textarea, select, [contenteditable=true], [role=slider]")) return;
            for (let element: Element | null = event.target; element; element = element.parentElement) {
                if (element.scrollTop > 0) return;
            }
            start = { x: event.touches[0].clientX, y: event.touches[0].clientY };
        };
        const move = (event: TouchEvent) => {
            if (!start) return;
            if (event.touches.length !== 1) { cancel(); return; }
            const vertical = event.touches[0].clientY - start.y;
            const horizontal = Math.abs(event.touches[0].clientX - start.x);
            if (vertical < 0 || horizontal > Math.max(10, vertical)) { cancel(); return; }
            distance = vertical;
            if (vertical > 10 && event.cancelable) event.preventDefault();
        };
        const finish = () => {
            const shouldRefresh = distance >= 72;
            cancel();
            if (shouldRefresh) onRefresh();
        };
        container.addEventListener("touchstart", begin, { passive: true });
        container.addEventListener("touchmove", move, { passive: false });
        container.addEventListener("touchend", finish);
        container.addEventListener("touchcancel", cancel);
        return () => {
            container.removeEventListener("touchstart", begin);
            container.removeEventListener("touchmove", move);
            container.removeEventListener("touchend", finish);
            container.removeEventListener("touchcancel", cancel);
        };
    }, [onRefresh, refreshing]));
    const showProgress = Platform.OS === "web" && refreshing;
    if (!error && !showProgress) return null;
    return <View style={{ alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 8 }}>
        {error && <Text accessibilityLiveRegion="polite" style={{ color: palette.secondaryText }}>{locale === "uk" ? "Не вдалося оновити дані." : "Could not refresh data."}</Text>}
        {showProgress && <ActivityIndicator accessibilityLabel={locale === "uk" ? "Оновлення" : "Refreshing"} color={palette.secondaryText} />}
    </View>;
}