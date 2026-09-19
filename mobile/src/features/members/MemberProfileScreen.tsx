import { shareContactMessage } from "@/features/platform/share";
import { Alert } from "@/features/platform/alert";
import { Text } from "@/features/accessibility/app-text";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { Link, type Href, useFocusEffect, useRouter } from "expo-router";
import { type ComponentProps, useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDesktopLayout } from "@/features/shell/use-desktop-layout";
import { useAppearance } from "@/features/appearance/AppearanceProvider";
import { formatPhoneNumber } from "@/lib/phone";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { useSession } from "@/features/session/SessionProvider";
import { getMemberCopy } from "./member-copy";
import { memberProfileRepository, type MemberProfile } from "./member-repository";
import { CareStatusBadges } from "./care-status-badges";
import { LeadershipBadge } from "./leadership-badge";
import { ProfileAvatar } from "./ProfileAvatar";
import { canCreateVisit } from "@/lib/permissions";
import { contactShareMessage, emailUrl, mapUrls } from "./contact-links";

export function MemberProfileScreen({ memberId }: { memberId: string }) {
  const desktop = useDesktopLayout();
  const router = useRouter(); const { palette } = useAppearance(); const session = useSession(); const insets = useSafeAreaInsets();
  const { locale } = useLocalization(); const copy = getMemberCopy(locale);
  const [profile, setProfile] = useState<MemberProfile | null | undefined>(); const [failed, setFailed] = useState(false); const [photoFailed, setPhotoFailed] = useState(false);
  const load = () => { setProfile(undefined); setFailed(false); setPhotoFailed(false); memberProfileRepository.getProfile(memberId).then(setProfile).catch(() => { setFailed(true); setProfile(null); }); };
  useFocusEffect(useCallback(load, [memberId]));
  const open = async (url: string, unavailableMessage: string, fallback?: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      if (fallback) {
        try { await Linking.openURL(fallback); return; } catch { /* Show a useful error below. */ }
      }
      Alert.alert(copy.actionUnavailable, unavailableMessage);
    }
  };
  if (profile === undefined) return <ProfileState loading title={copy.loading} />;
  if (!profile || failed) return <ProfileState action={failed ? load : undefined} detail={failed ? undefined : copy.unavailableDetail} title={failed ? copy.error : copy.unavailable} />;

  const name = locale === "uk" ? profile.nameUk : profile.name; const group = locale === "uk" ? profile.membershipGroupUk : profile.membershipGroup; const responsibilityGroup = locale === "uk" ? profile.responsibilityGroupUk : profile.responsibilityGroup; const ministries = locale === "uk" ? profile.ministriesUk : profile.ministries;
  const age = profile.birthDate ? Math.floor((Date.now() - new Date(`${profile.birthDate}T12:00:00`).getTime()) / 31557600000) : null;
  const formatDate = (value: string) => new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
  // Email is an operational contact reserved for church leadership. Use the
  // profile's leadership ministry, rather than the viewer's role, so a
  // deacon/pastor profile remains reachable by authorized directory users.
  const isLeadership = Boolean(profile.leadershipMinistry);
  const isWidow = ["widow", "widowed", "вдова", "вдівець", "вдівець/вдова"].includes(profile.maritalStatus?.trim().toLocaleLowerCase() ?? "");
  const canRequestVisit = session.status === "ready" && canCreateVisit(session.account);
  const canEdit = session.status === "ready" && session.account.role === "admin";
  const hasHeroPhoto = Boolean(profile.photo) && !photoFailed;
  const shareContact = async () => {
    const message = contactShareMessage(
      { name, phone: profile.phone ? formatPhoneNumber(profile.phone) : undefined, email: profile.email, address: profile.address },
      { phone: copy.phoneLabel, email: copy.emailLabel, address: copy.addressLabel },
    );
    try {
      const result = await shareContactMessage(message, name, copy.share);
      if (result === "copied") Alert.alert(copy.copied);
    } catch {
      Alert.alert(copy.actionUnavailable, copy.shareUnavailable);
    }
  };

  const contactSection = <Section title={copy.contact}><View style={styles.actions}>{profile.phone ? <Action icon="call-outline" label={copy.call} onPress={() => void open(`tel:${profile.phone!.replace(/[^+\d]/g, "")}`, copy.actionUnavailable)} /> : null}{isLeadership && profile.email ? <Action icon="mail-outline" label={copy.email} onPress={() => void open(emailUrl(profile.email!), copy.emailUnavailable)} /> : null}{profile.address ? <Action icon="map-outline" label={copy.maps} onPress={() => { const urls = mapUrls(profile.address!); void open(urls.primary, copy.mapsUnavailable, urls.fallback); }} /> : null}<Action icon="share-outline" label={copy.share} onPress={() => void shareContact()} /></View>{profile.phone ? <ContactValue accessibilityLabel={copy.copyPhone} copiedLabel={copy.copied} emphasized failureDetail={copy.copyUnavailable} failureTitle={copy.actionUnavailable} value={formatPhoneNumber(profile.phone)} /> : null}{isLeadership && profile.email ? <ContactValue accessibilityLabel={copy.copyEmail} copiedLabel={copy.copied} failureDetail={copy.copyUnavailable} failureTitle={copy.actionUnavailable} value={profile.email} /> : null}{profile.address ? <ContactValue accessibilityLabel={copy.copyAddress} copiedLabel={copy.copied} failureDetail={copy.copyUnavailable} failureTitle={copy.actionUnavailable} value={profile.address} /> : null}</Section>;
  const detailsSection = <Section title={copy.details}>{profile.birthDate ? <Fact label={copy.birthday} value={formatDate(profile.birthDate)} /> : null}{age !== null ? <Fact label={copy.age} value={String(age)} /> : null}{profile.membershipJoinedAt ? <Fact label={copy.memberSince} value={formatDate(profile.membershipJoinedAt)} /> : null}{profile.maritalStatus ? <Fact label={copy.maritalStatus} value={profile.maritalStatus} /> : null}{profile.membershipGroupId ? <Link href={`/groups/${profile.membershipGroupId}`} asChild><ProfileGroupLinkContent accessibilityHint={copy.openGroup} accessibilityLabel={`${copy.group}: ${group || "—"}`} accessibilityRole="link"><Fact disclosure label={copy.group} last={!profile.responsibilityGroupId} value={group || "—"} /></ProfileGroupLinkContent></Link> : <Fact label={copy.group} last={!profile.responsibilityGroupId} value={group || "—"} />}{profile.responsibilityGroupId ? <Link href={`/groups/${profile.responsibilityGroupId}`} asChild><ProfileGroupLinkContent accessibilityHint={copy.openGroup} accessibilityLabel={`${copy.responsibleFor}: ${responsibilityGroup || "—"}`} accessibilityRole="link"><Fact disclosure label={copy.responsibleFor} last value={responsibilityGroup || "—"} /></ProfileGroupLinkContent></Link> : null}</Section>;
  const ministriesSection = <Section title={copy.ministries}><View style={styles.bodyList}>{profile.leadershipMinistry ? <LeadershipBadge leadershipMinistry={profile.leadershipMinistry} locale={locale} /> : null}{ministries.map((ministry, index) => <Text key={`${profile.id}:detail-ministry:${index}`} style={[styles.bodyListText, { color: palette.text }]}>{ministry}</Text>)}</View></Section>;

  return <View style={[styles.root, { backgroundColor: palette.background }]}><ScrollView contentInsetAdjustmentBehavior="never" contentContainerStyle={[styles.screen, Platform.OS === "web" && styles.webScreen, desktop && styles.desktopScreen]} keyboardShouldPersistTaps="handled">
    {desktop ? <View style={styles.desktopHeader}>
      <View style={styles.desktopToolbar}>
        <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace("/")} style={styles.desktopBack}><Ionicons color={palette.text} name="chevron-back" size={22} /><Text style={{ color: palette.text, fontSize: 16 }}>{copy.back}</Text></Pressable>
        {canEdit ? <Link href={`/manage/member/${memberId}`} asChild><Pressable accessibilityRole="link" style={StyleSheet.flatten([styles.desktopEdit, { backgroundColor: palette.surface, borderColor: palette.line }])}><Ionicons color={palette.text} name="create-outline" size={20} /><Text style={{ color: palette.text, fontSize: 15 }}>{locale === "uk" ? "Редагувати учасника" : "Edit member"}</Text></Pressable></Link> : null}
      </View>
      <View style={styles.desktopIdentity}>
        {hasHeroPhoto ? <Image accessibilityLabel={`${name} ${copy.profile}`} contentFit="cover" onError={() => setPhotoFailed(true)} source={profile.photo} style={styles.desktopPhoto} /> : <ProfileAvatar name={name} size={160} />}
        <View style={styles.desktopIdentityCopy}><Text accessibilityRole="header" style={[styles.desktopName, { color: palette.text }]}>{name}</Text>{profile.leadershipMinistry ? <LeadershipBadge leadershipMinistry={profile.leadershipMinistry} locale={locale} /> : null}<View style={styles.ministryRow}>{ministries.map((ministry, index) => <Text key={`${profile.id}:desktop-ministry:${index}`} style={[styles.desktopMinistryText, { color: palette.secondaryText }]}>{ministry}</Text>)}</View><CareStatusBadges isOrphan={profile.isOrphan} isWidow={isWidow} /></View>
      </View>
    </View> : <View style={[styles.hero, { paddingTop: insets.top }]}>{hasHeroPhoto ? <Image accessibilityLabel={`${name} ${copy.profile}`} contentFit="cover" onError={() => setPhotoFailed(true)} source={profile.photo} style={StyleSheet.absoluteFill} /> : <View style={styles.heroFallback}><ProfileAvatar name={name} size={156} /></View>}{hasHeroPhoto ? <View style={styles.heroShade} /> : null}
      <Pressable accessibilityLabel={copy.back} accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace("/")} style={[styles.floatingButton, { top: insets.top + 12 }]}><Ionicons accessibilityElementsHidden color="#FFF" name="chevron-back" size={24} /></Pressable>
      {canEdit ? <Pressable accessibilityLabel={locale === "uk" ? "Редагувати учасника" : "Edit member"} accessibilityRole="button" onPress={() => router.push(`/manage/member/${memberId}` as Href)} style={[styles.floatingButton, styles.editButton, { top: insets.top + 12 }]}><Ionicons color="#FFF" name="create-outline" size={22} /></Pressable> : null}
      <View style={styles.heroCopy}><Text accessibilityRole="header" style={styles.name}>{name}</Text>{profile.leadershipMinistry ? <LeadershipBadge leadershipMinistry={profile.leadershipMinistry} inverted locale={locale} /> : null}<View style={styles.ministryRow}>{ministries.map((ministry, index) => <Text key={`${profile.id}:hero-ministry:${index}`} style={styles.heroPillText}>{ministry}</Text>)}</View><CareStatusBadges isOrphan={profile.isOrphan} isWidow={isWidow} /></View>
    </View>}
    <View style={[styles.body, desktop && styles.desktopBody]}>
      {canRequestVisit ? <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/visitation/new", params: { person: memberId } } as Href)} style={({ pressed }) => [styles.visitButton, desktop && styles.desktopVisitButton, { backgroundColor: palette.accent }, pressed && styles.pressed]}><Ionicons accessibilityElementsHidden color="#FFF" name="calendar-outline" size={21} /><Text style={styles.visitButtonText}>{copy.requestVisit}</Text></Pressable> : null}
      {desktop ? <View style={styles.desktopColumns}>
        <View style={styles.desktopContactColumn}>{contactSection}{ministriesSection}</View>
        <View style={styles.desktopDetailsColumn}>{detailsSection}</View>
      </View> : <>{contactSection}{detailsSection}{ministriesSection}</>}
    </View>
  </ScrollView></View>;
}

