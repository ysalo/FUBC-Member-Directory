import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";
import { Appearance, DynamicColorIOS, Platform } from "react-native";

import { useSession } from "@/features/session/SessionProvider";
import { isBackendConfigured, requireSupabase } from "@/lib/supabase";

export type AppearancePreference = "system" | "light" | "dark";
export type AppPalette = {
  background: string;
  surface: string;
  elevated: string;
  subtle: string;
  line: string;
  text: string;
  secondaryText: string;
  chrome: string;
  accent: string;
  accentSoft: string;
  danger: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
  warningSoft: string;
};

const palettes: Record<"light" | "dark", AppPalette> = {
  light: { background: "#F1F0EB", surface: "#FAF9F6", elevated: "#FFFFFF", subtle: "#E2DFD9", line: "#D8D5CE", text: "#171B20", secondaryText: "#686B70", chrome: "rgba(250,249,246,0.98)", accent: "#8A6418", accentSoft: "#F4E8C8", danger: "#B42318", dangerSoft: "#FCE8E6", success: "#237A46", successSoft: "#DDEFE2", warningSoft: "#FFF0C9" },
  dark: { background: "#111315", surface: "#1A1D20", elevated: "#22262A", subtle: "#292D31", line: "#34383D", text: "#F4F1EA", secondaryText: "#B2B4B7", chrome: "rgba(26,29,32,0.98)", accent: "#E8C878", accentSoft: "#3B321F", danger: "#FF8B82", dangerSoft: "#492422", success: "#74C88D", successSoft: "#1E3A29", warningSoft: "#493B1D" },
};

const systemPalette: AppPalette = Object.fromEntries(
  Object.keys(palettes.light).map((key) => {
    const token = key as keyof AppPalette;
    const value = Platform.OS === "ios"
      ? DynamicColorIOS({ light: palettes.light[token], dark: palettes.dark[token] }) as unknown as string
      : palettes.light[token];
    return [token, value];
  }),
) as AppPalette;

type AppearanceValue = {
  preference: AppearancePreference;
  resolved: "light" | "dark";
  palette: AppPalette;
  setPreference: (preference: AppearancePreference) => void;
};

const AppearanceContext = createContext<AppearanceValue | null>(null);

export function AppearanceProvider({ children }: PropsWithChildren) {
  const session = useSession();
  const [systemScheme, setSystemScheme] = useState<"light" | "dark">(() => Appearance.getColorScheme() === "dark" ? "dark" : "light");
  const [preference, setPreferenceState] = useState<AppearancePreference>("system");
  const resolved = preference === "system" ? (systemScheme === "dark" ? "dark" : "light") : preference;
  // On iOS the native trait collection is the authoritative source for
  // "System". This keeps every authenticated screen aligned even when
  // Expo Go reports a stale/null JS color scheme during a theme transition.
  const palette = preference === "system" && Platform.OS === "ios" ? systemPalette : palettes[resolved];

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => setSystemScheme(colorScheme === "dark" ? "dark" : "light"));
    setSystemScheme(Appearance.getColorScheme() === "dark" ? "dark" : "light");
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!isBackendConfigured || session.status !== "ready") return;
    let current = true;
    void requireSupabase().from("preferences").select("appearance").eq("account_id", session.account.id).maybeSingle().then(({ data }) => {
      if (current && data?.appearance) setPreferenceState(data.appearance);
    });
    return () => { current = false; };
  }, [session]);

  useEffect(() => {
    if (Platform.OS !== "web" && typeof Appearance.setColorScheme === "function") {
      (Appearance.setColorScheme as unknown as (scheme: "light" | "dark" | null) => void)(preference === "system" ? null : preference);
    }
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.documentElement.style.colorScheme = resolved;
      Object.entries(palette).forEach(([token, value]) => document.documentElement.style.setProperty(`--app-${token}`, String(value)));
    }
  }, [palette, preference, resolved]);

  const setPreference = (next: AppearancePreference) => {
    setPreferenceState(next);
    if (isBackendConfigured && session.status === "ready") {
      void requireSupabase().from("preferences").upsert({ account_id: session.account.id, appearance: next }, { onConflict: "account_id" });
    }
  };
  const value = useMemo(() => ({ preference, resolved, palette, setPreference }), [palette, preference, resolved]);
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error("useAppearance must be used inside AppearanceProvider");
  return value;
}
