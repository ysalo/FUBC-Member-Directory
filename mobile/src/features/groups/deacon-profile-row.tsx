import { Text } from "@/features/accessibility/app-text";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Pressable, StyleSheet, View } from "react-native";

import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { ProfileAvatar } from "@/features/members/ProfileAvatar";
import type { GroupMember } from "./groups-repository";

type DeaconProfileRowProps = {
  accessibilityHint: string;
  deacon: Pick<GroupMember, "id" | "name" | "photo">;
  roleLabel: string;
  onPress: () => void;
  last?: boolean;
};

export function DeaconProfileRow({ accessibilityHint, deacon, roleLabel, last = false, onPress }: DeaconProfileRowProps) {
  const { palette } = useAppearance();

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={`${deacon.name}, ${roleLabel}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !last && { borderBottomColor: palette.line, borderBottomWidth: StyleSheet.hairlineWidth },
        pressed && styles.pressed,
      ]}
    >
      <ProfileAvatar name={deacon.name} source={deacon.photo} size={42} />
      <View style={styles.copy}>
        <Text numberOfLines={2} selectable style={[styles.name, { color: palette.text }]}>{deacon.name}</Text>
        <Text selectable style={[styles.label, { color: palette.secondaryText }]}>{roleLabel}</Text>
      </View>
      <Ionicons accessibilityElementsHidden color={palette.secondaryText} name="chevron-forward" size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: "center", flexDirection: "row", gap: 11, minHeight: 62, paddingHorizontal: 14, paddingVertical: 9 },
  copy: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, fontWeight: "700", lineHeight: 21 },
  label: { fontSize: 13, lineHeight: 18, marginTop: 1 },
  pressed: { opacity: 0.65 },
});
