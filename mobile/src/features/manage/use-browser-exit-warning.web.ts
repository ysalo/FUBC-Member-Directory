import { useEffect } from "react";
import type { RefObject } from "react";

export function useBrowserExitWarning(dirty: boolean, allowed: RefObject<boolean>) {
  useEffect(() => {
    if (!dirty) return;
    const editUrl = window.location.href;
    const editHistoryState = window.history.state;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const restoreUrl = () => {
      // Expo Router can retain the form after browser Back changes the address.
      if (!allowed.current) window.history.pushState(editHistoryState, "", editUrl);
    };
    window.addEventListener("beforeunload", warn);
    window.addEventListener("popstate", restoreUrl);
    return () => { window.removeEventListener("beforeunload", warn); window.removeEventListener("popstate", restoreUrl); };
  }, [dirty, allowed]);
}
