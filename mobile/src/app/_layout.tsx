import { Text } from "@/features/accessibility/app-text";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { StatusBar } from "expo-status-bar";
import { Platform, View } from "react-native";

import { LocalizationProvider, useLocalization } from "@/features/localization/LocalizationProvider";
import { AccessGate } from "@/features/session/AccessGate";
import { SessionProvider } from "@/features/session/SessionProvider";
import { AppearanceProvider, useAppearance } from "@/features/appearance/AppearanceProvider";
import { useSession } from "@/features/session/SessionProvider";
import { useActiveVisitationCount } from "@/features/visitation/use-active-visitation-count";
import { canManageDirectory } from "@/lib/permissions";
import { TextSizeProvider, useTextSize } from "@/features/accessibility/TextSizeProvider";

import "./global.css";

const accent = "#EF5A24";

function IosTabs() {
  const { copy } = useLocalization();
  const { palette, preference, resolved } = useAppearance();
  const session = useSession();
  const showManage = session.status === "ready" && canManageDirectory(session.account);
  const activeVisitationCount = useActiveVisitationCount();
  const { scale } = useTextSize();
  return (
    <NativeTabs
      tintColor={accent}
      badgeBackgroundColor="#EF5A24B8"
      iconColor={{ default: palette.secondaryText, selected: accent }}
      labelStyle={{ default: { color: palette.secondaryText, fontSize: 10 * scale }, selected: { color: accent, fontSize: 10 * scale } }}
      backgroundColor={palette.chrome}
      blurEffect={preference === "system" ? "systemMaterial" : resolved === "dark" ? "systemMaterialDark" : "systemMaterialLight"}
      disableTransparentOnScrollEdge
      minimizeBehavior="never"
    >
      <NativeTabs.Trigger name="(directory)">
        <NativeTabs.Trigger.Icon sf={{ default: "person.text.rectangle", selected: "person.text.rectangle.fill" }} />
        <NativeTabs.Trigger.Label>{copy.tabs.directory}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="groups">
        <NativeTabs.Trigger.Icon sf={{ default: "person.3", selected: "person.3.fill" }} />
        <NativeTabs.Trigger.Label>{copy.tabs.groups}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="visitation">
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} />
        <NativeTabs.Trigger.Label>{copy.tabs.visitation}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Badge hidden={activeVisitationCount === 0}>{String(activeVisitationCount)}</NativeTabs.Trigger.Badge>
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
        <StatusBar style={resolved === "dark" ? "light" : "dark"} />
        {Platform.OS === "ios" ? <IosTabs /> : <Stack screenOptions={{ contentStyle: { backgroundColor: palette.background }, headerShown: false }} />}
      </View>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return <LocalizationProvider><SessionProvider><AppearanceProvider><TextSizeProvider><AccessGate><AppNavigation /></AccessGate></TextSizeProvider></AppearanceProvider></SessionProvider></LocalizationProvider>;
}
