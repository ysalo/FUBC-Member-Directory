import { Text } from "@/features/accessibility/app-text";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import Constants from "expo-constants";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { StatusBar } from "expo-status-bar";
import { type PropsWithChildren, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLocalization } from "@/features/localization/LocalizationProvider";
import { errorMessage } from "@/lib/async-state";
import { beginOAuth, completeOAuth, refreshSession } from "@/lib/session";
import { isBackendConfigured } from "@/lib/supabase";
import { assertUsableOAuthRedirect } from "./auth-redirect";
import { useSession } from "./SessionProvider";

WebBrowser.maybeCompleteAuthSession();

const copy = {
  en: {
    checking: "Opening your directory", checkingDetail: "We’re confirming your sign-in and church access. This usually takes only a moment.", checkingSecure: "Secure sign-in", checkingApproval: "Church access", checkingDirectory: "Private directory",
    title: "FUBC", subtitle: "Member Directory", apple: "Continue with Apple", google: "Continue with Google", retry: "Try again", checkAgain: "Check again", errorTitle: "We couldn’t confirm access", pending: "Approval pending", denied: "Access denied", revoked: "Access revoked",
    pendingDetail: "An administrator needs to approve your account before directory information is available.", deniedDetail: "This account was not approved. Contact a church administrator if this seems incorrect.", revokedDetail: "Access for this account has been revoked. Contact a church administrator for help.",
    secure: "Private church community · secure access",
  },
  uk: {
    checking: "Відкриваємо ваш довідник", checkingDetail: "Підтверджуємо ваш вхід і доступ до церкви. Зазвичай це займає лише мить.", checkingSecure: "Захищений вхід", checkingApproval: "Доступ до церкви", checkingDirectory: "Приватний довідник",
    title: "FUBC", subtitle: "Довідник членів церкви", apple: "Продовжити з Apple", google: "Продовжити з Google", retry: "Спробувати ще раз", checkAgain: "Перевірити знову", errorTitle: "Не вдалося підтвердити доступ", pending: "Очікує схвалення", denied: "Доступ відхилено", revoked: "Доступ відкликано",
    pendingDetail: "Адміністратор має схвалити ваш обліковий запис, перш ніж довідник стане доступним.", deniedDetail: "Цей обліковий запис не схвалено. Зверніться до церковного адміністратора, якщо це помилка.", revokedDetail: "Доступ для цього облікового запису відкликано. Зверніться до церковного адміністратора.",
    secure: "Приватна церковна спільнота · захищений доступ",
  },
} as const;
const appleAuthEnabled = process.env.EXPO_PUBLIC_ENABLE_APPLE_AUTH === "true";
const isExpoGo = Constants.expoGoConfig != null;
const accessColors = {
  background: "#F1F0EB", surface: "#FFFFFF", line: "#D8D5CE", text: "#171B20",
  secondaryText: "#686B70", accent: "#EF5A24", accentSoft: "#FCE6DD", warningSoft: "#FFF0C9",
};

