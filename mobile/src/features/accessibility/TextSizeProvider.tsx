import * as SecureStore from "expo-secure-store";
import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

export type TextSizePreference = "small" | "standard" | "large";

const STORAGE_KEY = "fubc.text-size";
const scales: Record<TextSizePreference, number> = { small: 0.9, standard: 1, large: 1.18 };

type TextSizeValue = {
  preference: TextSizePreference;
  scale: number;
  setPreference: (preference: TextSizePreference) => void;
};

const TextSizeContext = createContext<TextSizeValue | null>(null);

export function TextSizeProvider({ children }: PropsWithChildren) {
  const [preference, setPreferenceState] = useState<TextSizePreference>("standard");

  useEffect(() => {
    let active = true;
    const readPreference = async () => Platform.OS === "web" ? window.localStorage.getItem(STORAGE_KEY) : SecureStore.getItemAsync(STORAGE_KEY);
    void readPreference().then((stored) => {
      if (active && (stored === "small" || stored === "standard" || stored === "large")) setPreferenceState(stored);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const setPreference = (next: TextSizePreference) => {
    setPreferenceState(next);
    if (Platform.OS === "web") {
      try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* Keep the current preference when browser storage is unavailable. */ }
    } else void SecureStore.setItemAsync(STORAGE_KEY, next).catch(() => undefined);
  };
  const value = useMemo(() => ({ preference, scale: scales[preference], setPreference }), [preference]);
  return <TextSizeContext.Provider value={value}>{children}</TextSizeContext.Provider>;
}

export function useTextSize() {
  const value = useContext(TextSizeContext);
  if (!value) throw new Error("useTextSize must be used inside TextSizeProvider");
  return value;
}
