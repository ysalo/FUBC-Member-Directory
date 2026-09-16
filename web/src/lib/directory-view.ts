"use client";

import { useCallback, useSyncExternalStore } from "react";

type DirectoryView = {
  query: string;
  view: "members" | "birthdays";
  badgeFilters: { widowed: boolean; orphan: boolean };
};
const initialView: DirectoryView = {
  query: "",
  view: "members",
  badgeFilters: { widowed: false, orphan: false },
};
const views = new Map<string, DirectoryView>();
const scrollPositions = new Map<string, number>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function getDirectoryView(key: string) {
  return views.get(key) ?? initialView;
}
export function updateDirectoryView(
  key: string,
  patch: Partial<DirectoryView>,
) {
  views.set(key, { ...getDirectoryView(key), ...patch });
  scrollPositions.set(key, 0);
  listeners.forEach((listener) => listener());
}
export function getDirectoryScroll(key: string) {
  return scrollPositions.get(key) ?? 0;
}
export function rememberDirectoryScroll(key: string, position: number) {
  scrollPositions.set(key, position);
}
export function clearDirectoryViews() {
  views.clear();
  scrollPositions.clear();
  listeners.forEach((listener) => listener());
}
export function useDirectoryView(key: string) {
  const state = useSyncExternalStore(
    subscribe,
    useCallback(() => getDirectoryView(key), [key]),
    () => initialView,
  );
  return {
    state,
    update: useCallback(
      (patch: Partial<DirectoryView>) => updateDirectoryView(key, patch),
      [key],
    ),
    getScroll: useCallback(() => getDirectoryScroll(key), [key]),
    rememberScroll: useCallback(
      (position: number) => rememberDirectoryScroll(key, position),
      [key],
    ),
  };
}
