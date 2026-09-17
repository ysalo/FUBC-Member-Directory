import { Ionicons, type IoniconsIconName } from "@react-native-vector-icons/ionicons";
import { usePathname, useRouter } from "expo-router";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { useSession } from "@/features/session/SessionProvider";
import { canManageDirectory } from "@/lib/permissions";

const tabs = [
  { labelKey: "groups", path: "/groups", icon: "people-circle", outlineIcon: "people-circle-outline" },
  { labelKey: "visitation", path: "/visitation", icon: "calendar", outlineIcon: "calendar-outline" },
  { labelKey: "directory", path: "/", href: "/(directory)", icon: "list", outlineIcon: "list-outline" },
  { labelKey: "manage", path: "/manage", icon: "settings", outlineIcon: "settings-outline" },
  { labelKey: "menu", path: "/menu", icon: "menu", outlineIcon: "menu-outline" },
] as const;

function TabIcon({ active, filled, outline, activeColor, inactive }: { active: boolean; filled: IoniconsIconName; outline: IoniconsIconName; activeColor: string; inactive: string }) {
  const color = active ? activeColor : inactive;
  return <Ionicons color={color} name={active ? filled : outline} size={px(28)} />;
}

export function WebTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { copy } = useLocalization();
  const { palette } = useAppearance();
  const session = useSession();
  const visibleTabs = tabs.filter((tab) => tab.labelKey !== "manage" || (session.status === "ready" && canManageDirectory(session.account)));
  if (Platform.OS === "ios") return null;

  return (
    <View style={[styles.bar, { backgroundColor: palette.chrome, borderTopColor: palette.line }]} accessibilityRole="tablist">
      {visibleTabs.map((tab) => {
        const active = tab.path === "/" ? pathname === "/" || pathname.startsWith("/members/") : pathname === tab.path || pathname.startsWith(`${tab.path}/`);
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            key={tab.path}
            onPress={() => router.replace(("href" in tab ? tab.href : tab.path) as never)}
            style={styles.tab}
          >
            <TabIcon active={active} activeColor={palette.accent} filled={tab.icon} inactive={palette.secondaryText} outline={tab.outlineIcon} />
            <Text numberOfLines={1} style={[styles.tabLabel, { color: active ? palette.accent : palette.secondaryText }]}>{copy.tabs[tab.labelKey]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const scale = 1;
const px = (value: number) => value * scale;

const styles = StyleSheet.create({
  bar: { backgroundColor: "rgba(250,249,246,0.97)", borderTopColor: "#C9C6BF", borderTopWidth: StyleSheet.hairlineWidth, bottom: 0, flexDirection: "row", minHeight: px(66), paddingBottom: px(4), paddingTop: px(4), position: "absolute", width: "100%" },
  tab: { alignItems: "center", flex: 1, gap: px(5), justifyContent: "center", minWidth: px(52) },
  tabLabel: { color: "#6F7073", fontSize: px(13), fontWeight: "600" },
  activeLabel: { color: "#EF5A24" },
});
