import { Redirect, Stack } from "expo-router";

import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { useSession } from "@/features/session/SessionProvider";
import { canCreateVisit } from "@/lib/permissions";
import { isBackendConfigured } from "@/lib/supabase";

export default function VisitationLayout() {
  const { palette } = useAppearance();
  const session = useSession();
  if (isBackendConfigured && !canCreateVisit(session.status === "ready" ? session.account : null)) return <Redirect href="/" />;
  return <Stack screenOptions={{ contentStyle: { backgroundColor: palette.background }, headerShown: false }} />;
}
