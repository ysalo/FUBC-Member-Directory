import { AppState, type AppStateStatus } from "react-native";
import { usePathname } from "expo-router";
import { useEffect, useState } from "react";

import { useSession } from "@/features/session/SessionProvider";
import { canManageAccounts } from "@/lib/permissions";

import { managementRepository } from "./management-repository";

export function usePendingAccountCount() {
    const pathname = usePathname();
    const session = useSession();
    const account = session.status === "ready" ? session.account : null;
    const accountId = account?.id ?? null;
    const eligible = canManageAccounts(account);
    const [count, setCount] = useState(0);

    useEffect(() => {
        let alive = true;
        let request = 0;

        const load = async () => {
            const currentRequest = ++request;
            if (!accountId || !eligible) {
                setCount(0);
                return;
            }
            try {
                const nextCount = await managementRepository.loadPendingAccountCount();
                if (alive && currentRequest === request) setCount(nextCount);
            } catch {
                if (alive && currentRequest === request) setCount(0);
            }
        };

        const handleAppState = (nextState: AppStateStatus) => {
            if (nextState === "active") void load();
        };
        const handleVisibility = () => {
            if (document.visibilityState === "visible") void load();
        };

        void load();
        const unsubscribe = managementRepository.subscribeAccountChanges(load);
        const appStateSubscription = AppState.addEventListener("change", handleAppState);
        const browserDocument = typeof document === "undefined" ? null : document;
        browserDocument?.addEventListener("visibilitychange", handleVisibility);
        return () => {
            alive = false;
            request += 1;
            unsubscribe();
            appStateSubscription.remove();
            browserDocument?.removeEventListener("visibilitychange", handleVisibility);
        };
    }, [accountId, eligible, pathname]);

    return count;
}