// Keep the callback inside the component: Expo Router Slot merges child styles
// as objects, which would otherwise discard a Pressable style function.
function ProfileGroupLinkContent(props: ComponentProps<typeof Pressable>) {
  return <Pressable {...props} style={({ pressed }) => pressed && styles.pressedRow} />;
}

function Action({ icon, label, onPress }: { icon: "call-outline" | "mail-outline" | "map-outline" | "share-outline"; label: string; onPress: () => void }) { const { palette } = useAppearance(); return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.action, { backgroundColor: palette.accentSoft }]}><Ionicons color={palette.accent} name={icon} size={23} /><Text numberOfLines={1} style={[styles.actionText, { color: palette.accent }]}>{label}</Text></Pressable>; }
function ContactValue({ accessibilityLabel, copiedLabel, emphasized = false, failureDetail, failureTitle, value }: { accessibilityLabel: string; copiedLabel: string; emphasized?: boolean; failureDetail: string; failureTitle: string; value: string }) { const { palette } = useAppearance(); const [copied, setCopied] = useState(false); useEffect(() => { if (!copied) return; const timer = setTimeout(() => setCopied(false), 1600); return () => clearTimeout(timer); }, [copied]); const copyValue = async () => { try { await Clipboard.setStringAsync(value); setCopied(true); } catch { Alert.alert(failureTitle, failureDetail); } }; return <View style={[styles.contactValue, { borderTopColor: palette.line }]}><Text selectable style={[styles.contactText, emphasized && styles.contactTextEmphasized, { color: emphasized ? palette.text : palette.secondaryText }]}>{value}</Text><Pressable accessibilityLabel={copied ? copiedLabel : accessibilityLabel} accessibilityRole="button" accessibilityState={{ selected: copied }} hitSlop={8} onPress={() => void copyValue()} style={({ pressed }) => [styles.copyButton, pressed && styles.pressed]}><Ionicons accessibilityElementsHidden color={copied ? palette.accent : palette.secondaryText} name={copied ? "checkmark" : "copy-outline"} size={17} /></Pressable></View>; }
function Section({ children, title }: { children: React.ReactNode; title: string }) { const { palette } = useAppearance(); return <View style={styles.section}><Text accessibilityRole="header" style={[styles.sectionTitle, { color: palette.text }]}>{title}</Text><View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.line }]}>{children}</View></View>; }
function Fact({ disclosure = false, label, value, last = false }: { disclosure?: boolean; label: string; value: string; last?: boolean }) { const { palette } = useAppearance(); return <View style={[styles.fact, !last && { borderBottomColor: palette.line, borderBottomWidth: StyleSheet.hairlineWidth }]}><Text style={[styles.factLabel, { color: palette.secondaryText }]}>{label}</Text><View style={styles.factValueRow}><Text selectable style={[styles.factValue, { color: disclosure ? palette.accent : palette.text }]}>{value}</Text>{disclosure ? <Ionicons accessibilityElementsHidden color={palette.accent} name="chevron-forward" size={18} /> : null}</View></View>; }
function ProfileState({ action, detail, loading, title }: { action?: () => void; detail?: string; loading?: boolean; title: string }) { const { palette } = useAppearance(); const { locale } = useLocalization(); const copy = getMemberCopy(locale); return <View style={[styles.state, { backgroundColor: palette.background }]}>{loading ? <ActivityIndicator color={palette.accent} /> : <Ionicons color={palette.secondaryText} name="person-outline" size={30} />}<Text style={[styles.stateTitle, { color: palette.text }]}>{title}</Text>{detail ? <Text style={[styles.stateDetail, { color: palette.secondaryText }]}>{detail}</Text> : null}{action ? <Pressable onPress={action} style={{ alignItems: "center", backgroundColor: palette.accent, borderRadius: 11, paddingHorizontal: 15, paddingVertical: 11 }}><Text style={{ color: "#FFF", fontWeight: "800" }}>{copy.retry}</Text></Pressable> : null}</View>; }

