import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { Text } from "@/features/accessibility/app-text";
import { Alert } from "@/features/platform/alert";
import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { saveMemberContact } from "./save-contact";
import { getMemberCopy } from "./member-copy";
import type { MemberProfile } from "./member-repository";

export type SaveContactButtonProps = { profile: MemberProfile; name: string };

export function SaveContactButton({ profile, name }: SaveContactButtonProps) {
  const { palette } = useAppearance();
  const { locale } = useLocalization();
  const copy = getMemberCopy(locale);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      await saveMemberContact(profile, name);
    } catch {
      Alert.alert(copy.saveContactError, copy.saveContactUnavailable);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={copy.saveContact} accessibilityState={{ disabled: busy, busy }}
      disabled={busy} onPress={() => void save()}
      style={[styles.button, { backgroundColor: palette.accentSoft, opacity: busy ? 0.6 : 1 }]}>
      {busy ? <ActivityIndicator color={palette.accent} size="small" />
        : <Ionicons accessibilityElementsHidden importantForAccessibility="no" color={palette.accent} name="person-add-outline" size={23} />}
      <Text style={[styles.label, { color: palette.accent }]}>{copy.saveContact}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: "center", borderRadius: 12, flexGrow: 1, gap: 5,
    justifyContent: "center", minHeight: 62, minWidth: 150, padding: 10 },
  label: { fontSize: 13, fontWeight: "800", textAlign: "center" },
});
