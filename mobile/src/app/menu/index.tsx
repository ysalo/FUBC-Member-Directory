import { PreferenceChoices } from "@/features/menu/PreferenceChoices";
import { AboutLink } from "@/features/menu/AboutLink";
import { AboutContent } from "@/features/menu/AboutContent";
import { menuCopy } from "@/features/menu/menu-copy";
import { AboutDialog } from "@/features/menu/AboutDialog";
import { useDesktopLayout } from "@/features/shell/use-desktop-layout";
import { InstallHelp } from "@/features/shell/InstallHelp";
import { Alert } from "@/features/platform/alert";
import { Text } from "@/features/accessibility/app-text";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Constants from "expo-constants";
import { useFocusEffect, useRouter } from "expo-router";

import { type AppearancePreference, useAppearance } from "@/features/appearance/AppearanceProvider";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { memberProfileRepository, type MemberProfile } from "@/features/members/member-repository";
import { ProfileAvatar } from "@/features/members/ProfileAvatar";
import { useSession } from "@/features/session/SessionProvider";
import { WebTabBar } from "@/features/shell/WebTabBar";
import { signOut } from "@/lib/session";
import { isBackendConfigured } from "@/lib/supabase";
import { type TextSizePreference, useTextSize } from "@/features/accessibility/TextSizeProvider";



export default function MenuRoute() {
  const desktop = useDesktopLayout();
  const { copy, locale, setLocale } = useLocalization();
  const router = useRouter();
  const session = useSession();
  const { palette, preference, setPreference } = useAppearance();
  const labels = menuCopy[locale];
  const { preference: textSize, setPreference: setTextSize } = useTextSize();
  const [aboutOpen, setAboutOpen] = useState(false);
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
    void memberProfileRepository.getProfile(session.account.personId, "avatar")
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
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[styles.content, desktop && styles.desktopContent]}>
        <Text accessibilityRole="header" selectable style={[styles.title, { color: palette.text }]}>{copy.menu.title}</Text>
        <View style={[styles.columns, desktop && styles.desktopColumns]}><View style={[styles.column, desktop && styles.preferencesColumn]}>
        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.line }]}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, {color: palette.text}]}>{labels.preferences}</Text>
          <Text style={[styles.sectionDetail, {color: palette.secondaryText}]}>{labels.preferencesDetail}</Text>
          <View style={styles.preferenceRow}>
            <Text style={[styles.settingLabel, {color: palette.text}]}>{copy.menu.language}</Text>
            <PreferenceChoices label={copy.menu.language} value={locale} options={[{value: "en", label: "English"}, {value: "uk", label: "Українська"}]} onChange={setLocale} />
          </View>
          <View style={[styles.preferenceRow, {borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line}]}>
            <Text style={[styles.settingLabel, {color: palette.text}]}>{copy.menu.appearance}</Text>
            <PreferenceChoices label={copy.menu.appearance} value={preference} options={(["system", "light", "dark"] as AppearancePreference[]).map(value => ({value, label: copy.menu[value], icon: value === "system" ? "contrast-outline" as const : value === "light" ? "sunny-outline" as const : "moon-outline" as const}))} onChange={setPreference} />
          </View>
          <View style={[styles.preferenceRow, {borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line}]}>
            <Text style={[styles.settingLabel, {color: palette.text}]}>{labels.textSize}</Text>
            <PreferenceChoices label={labels.textSize} value={textSize} options={(["small", "standard", "large"] as TextSizePreference[]).map(value => ({value, label: labels[value], sampleSize: value === "small" ? 13 : value === "standard" ? 17 : 22}))} onChange={setTextSize} />
          </View>
        </View>
        </View><View style={[styles.column, desktop && styles.accountColumn]}>
        {isBackendConfigured && session.status === "ready" ? <View style={[styles.accountCard, { backgroundColor: palette.surface }]}>
          <Text style={[styles.sectionLabel, { color: palette.secondaryText }]}>{labels.account}</Text>
          <Pressable
            accessibilityHint={linkedMember ? labels.linkedMember : undefined}
            accessibilityRole={linkedMember ? "button" : undefined}
            disabled={!linkedMember}
            onPress={() => linkedMember && router.push(`/members/${linkedMember.id}` as never)}
            style={({ pressed }) => [styles.accountIdentity, pressed && styles.pressed]}
          >
            <ProfileAvatar name={linkedMember ? (locale === "uk" ? linkedMember.nameUk : linkedMember.name) : session.account.displayName} source={linkedMember?.photo} size={58} />
            <View style={styles.identityCopy}>
              <Text style={[styles.accountTitle, { color: palette.text }]}>{linkedMember ? (locale === "uk" ? linkedMember.nameUk : linkedMember.name) : session.account.displayName}</Text>
              {linkedMember ? <View style={styles.linkedRow}><Text style={[styles.accountName, { color: palette.accent }]}>{labels.linkedMember}</Text><Ionicons aria-hidden accessibilityElementsHidden color={palette.accent} name="chevron-forward" size={16} /></View> : null}
            </View>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ busy: signingOut, disabled: signingOut }} disabled={signingOut} onPress={() => void submitSignOut()} style={({ pressed }) => [styles.accountAction, { borderTopColor: palette.line }, pressed && styles.pressed]}>{signingOut ? <ActivityIndicator color={palette.danger} size="small" /> : <Ionicons aria-hidden accessibilityElementsHidden color={palette.danger} name="log-out-outline" size={20} />}<Text style={[styles.accountActionText, { color: palette.danger }]}>{signingOut ? labels.signingOut : labels.signOut}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: advancedOpen }} onPress={() => setAdvancedOpen((open) => !open)} style={[styles.accountAction, { borderTopColor: palette.line }]}><Ionicons aria-hidden accessibilityElementsHidden color={palette.secondaryText} name="settings-outline" size={20} /><View style={styles.advancedCopy}><Text style={[styles.accountActionText, { color: palette.text }]}>{labels.advanced}</Text><Text selectable style={[styles.advancedDetail, { color: palette.secondaryText }]}>{labels.advancedDetail}</Text></View><Ionicons aria-hidden accessibilityElementsHidden color={palette.secondaryText} name={advancedOpen ? "chevron-up" : "chevron-down"} size={18} /></Pressable>
          {advancedOpen ? <Pressable accessibilityRole="button" onPress={() => router.push("/account/delete" as never)} style={[styles.deleteAction, { borderTopColor: palette.line }]}><Ionicons aria-hidden accessibilityElementsHidden color={palette.danger} name="trash-outline" size={20} /><Text style={[styles.deleteText, { color: palette.danger }]}>{labels.delete}</Text></Pressable> : null}
        </View> : null}

        <View style={[styles.aboutCard, { backgroundColor: palette.surface }]}>
          <AboutLink label={labels.about} onOpen={() => setAboutOpen(true)} style={({ pressed }) => [styles.aboutRow, pressed && styles.pressed]}>
            <Ionicons aria-hidden accessibilityElementsHidden color={palette.secondaryText} name="information-circle-outline" size={24} />
            <View style={styles.aboutLinkCopy}><Text style={[styles.aboutLinkTitle, {color: palette.text}]}>{labels.about}</Text><Text style={[styles.advancedDetail, {color: palette.secondaryText}]}>{labels.version} {Constants.expoConfig?.version ?? labels.unavailable}</Text></View>
            <Ionicons aria-hidden accessibilityElementsHidden color={palette.secondaryText} name="chevron-forward" size={20} />
          </AboutLink>
        </View>
        <InstallHelp />
        </View></View>
      </ScrollView>
      <WebTabBar />
      <AboutDialog open={aboutOpen} label={labels.about} onClose={() => setAboutOpen(false)}>
        <AboutContent onClose={() => setAboutOpen(false)} />
      </AboutDialog>
    </View>
  );
}

