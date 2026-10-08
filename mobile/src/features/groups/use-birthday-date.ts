import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { AppState, Platform } from "react-native";
import { isoToFixedPdt } from "@/lib/dates";

/** One midnight timer while focused; resume checks never fetch or schedule notifications. */
export function useBirthdayDate() {
    const [date, setDate] = useState(() => isoToFixedPdt(new Date().toISOString()).date);
    useFocusEffect(useCallback(() => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const refresh = () => {
            if (timer !== undefined) clearTimeout(timer);
            const visible = Platform.OS === "web"
                ? document.visibilityState === "visible"
                : AppState.currentState !== "background" && AppState.currentState !== "inactive";
            if (!visible) return;
            const now = new Date();
            const today = isoToFixedPdt(now.toISOString()).date;
            setDate(current => current === today ? current : today);
            const midnight = Date.parse(`${today}T00:00:00-07:00`) + 86_400_000;
            timer = setTimeout(refresh, midnight - now.getTime());
        };
        refresh();
        const subscription = AppState.addEventListener("change", refresh);
        if (Platform.OS === "web") document.addEventListener("visibilitychange", refresh);
        return () => {
            if (timer !== undefined) clearTimeout(timer);
            subscription.remove();
            if (Platform.OS === "web") document.removeEventListener("visibilitychange", refresh);
        };
    }, []));
    return date;
}
