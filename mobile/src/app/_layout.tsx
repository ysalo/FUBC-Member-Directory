import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { StatusBar } from "expo-status-bar";
import { Platform, View } from "react-native";

import { LocalizationProvider, useLocalization } from "@/features/localization/LocalizationProvider";
import { AccessGate } from "@/features/session/AccessGate";
import { SessionProvider } from "@/features/session/SessionProvider";
import { AppearanceProvider, useAppearance } from "@/features/appearance/AppearanceProvider";
import { useSession } from "@/features/session/SessionProvider";
import { canManageDirectory } from "@/lib/permissions";

import "./global.css";

const accent = "#EF5A24";

function IosTabs() {
  const { copy } = useLocalization();
  const { palette, preference, resolved } = useAppearance();
  const session = useSession();
  const showManage = session.status === "ready" && canManageDirectory(session.account);
  return (
    <NativeTabs
      tintColor={accent}
      iconColor={{ default: palette.secondaryText, selected: accent }}
      labelStyle={{ default: { color: palette.secondaryText, fontSize: 10 }, selected: { color: accent, fontSize: 10 } }}
      backgroundColor={palette.chrome}
      blurEffect={preference === "system" ? "systemMaterial" : resolved === "dark" ? "systemMaterialDark" : "systemMaterialLight"}
      disableTransparentOnScrollEdge
      minimizeBehavior="never"
    >
      <NativeTabs.Trigger name="groups">
        <NativeTabs.Trigger.Icon sf={{ default: "person.3", selected: "person.3.fill" }} />
        <NativeTabs.Trigger.Label>{copy.tabs.groups}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="visitation">
        <NativeTabs.Trigger.Icon sf={{ default: "calendar", selected: "calendar.badge.checkmark" }} />
        <NativeTabs.Trigger.Label>{copy.tabs.visitation}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(directory)">
        <NativeTabs.Trigger.Icon sf={{ default: "person.text.rectangle", selected: "person.text.rectangle.fill" }} />
        <NativeTabs.Trigger.Label>{copy.tabs.directory}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      {showManage ? <NativeTabs.Trigger name="manage">
        <NativeTabs.Trigger.Icon sf={{ default: "gearshape", selected: "gearshape.fill" }} />
        <NativeTabs.Trigger.Label>{copy.tabs.manage}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger> : null}
      <NativeTabs.Trigger name="menu">
        <NativeTabs.Trigger.Icon sf="line.3.horizontal" />
        <NativeTabs.Trigger.Label>{copy.tabs.menu}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function AppNavigation() {
  const { palette, preference, resolved } = useAppearance();
  const baseTheme = resolved === "dark" ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      background: palette.background,
      border: palette.line,
      card: palette.chrome,
      notification: palette.accent,
      primary: palette.accent,
      text: palette.text,
    },
  };
  return (
    <ThemeProvider value={navigationTheme}>
      <View style={{ backgroundColor: palette.background, flex: 1 }}>
        <StatusBar style={preference === "system" ? "auto" : resolved === "dark" ? "light" : "dark"} />
        {Platform.OS === "ios" ? <IosTabs /> : <Stack screenOptions={{ contentStyle: { backgroundColor: palette.background }, headerShown: false }} />}
      </View>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return <LocalizationProvider><SessionProvider><AppearanceProvider><AccessGate><AppNavigation /></AccessGate></AppearanceProvider></SessionProvider></LocalizationProvider>;
}