export function AccessGate({ children }: PropsWithChildren) {
  const { locale } = useLocalization();
  const labels = copy[locale];
  const session = useSession();
  const { height } = useWindowDimensions();
  const [busy, setBusy] = useState<"apple" | "google" | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  if (!isBackendConfigured) return children;
  if (session.status === "ready" && session.account.status === "active") return children;
  if (session.status === "loading" || session.status === "unconfigured") return <State detail={labels.checkingDetail} icon="shield-checkmark-outline" loading progress={[labels.checkingSecure, labels.checkingApproval, labels.checkingDirectory]} title={labels.checking} />;
  if (session.status === "error") return <State action={() => void refreshSession()} actionLabel={labels.retry} detail={session.error} icon="cloud-offline-outline" title={labels.errorTitle} />;
  if (session.status === "ready") {
    const status = session.account.status;
    if (status === "pending") return <State action={() => void refreshSession()} actionLabel={labels.checkAgain} detail={labels.pendingDetail} icon="lock-closed-outline" title={labels.pending} />;
    if (status === "denied") return <State detail={labels.deniedDetail} icon="lock-closed-outline" title={labels.denied} />;
    return <State detail={labels.revokedDetail} icon="lock-closed-outline" title={labels.revoked} />;
  }
  async function signIn(provider: "apple" | "google") {
    setBusy(provider); setAuthError(null);
    try {
      // Expo Go must return through the current Metro URL. A standalone custom
      // scheme only works after installing a separately signed native build.
      const redirectTo = assertUsableOAuthRedirect(Linking.createURL("auth/callback"), isExpoGo);
      const url = await beginOAuth(provider, redirectTo);
      const result = await WebBrowser.openAuthSessionAsync(url, redirectTo, {
        preferEphemeralSession: false,
      });
      if (result.type === "success") await completeOAuth(result.url);
    } catch (error) {
      setAuthError(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }
  const compact = height < 650;
  return <GateShell><View style={[styles.loginContent, compact && styles.loginContentCompact]}><Text accessibilityRole="header" selectable style={[styles.title, { color: accessColors.text }, compact && styles.titleCompact]}><Text style={styles.titleAccent}>F</Text>UBC</Text><Text selectable style={[styles.subtitle, { color: accessColors.text }]}>{labels.subtitle}</Text><View style={styles.brandRule}><View style={styles.brandRuleAccent} /></View><View style={[styles.providers, compact && styles.providersCompact]}>{appleAuthEnabled ? <ProviderButton busy={busy === "apple"} icon="logo-apple" label={labels.apple} onPress={() => void signIn("apple")} /> : null}<ProviderButton busy={busy === "google"} icon="logo-google" label={labels.google} onPress={() => void signIn("google")} /></View>{authError ? <Text accessibilityLiveRegion="polite" selectable style={[styles.error, { backgroundColor: accessColors.warningSoft, color: accessColors.text }]}>{authError}</Text> : null}<Text selectable style={[styles.secure, { color: accessColors.secondaryText }]}>{labels.secure}</Text></View></GateShell>;
}

function GateShell({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { backgroundColor: accessColors.background }]}>
      <StatusBar style="dark" />
      <Image accessibilityIgnoresInvertColors contentFit="cover" pointerEvents="none" source={require("../../../assets/images/login-field.svg")} style={styles.backdrop} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom, 24) }]}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </View>
  );
}
function ProviderButton({ busy, icon, label, onPress }: { busy: boolean; icon: "logo-apple" | "logo-google"; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ busy, disabled: busy }} disabled={busy} onPress={onPress} style={({ pressed }) => [styles.provider, { backgroundColor: accessColors.surface, borderColor: accessColors.line }, (pressed || busy) && styles.pressed]}>
      {busy ? <ActivityIndicator color={accessColors.accent} /> : icon === "logo-google" ? <Image accessibilityLabel="Google" contentFit="contain" source={require("../../../assets/images/google-g.svg")} style={styles.googleIcon} /> : <Ionicons color={accessColors.text} name={icon} size={22} />}
      <Text selectable style={[styles.providerText, { color: accessColors.text }]}>{label}</Text>
    </Pressable>
  );
}
function State({ action, actionLabel, detail, icon, loading, progress, title }: { action?: () => void; actionLabel?: string; detail?: string; icon: "shield-checkmark-outline" | "cloud-offline-outline" | "lock-closed-outline"; loading?: boolean; progress?: readonly string[]; title: string }) {
  return (
    <GateShell>
      <View style={styles.state}>
        <Text selectable style={[styles.stateMark, { color: accessColors.accent }]}>FUBC</Text>
        <View style={[styles.stateIcon, { backgroundColor: accessColors.accentSoft }]}>{loading ? <ActivityIndicator color={accessColors.accent} /> : <Ionicons color={accessColors.accent} name={icon} size={28} />}</View>
        <Text accessibilityRole="header" selectable style={[styles.stateTitle, { color: accessColors.text }]}>{title}</Text>
        {detail ? <Text selectable style={[styles.stateDetail, { color: accessColors.secondaryText }]}>{detail}</Text> : null}
        {progress ? <View accessibilityLabel={progress.join(", ")} style={[styles.progress, { backgroundColor: accessColors.surface, borderColor: accessColors.line }]}>{progress.map((label, index) => <View key={label} style={styles.progressItem}><View style={[styles.progressDot, { backgroundColor: index === 0 ? accessColors.accent : accessColors.line }]} />{index < progress.length - 1 ? <View style={[styles.progressLine, { backgroundColor: accessColors.line }]} /> : null}<Text style={[styles.progressLabel, { color: index === 0 ? accessColors.text : accessColors.secondaryText }]}>{label}</Text></View>)}</View> : null}
        {action ? <Pressable accessibilityRole="button" onPress={action} style={({ pressed }) => [styles.retry, { backgroundColor: accessColors.accent }, pressed && styles.pressed]}><Text selectable style={styles.retryText}>{actionLabel}</Text></Pressable> : null}
      </View>
    </GateShell>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  backdrop: { bottom: 0, left: 0, opacity: 0.26, position: "absolute", right: 0, top: 0 },
  content: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24 },
  loginContent: { alignSelf: "center", maxWidth: 430, transform: [{ translateY: 32 }], width: "100%" }, loginContentCompact: { transform: [{ translateY: 0 }] },
  title: { fontFamily: "Georgia", fontSize: 82, fontWeight: "400", letterSpacing: -3.2, lineHeight: 88, textAlign: "center" }, titleAccent: { color: accessColors.accent, textShadowColor: "rgba(239,90,36,0.18)", textShadowOffset: { width: 3, height: 0 }, textShadowRadius: 0 }, titleCompact: { fontSize: 62, lineHeight: 68 },
  subtitle: { fontSize: 12, fontWeight: "600", letterSpacing: 3.2, lineHeight: 18, marginTop: 10, textAlign: "center", textTransform: "uppercase" },
  brandRule: { alignSelf: "center", backgroundColor: "rgba(23,27,32,0.16)", height: 1, marginTop: 24, overflow: "hidden", width: 78 }, brandRuleAccent: { backgroundColor: accessColors.accent, height: 1, width: 28 },
  providers: { gap: 10, marginTop: 28 }, providersCompact: { marginTop: 22 },
  provider: { alignItems: "center", borderCurve: "continuous", borderRadius: 16, borderWidth: 1, flexDirection: "row", gap: 12, justifyContent: "center", minHeight: 58, paddingHorizontal: 22 },
  providerText: { fontSize: 16, fontWeight: "700", textAlign: "center" }, googleIcon: { height: 24, width: 24 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] }, error: { borderCurve: "continuous", borderRadius: 12, fontSize: 14, lineHeight: 20, marginTop: 14, padding: 12, textAlign: "center" }, secure: { fontSize: 12, letterSpacing: 0.2, marginTop: 22, textAlign: "center" },
  state: { alignItems: "center", alignSelf: "center", justifyContent: "center", maxWidth: 430, width: "100%" }, stateMark: { fontSize: 13, fontWeight: "800", letterSpacing: 2.8, marginBottom: 20 }, stateIcon: { alignItems: "center", borderRadius: 28, height: 56, justifyContent: "center", width: 56 }, stateTitle: { fontFamily: "Georgia", fontSize: 30, fontWeight: "400", lineHeight: 36, marginTop: 18, textAlign: "center" }, stateDetail: { fontSize: 16, lineHeight: 23, marginTop: 10, maxWidth: 350, textAlign: "center" },
  progress: { borderCurve: "continuous", borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, marginTop: 24, paddingHorizontal: 18, paddingVertical: 14, width: "100%" }, progressItem: { alignItems: "center", flexDirection: "row", minHeight: 34, position: "relative" }, progressDot: { borderRadius: 5, height: 10, marginRight: 14, width: 10 }, progressLine: { bottom: -12, height: 24, left: 4.5, position: "absolute", width: StyleSheet.hairlineWidth }, progressLabel: { fontSize: 15, fontWeight: "600" },
  retry: { borderCurve: "continuous", borderRadius: 14, justifyContent: "center", marginTop: 24, minHeight: 50, paddingHorizontal: 22, paddingVertical: 14 }, retryText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
});