const styles = StyleSheet.create({
  webScreen: { paddingBottom: 32 },
  desktopScreen: { alignSelf: "center", maxWidth: 1200, width: "100%", paddingHorizontal: 32 },
  desktopHeader: { paddingTop: 20 },
  desktopToolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 },
  desktopBack: { flexDirection: "row", gap: 8, alignItems: "center", minHeight: 44, paddingHorizontal: 8 },
  desktopEdit: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, minHeight: 44, paddingHorizontal: 14 },
  desktopIdentity: { flexDirection: "row", alignItems: "center", gap: 28, paddingVertical: 32 },
  desktopPhoto: { width: 160, height: 160, borderRadius: 16 },
  desktopIdentityCopy: { flex: 1, minWidth: 0, gap: 8 },
  desktopName: { fontSize: 38, fontWeight: "800", letterSpacing: -1, lineHeight: 45 },
  desktopMinistryText: { fontSize: 16, lineHeight: 23 },
  desktopBody: { padding: 0, gap: 28 },
  desktopColumns: { flexDirection: "row", alignItems: "flex-start", gap: 28 },
  desktopContactColumn: { flex: 1, minWidth: 0, gap: 24 },
  desktopDetailsColumn: { flex: 1, minWidth: 0 },
  desktopVisitButton: { alignSelf: "flex-start", paddingHorizontal: 24 },
  root: { flex: 1 }, screen: { paddingBottom: 112 }, hero: { backgroundColor: "#36414A", height: 390, overflow: "hidden", position: "relative" }, heroFallback: { alignItems: "center", bottom: 100, justifyContent: "center", left: 0, position: "absolute", right: 0, top: 48 }, heroShade: { backgroundColor: "rgba(5,10,14,0.25)", bottom: 0, left: 0, position: "absolute", right: 0, top: 0 }, floatingButton: { alignItems: "center", backgroundColor: "rgba(10,14,18,0.55)", borderRadius: 22, height: 44, justifyContent: "center", left: 16, position: "absolute", width: 44 }, editButton: { left: undefined, right: 16 }, heroCopy: { bottom: 24, left: 20, position: "absolute", right: 20 }, name: { color: "#FFF", fontSize: 38, fontWeight: "800", letterSpacing: -1, lineHeight: 43, textShadowColor: "rgba(0,0,0,0.35)", textShadowRadius: 8 }, ministryRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 10 }, heroPill: { backgroundColor: "rgba(13,18,22,0.7)", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 }, heroPillText: { color: "#FFF", fontSize: 13, fontWeight: "700" }, body: { gap: 18, padding: 18 }, visitButton: { alignItems: "center", borderRadius: 14, flexDirection: "row", gap: 9, justifyContent: "center", minHeight: 52 }, visitButtonText: { color: "#FFF", fontSize: 16, fontWeight: "800" }, section: { gap: 8 }, sectionTitle: { fontSize: 19, fontWeight: "800" }, card: { borderCurve: "continuous", borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" }, actions: { flexDirection: "row", flexWrap: "wrap", gap: 9, padding: 12 }, action: { alignItems: "center", borderRadius: 12, flex: 1, gap: 5, justifyContent: "center", minHeight: 62, minWidth: 70 }, actionText: { fontSize: 13, fontWeight: "800" }, contactValue: { alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 10, minHeight: 48, paddingHorizontal: 14, paddingVertical: 9 }, contactText: { flex: 1, fontSize: 14, lineHeight: 20 }, contactTextEmphasized: { fontSize: 16, fontWeight: "700" }, copyButton: { alignItems: "center", height: 32, justifyContent: "center", width: 32 }, fact: { alignItems: "center", flexDirection: "row", gap: 14, justifyContent: "space-between", minHeight: 52, paddingHorizontal: 14, paddingVertical: 10 }, factLabel: { fontSize: 14 }, factValueRow: { alignItems: "center", flex: 1, flexDirection: "row", gap: 7, justifyContent: "flex-end" }, factValue: { flexShrink: 1, fontSize: 15, fontWeight: "600", textAlign: "right" }, pressedRow: { opacity: .65 }, bodyList: { gap: 8, padding: 14 }, bodyListText: { fontSize: 15, fontWeight: "600" }, pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] }, state: { alignItems: "center", flex: 1, gap: 10, justifyContent: "center", padding: 30 }, stateTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" }, stateDetail: { textAlign: "center" } });
