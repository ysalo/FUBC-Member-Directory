import { Stack } from "expo-router";
import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";

export default function ManageLayout() {
  const { palette } = useAppearance();
  const { locale } = useLocalization();
  return <Stack screenOptions={{ contentStyle: { backgroundColor: palette.background }, headerBackButtonDisplayMode: "generic", headerStyle: { backgroundColor: palette.background }, headerTintColor: palette.accent, headerTitleStyle: { color: palette.text }, headerShown: false }}>
    <Stack.Screen name="account/[accountId]" options={{ headerShown: true, title: locale === "uk" ? "Обліковий запис" : "Account" }} />
    <Stack.Screen name="account/[accountId]/link" options={{ headerShown: true, title: locale === "uk" ? "Пов’язати учасника" : "Link member" }} />
    <Stack.Screen name="groups" options={{ headerShown: true, title: locale === "uk" ? "Групи" : "Groups" }} />
    <Stack.Screen name="group/[groupId]" options={{ headerShown: true, title: locale === "uk" ? "Редагувати групу" : "Edit group" }} />
  </Stack>;
}
