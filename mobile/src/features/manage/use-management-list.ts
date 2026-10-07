import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { withTimeout } from "@/lib/async-state";
import { useSession } from "@/features/session/SessionProvider";
import { ManagementPager } from "./management-pager";
import type {
  ManagementPage,
  ManagementPageRequest,
} from "./management-read-model";

export function useManagementList<T extends { id: string }>(
  key: string,
  loader: (request: ManagementPageRequest) => Promise<ManagementPage<T>>,
  request: ManagementPageRequest,
  enabled = true,
) {
  const session = useSession();
  const identity =
    session.status === "ready"
      ? `${session.account.id}:${session.account.role}:${session.account.status}`
      : session.status;
  const scope = `${identity}:${key}`;
  const pager = useRef<ManagementPager<T> | null>(null);
  if (!pager.current) pager.current = new ManagementPager<T>();
  const controller = pager.current;
  const input = useRef({ loader, request });
  input.current = { loader, request };
  const [state, setState] = useState(controller.state);
  useFocusEffect(
    useCallback(() => {
      const unsubscribe = controller.subscribe(setState);
      controller.configure(
        scope,
        (next) => withTimeout(input.current.loader(next)),
        input.current.request,
      );
      if (enabled) void controller.refresh();
      return () => {
        controller.cancel();
        unsubscribe();
      };
    }, [controller, enabled, scope]),
  );
  const current =
    state.scope === scope && enabled
      ? state
      : {
          ...state,
          items: [],
          total: 0,
          nextOffset: 0,
          loading: enabled ? ("initial" as const) : null,
          error: null,
        };
  return {
    ...current,
    hasMore: current.nextOffset < current.total,
    refresh: () => void controller.refresh(),
    append: () => void controller.append(),
    retry: () => void controller.retry(),
  };
}
