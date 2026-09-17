import { Stack } from "expo-router";
import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";

export const unstable_settings = {
  anchor: "index",
};

export default function ManageLayout() {
  const { palette } = useAppearance();
  const { locale } = useLocalization();
  return <Stack screenOptions={{ contentStyle: { backgroundColor: palette.background }, headerBackButtonDisplayMode: "default", headerStyle: { backgroundColor: palette.background }, headerTintColor: palette.accent, headerTitleStyle: { color: palette.text }, headerShown: false }}>
    <Stack.Screen name="index" options={{ headerShown: false }} />
    <Stack.Screen name="account/[accountId]" options={{ headerShown: true, title: locale === "uk" ? "Обліковий запис" : "Account" }} />
    <Stack.Screen name="account/[accountId]/link" options={{ headerShown: true, title: locale === "uk" ? "Пов’язати учасника" : "Link member" }} />
    <Stack.Screen name="account/[accountId]/delete" options={{ headerShown: true, title: locale === "uk" ? "Видалити обліковий запис" : "Delete account" }} />
    <Stack.Screen name="groups" options={{ headerShown: true, title: locale === "uk" ? "Групи" : "Groups" }} />
    <Stack.Screen name="group/[groupId]" options={{ headerShown: true, title: locale === "uk" ? "Редагувати групу" : "Edit group" }} />
    <Stack.Screen name="ministries" options={{ headerShown: true, title: locale === "uk" ? "Служіння" : "Ministries" }} />
    <Stack.Screen name="ministry/new" options={{ headerShown: true, title: locale === "uk" ? "Нове служіння" : "New ministry" }} />
    <Stack.Screen name="ministry/[ministryId]" options={{ headerShown: true, title: locale === "uk" ? "Редагувати служіння" : "Edit ministry" }} />
  </Stack>;
}
