import { createContext, type PropsWithChildren, useContext, useEffect, useSyncExternalStore } from "react";
import { AppState, Platform } from "react-native";

import { getSessionState, startSession, subscribeSession, type SessionState } from "@/lib/session";
import { sessionCacheScope } from "@/lib/session-cache";
import { Image } from "expo-image";
import { isBackendConfigured, requireSupabase } from "@/lib/supabase";

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const state = useSyncExternalStore(subscribeSession, getSessionState, getSessionState);
  useEffect(() => startSession(), []);
  useEffect(() => {
    if (!isBackendConfigured || state?.status !== "ready") return;
    const accountId = state.account.id;
    let visible = Platform.OS === "web"
      ? document.visibilityState === "visible"
      : AppState.currentState === "active";
    let timer: ReturnType<typeof setInterval> | undefined;
    let recording = false;
    const record = () => {
      if (!visible || recording) return;
      recording = true;
      void requireSupabase().rpc("record_account_use", {}).then(() => {}).catch(() => {}).finally(() => { recording = false; });
    };
    const start = () => {
      if (!visible || timer) return;
      record();
      timer = setInterval(record, 5 * 60 * 1000);
    };
    const stop = () => { if (timer) clearInterval(timer); timer = undefined; };
    const syncVisibility = () => {
      visible = Platform.OS === "web" ? document.visibilityState === "visible" : AppState.currentState === "active";
      if (visible) start(); else stop();
    };
    const appState = AppState.addEventListener("change", syncVisibility);
    if (Platform.OS === "web") document.addEventListener("visibilitychange", syncVisibility);
    start();
    return () => {
      stop();
      appState.remove();
      if (Platform.OS === "web") document.removeEventListener("visibilitychange", syncVisibility);
    };
  }, [state?.status === "ready" ? state.account.id : null]);
  useEffect(() => {
    let previous = "";
    const clear = () => {
      let next = "";
      try { next = sessionCacheScope(); } catch {}
      if (next !== previous) { previous = next; void Image.clearMemoryCache().catch(() => {}); }
    };
    clear();
    return subscribeSession(clear);
  }, []);
  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}
export function useSession() {
  const state = useContext(SessionContext);
  if (!state) throw new Error("useSession must be used inside SessionProvider");
  return state;
}
