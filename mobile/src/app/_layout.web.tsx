import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname } from "expo-router";
import { useEffect } from "react";
import { AppearanceProvider, useAppearance } from "@/features/appearance/AppearanceProvider";
import { LocalizationProvider } from "@/features/localization/LocalizationProvider";
import { TextSizeProvider } from "@/features/accessibility/TextSizeProvider";
import { SessionProvider } from "@/features/session/SessionProvider";
import { AccessGate } from "@/features/session/AccessGate";
import { recoverRootOAuthCallback } from "@/features/session/web-oauth";
import { WebAppShell } from "@/features/shell/WebAppShell.web";
import "./global.css";

function WebNavigation() {
  const { palette, resolved } = useAppearance();
  const pathname = usePathname();
  const recoveredCallback = recoverRootOAuthCallback(window.location.href);
  useEffect(() => {
    if (recoveredCallback) window.location.replace(recoveredCallback);
  }, [recoveredCallback]);
  if (recoveredCallback) return null;
  const base = resolved === "dark" ? DarkTheme : DefaultTheme;
  const theme = { ...base, colors: { ...base.colors, background: palette.background, border: palette.line, card: palette.chrome, notification: palette.accent, primary: palette.accent, text: palette.text } };
  const routes = <Stack screenOptions={{ contentStyle: { backgroundColor: palette.background }, headerShown: false, animation: "none" }} />;
  return <ThemeProvider value={theme}>{pathname === "/auth/callback" ? routes : <AccessGate><WebAppShell>{routes}</WebAppShell></AccessGate>}</ThemeProvider>;
}

export default function RootLayout() {
  return <LocalizationProvider><SessionProvider><AppearanceProvider><TextSizeProvider><WebNavigation /></TextSizeProvider></AppearanceProvider></SessionProvider></LocalizationProvider>;
}
