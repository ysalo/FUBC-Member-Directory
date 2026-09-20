import { usePathname } from "expo-router";
import { useEffect, useState } from "react";

import { useSession } from "@/features/session/SessionProvider";

import { getActiveVisitationCount, visitationRepository } from "./repository";

export function useActiveVisitationCount() {
  const pathname = usePathname();
  const session = useSession();
  const accountId = session.status === "ready" ? session.account.id : null;
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!accountId) {
        setCount(0);
        return;
      }
      try {
        const nextCount = await getActiveVisitationCount();
        if (active) setCount(nextCount);
      } catch {
        if (active) setCount(0);
      }
    };

    void load();
    const unsubscribe = visitationRepository.subscribe(() => void load());
    return () => {
      active = false;
      unsubscribe();
    };
  }, [accountId, pathname]);

  return count;
}