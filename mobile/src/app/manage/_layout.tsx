import { Redirect, Stack, usePathname } from "expo-router";
import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { useTextSize } from "@/features/accessibility/TextSizeProvider";
import { useSession } from "@/features/session/SessionProvider";
import { canManageAccounts, canManageDirectory, canManageGroups, canManageSettings } from "@/lib/permissions";
import { isBackendConfigured } from "@/lib/supabase";

export const unstable_settings = {
  anchor: "index",
};

export default function ManageLayout() {
  const { palette } = useAppearance();
  const { locale } = useLocalization();
  const { scale } = useTextSize();
  const session = useSession();
  const pathname = usePathname();
  const actor = session.status === "ready" ? session.account : null;
  const memberRoute = pathname === "/manage" || /^\/manage\/member\/[^/]+\/?$/.test(pathname);
  const groupRoute = pathname === "/manage/groups" || /^\/manage\/group\/[^/]+\/?$/.test(pathname);
  const settingsRoute = pathname === "/manage/schedule" || pathname === "/manage/ministries" || /^\/manage\/ministry\/[^/]+\/?$/.test(pathname);
  if (isBackendConfigured && !(memberRoute ? canManageDirectory(actor) : groupRoute ? canManageGroups(actor) : settingsRoute ? canManageSettings(actor) : canManageAccounts(actor))) return <Redirect href="/" />;
  return <Stack screenOptions={{ contentStyle: { backgroundColor: palette.background }, headerBackButtonDisplayMode: "minimal", headerStyle: { backgroundColor: palette.background }, headerTintColor: palette.accent, headerTitleStyle: { color: palette.text, fontSize: 17 * scale }, headerShown: false }}>
    <Stack.Screen name="index" options={{ headerShown: false }} />
    <Stack.Screen name="account/[accountId]" options={{ headerShown: true, title: locale === "uk" ? "Обліковий запис" : "Account" }} />
    <Stack.Screen name="account/[accountId]/link" options={{ headerShown: true, title: locale === "uk" ? "Пов’язати учасника" : "Link member" }} />
    <Stack.Screen name="account/[accountId]/delete" options={{ headerShown: true, title: locale === "uk" ? "Видалити обліковий запис" : "Delete account" }} />
    <Stack.Screen name="member/[memberId]/delete" options={{ headerShown: true, title: locale === "uk" ? "Видалити учасника" : "Delete member" }} />
    <Stack.Screen name="groups" options={{ headerShown: true, title: locale === "uk" ? "Групи" : "Groups" }} />
    <Stack.Screen name="group/new" options={{ headerShown: true, title: locale === "uk" ? "Нова група" : "New group" }} />
    <Stack.Screen name="group/[groupId]" options={{ headerShown: true, title: locale === "uk" ? "Редагувати групу" : "Edit group" }} />
    <Stack.Screen name="ministries" options={{ headerShown: true, title: locale === "uk" ? "Служіння" : "Ministries" }} />
    <Stack.Screen name="ministry/new" options={{ headerShown: true, title: locale === "uk" ? "Нове служіння" : "New ministry" }} />
    <Stack.Screen name="ministry/[ministryId]" options={{ headerShown: true, title: locale === "uk" ? "Редагувати служіння" : "Edit ministry" }} />
    <Stack.Screen name="schedule" options={{ headerShown: true, title: locale === "uk" ? "Розклад" : "Schedule" }} />
  </Stack>;
}
