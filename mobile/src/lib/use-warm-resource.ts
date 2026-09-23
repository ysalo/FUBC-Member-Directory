import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { AppState, Platform } from "react-native";
import { createSessionCache, sessionCacheScope, subscribeDataChanges } from "./session-cache";
import { InvalidatedRequestError } from "./query-cache";
import { refreshSession } from "./session";
import { isBackendConfigured } from "./supabase";

const snapshots = createSessionCache<unknown>(["directory", "groups", "duty", "visits", "photos"]);

export function useWarmResource<Value>(key: string, loader: (fresh: boolean) => Promise<Value>) {
    const scope = (() => { try { return sessionCacheScope(); } catch { return null; } })();
    const [state, setState] = useState<{ scope: string | null; key: string; data?: Value; error: boolean; refreshing: boolean }>(() => ({
        scope, key, data: snapshots.peek(key) as Value | undefined, error: false, refreshing: false,
    }));
    const request = useRef(0);
    const focused = useRef(false);
    const load = useCallback((fresh = false) => {
        if (!focused.current || scope === null) return;
        const ticket = ++request.current;
        setState((previous) => ({ ...previous, error: false, refreshing: fresh }));
        void snapshots.load(key, () => loader(fresh), fresh, 0).then((data) => {
            if (focused.current && request.current === ticket && sessionCacheScope() === scope)
                setState({ scope, key, data: data as Value, error: false, refreshing: false });
        }).catch((error) => {
            if (focused.current && request.current === ticket && !(error instanceof InvalidatedRequestError))
                setState((previous) => ({ ...previous, error: true, refreshing: false }));
        });
    }, [key, loader, scope]);

    useFocusEffect(useCallback(() => {
        focused.current = true;
        load();
        const unsubscribe = subscribeDataChanges(() => load());
        const resume = () => {
            if (isBackendConfigured) void refreshSession().then(() => load()).catch(() => {});
            else load();
        };
        const appState = AppState.addEventListener("change", (next) => { if (next === "active") resume(); });
        const visible = () => { if (document.visibilityState === "visible") resume(); };
        if (Platform.OS === "web") document.addEventListener("visibilitychange", visible);
        const timer = setInterval(() => {
            if (AppState.currentState === "active" && (Platform.OS !== "web" || document.visibilityState === "visible")) resume();
        }, 240_000);
        return () => {
            focused.current = false;
            request.current++;
            unsubscribe();
            appState.remove();
            clearInterval(timer);
            if (Platform.OS === "web") document.removeEventListener("visibilitychange", visible);
        };
    }, [load]));

    const data = state.scope === scope && state.key === key && scope !== null ? state.data : undefined;
    return { data, error: state.error, refreshing: state.refreshing, status: data !== undefined ? "ready" as const : state.error ? "error" as const : "loading" as const, refresh: () => load(true) };
}