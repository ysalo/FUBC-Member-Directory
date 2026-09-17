import { createContext, type PropsWithChildren, useContext, useEffect, useSyncExternalStore } from "react";

import { getSessionState, startSession, subscribeSession, type SessionState } from "@/lib/session";

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const state = useSyncExternalStore(subscribeSession, getSessionState, getSessionState);
  useEffect(() => startSession(), []);
  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const state = useContext(SessionContext);
  if (!state) throw new Error("useSession must be used inside SessionProvider");
  return state;
}

