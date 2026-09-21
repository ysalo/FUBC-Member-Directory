import { Stack } from "expo-router";
import { useAppearance } from "@/features/appearance/AppearanceProvider";

export default function ScheduleLayout() {
  const { palette } = useAppearance();
  return <Stack screenOptions={{ contentStyle: { backgroundColor: palette.background }, headerShown: false }} />;
}