const styles = StyleSheet.create({
  desktopContent: { padding: 32, paddingBottom: 48, maxWidth: 1240, width: "100%", alignSelf: "center" }, columns: { gap: 20, marginTop: 24 }, desktopColumns: { flexDirection: "row", gap: 28, alignItems: "flex-start" }, preferencesColumn: { flex: 3 }, accountColumn: { flex: 2 }, column: { minWidth: 0 },
  safe: { backgroundColor: "#F1F0EB", flex: 1 },
  content: { paddingBottom: 100, paddingHorizontal: 20, paddingTop: 28 },
  title: { color: "#292D31", fontSize: 30, fontWeight: "800", letterSpacing: -1.5 },
  card: { borderWidth: 1, borderRadius: 16, padding: 20 },
  sectionTitle: {fontSize: 22, fontWeight: "700"}, sectionDetail: {fontSize: 15, marginTop: 6, marginBottom: 4}, preferenceRow: {paddingVertical: 20, gap: 12}, settingLabel: {fontSize: 17, fontWeight: "600"}, aboutLinkCopy: {flex: 1, gap: 4, marginLeft: 12, paddingVertical: 12}, aboutLinkTitle: {fontSize: 17, fontWeight: "600"},
  aboutCard: { borderRadius: 16, marginTop: 16, overflow: "hidden" },
  aboutRow: { alignItems: "center", flexDirection: "row", minHeight: 60, paddingHorizontal: 16 },
  accountCard: { backgroundColor: "#FAF9F6", borderRadius: 16, padding: 20 },
  sectionLabel: { fontSize: 22, fontWeight: "700" },
  accountIdentity: { alignItems: "center", flexDirection: "row", gap: 13, minHeight: 74, paddingVertical: 8 },
  identityCopy: { flex: 1, gap: 5 },
  accountTitle: { color: "#20252A", fontSize: 18, fontWeight: "700" },
  accountName: { color: "#6F7174", fontSize: 14, fontWeight: "600" },
  linkedRow: { alignItems: "center", flexDirection: "row", gap: 2 },
  accountAction: { alignItems: "center", borderTopColor: "#DFDCD5", borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 10, minHeight: 50, paddingTop: 6 },
  accountActionText: { color: "#34383D", fontSize: 15, fontWeight: "600", flexShrink: 1 },
  advancedCopy: { flex: 1, gap: 2 },
  advancedDetail: { fontSize: 13 },
  deleteAction: { alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 10, marginTop: 14, minHeight: 44, paddingTop: 10 },
  deleteText: { color: "#A13E34", fontSize: 15, fontWeight: "600" },
  pressed: { opacity: 0.68 },

});
