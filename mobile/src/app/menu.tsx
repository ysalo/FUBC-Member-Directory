import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";

import { type AppearancePreference, useAppearance } from "@/features/appearance/AppearanceProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { memberProfileRepository, type MemberProfile } from "@/features/members/member-repository";
import { ProfileAvatar } from "@/features/members/ProfileAvatar";
import { useSession } from "@/features/session/SessionProvider";
import { WebTabBar } from "@/features/shell/WebTabBar";
import { signOut } from "@/lib/session";
import { isBackendConfigured } from "@/lib/supabase";

const accountCopy = {
  en: { account: "Account", linkedMember: "View member profile", signOut: "Sign out", signingOut: "Signing out…", signOutError: "Unable to sign out. Please try again.", advanced: "Advanced", advancedDetail: "Permanent account actions", delete: "Delete account" },
  uk: { account: "Обліковий запис", linkedMember: "Переглянути профіль учасника", signOut: "Вийти", signingOut: "Вихід…", signOutError: "Не вдалося вийти. Спробуйте ще раз.", advanced: "Додатково", advancedDetail: "Незворотні дії з обліковим записом", delete: "Видалити обліковий запис" },
} as const;

export default function MenuRoute() {
  const { copy, locale, setLocale } = useLocalization();
  const router = useRouter();
  const session = useSession();
  const { palette, preference, setPreference } = useAppearance();
  const labels = accountCopy[locale];
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [linkedMember, setLinkedMember] = useState<MemberProfile | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useFocusEffect(useCallback(() => {
    if (session.status !== "ready" || !session.account.personId) {
      setLinkedMember(null);
      return;
    }
    let active = true;
    setLinkedMember(null);
    void memberProfileRepository.getProfile(session.account.personId)
      .then((profile) => { if (active) setLinkedMember(profile); })
      .catch(() => { if (active) setLinkedMember(null); });
    return () => { active = false; };
  }, [session]));

  const submitSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      Alert.alert(labels.signOut, labels.signOutError);
      setSigningOut(false);
    }
  };

  return (
    <View style={[styles.safe, { backgroundColor: palette.background }]}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" selectable style={[styles.title, { color: palette.text }]}>{copy.menu.title}</Text>
        <View style={[styles.card, { backgroundColor: palette.surface }]}>
          <View style={styles.row}>
            <Ionicons color={palette.secondaryText} name="language-outline" size={24} />
            <Text style={[styles.rowLabel, { color: palette.text }]}>{copy.menu.language}</Text>
            <View accessibilityRole="tablist" style={[styles.languagePicker, { backgroundColor: palette.subtle }]}>
              <Pressable accessibilityRole="tab" accessibilityState={{ selected: locale === "en" }} onPress={() => setLocale("en")} style={[styles.languageOption, locale === "en" && { backgroundColor: palette.elevated }]}>
                <Text style={[styles.languageText, { color: locale === "en" ? palette.accent : palette.secondaryText }]}>EN</Text>
              </Pressable>
              <Pressable accessibilityRole="tab" accessibilityState={{ selected: locale === "uk" }} onPress={() => setLocale("uk")} style={[styles.languageOption, locale === "uk" && { backgroundColor: palette.elevated }]}>
                <Text style={[styles.languageText, { color: locale === "uk" ? palette.accent : palette.secondaryText }]}>UA</Text>
              </Pressable>
            </View>
          </View>

          <View style={[styles.separator, { backgroundColor: palette.line }]} />

          <View style={styles.appearanceRow}>
            <View style={styles.appearanceHeading}><Ionicons color={palette.secondaryText} name="contrast-outline" size={24} /><Text style={[styles.rowLabel, { color: palette.text }]}>{copy.menu.appearance}</Text></View>
            <View accessibilityRole="tablist" style={[styles.appearancePicker, { backgroundColor: palette.subtle }]}>
              {(["system", "light", "dark"] as AppearancePreference[]).map((option) => <Pressable accessibilityRole="tab" accessibilityState={{ selected: preference === option }} key={option} onPress={() => setPreference(option)} style={[styles.appearanceOption, preference === option && { backgroundColor: palette.elevated }]}><Text style={[styles.appearanceText, { color: preference === option ? palette.accent : palette.secondaryText }]}>{copy.menu[option]}</Text></Pressable>)}
            </View>
          </View>
        </View>

        {isBackendConfigured && session.status === "ready" ? <View style={[styles.accountCard, { backgroundColor: palette.surface }]}>
          <Text style={[styles.sectionLabel, { color: palette.secondaryText }]}>{labels.account}</Text>
          <Pressable
            accessibilityHint={linkedMember ? labels.linkedMember : undefined}
            accessibilityRole={linkedMember ? "button" : undefined}
            disabled={!linkedMember}
            onPress={() => linkedMember && router.push(`/members/${linkedMember.id}` as never)}
            style={({ pressed }) => [styles.accountIdentity, pressed && styles.pressed]}
          >
            <ProfileAvatar backgroundColor={palette.accentSoft} name={linkedMember ? (locale === "uk" ? linkedMember.nameUk : linkedMember.name) : session.account.displayName} source={linkedMember?.photo} textColor={palette.accent} size={58} />
            <View style={styles.identityCopy}>
              <Text selectable style={[styles.accountTitle, { color: palette.text }]}>{linkedMember ? (locale === "uk" ? linkedMember.nameUk : linkedMember.name) : session.account.displayName}</Text>
              {linkedMember ? <View style={styles.linkedRow}><Text style={[styles.accountName, { color: palette.accent }]}>{labels.linkedMember}</Text><Ionicons color={palette.accent} name="chevron-forward" size={16} /></View> : null}
            </View>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ busy: signingOut, disabled: signingOut }} disabled={signingOut} onPress={() => void submitSignOut()} style={({ pressed }) => [styles.accountAction, { borderTopColor: palette.line }, pressed && styles.pressed]}>{signingOut ? <ActivityIndicator color={palette.danger} size="small" /> : <Ionicons color={palette.danger} name="log-out-outline" size={20} />}<Text style={[styles.accountActionText, { color: palette.danger }]}>{signingOut ? labels.signingOut : labels.signOut}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: advancedOpen }} onPress={() => setAdvancedOpen((open) => !open)} style={[styles.accountAction, { borderTopColor: palette.line }]}><Ionicons color={palette.secondaryText} name="settings-outline" size={20} /><View style={styles.advancedCopy}><Text style={[styles.accountActionText, { color: palette.text }]}>{labels.advanced}</Text><Text selectable style={[styles.advancedDetail, { color: palette.secondaryText }]}>{labels.advancedDetail}</Text></View><Ionicons color={palette.secondaryText} name={advancedOpen ? "chevron-up" : "chevron-down"} size={18} /></Pressable>
          {advancedOpen ? <Pressable accessibilityRole="button" onPress={() => router.push("/account/delete" as never)} style={[styles.deleteAction, { borderTopColor: palette.line }]}><Ionicons color={palette.danger} name="trash-outline" size={20} /><Text style={[styles.deleteText, { color: palette.danger }]}>{labels.delete}</Text></Pressable> : null}
        </View> : null}

        <View style={[styles.licenseCard, { backgroundColor: palette.surface }]}>
          <View style={styles.licenseHeading}>
            <Ionicons color={palette.secondaryText} name="document-text-outline" size={24} />
            <Text style={[styles.licenseTitle, { color: palette.text }]}>{copy.menu.licenses}</Text>
          </View>
          <Text style={[styles.licenseDetail, { color: palette.secondaryText }]}>{copy.menu.licenseDetail}</Text>
          <Text style={[styles.copyright, { color: palette.secondaryText }]}>© 2015–present Ionic · © 2015 Joel Arvidsson</Text>
        </View>
      </ScrollView>
      <WebTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: "#F1F0EB", flex: 1 },
  content: { paddingBottom: 100, paddingHorizontal: 20, paddingTop: 28 },
  title: { color: "#292D31", fontSize: 46, fontWeight: "800", letterSpacing: -1.5 },
  card: { backgroundColor: "#FAF9F6", borderRadius: 16, marginTop: 24, overflow: "hidden" },
  row: { alignItems: "center", flexDirection: "row", minHeight: 64, paddingHorizontal: 16 },
  appearanceRow: { gap: 10, padding: 16 },
  appearanceHeading: { alignItems: "center", flexDirection: "row" },
  appearancePicker: { borderRadius: 11, flexDirection: "row", padding: 2 },
  appearanceOption: { alignItems: "center", borderRadius: 9, flex: 1, justifyContent: "center", minHeight: 36 },
  appearanceText: { fontSize: 13, fontWeight: "600" },
  rowLabel: { color: "#20252A", flex: 1, fontSize: 17, fontWeight: "600", marginLeft: 13 },
  rowValue: { color: "#6F7174", fontSize: 16 },
  separator: { backgroundColor: "#DFDCD5", height: StyleSheet.hairlineWidth, marginLeft: 53 },
  languagePicker: { backgroundColor: "#E1DED7", borderRadius: 10, flexDirection: "row", padding: 2 },
  languageOption: { alignItems: "center", borderRadius: 8, justifyContent: "center", minHeight: 32, width: 44 },
  languageText: { color: "#686B6E", fontSize: 14, fontWeight: "600" },
  languageTextActive: { color: "#EF5A24" },
  licenseCard: { backgroundColor: "#FAF9F6", borderRadius: 16, marginTop: 16, padding: 16 },
  licenseHeading: { alignItems: "center", flexDirection: "row" },
  licenseTitle: { color: "#20252A", fontSize: 17, fontWeight: "700", marginLeft: 13 },
  licenseDetail: { color: "#4F5357", fontSize: 16, marginTop: 16 },
  copyright: { color: "#797B7E", fontSize: 13, lineHeight: 18, marginTop: 7 },
  accountCard: { backgroundColor: "#FAF9F6", borderRadius: 16, marginTop: 16, padding: 16 },
  sectionLabel: { fontSize: 13, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },
  accountIdentity: { alignItems: "center", flexDirection: "row", gap: 13, minHeight: 74, paddingVertical: 8 },
  identityCopy: { flex: 1, gap: 5 },
  accountTitle: { color: "#20252A", fontSize: 18, fontWeight: "700" },
  accountName: { color: "#6F7174", fontSize: 14, fontWeight: "600" },
  linkedRow: { alignItems: "center", flexDirection: "row", gap: 2 },
  accountAction: { alignItems: "center", borderTopColor: "#DFDCD5", borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 10, minHeight: 50, paddingTop: 6 },
  accountActionText: { color: "#34383D", fontSize: 15, fontWeight: "600" },
  advancedCopy: { flex: 1, gap: 2 },
  advancedDetail: { fontSize: 13 },
  deleteAction: { alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 10, marginTop: 14, minHeight: 44, paddingTop: 10 },
  deleteText: { color: "#A13E34", fontSize: 15, fontWeight: "600" },
  pressed: { opacity: 0.68 },
});
