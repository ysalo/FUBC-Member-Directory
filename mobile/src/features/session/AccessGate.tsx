import { Text } from "@/features/accessibility/app-text";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import Constants from "expo-constants";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { StatusBar } from "expo-status-bar";
import { type PropsWithChildren, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
    useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLocalization } from "@/features/localization/LocalizationProvider";
import { errorMessage } from "@/lib/async-state";
import {
    beginOAuth,
    completeOAuth,
    refreshSession,
    signOut,
} from "@/lib/session";
import { isBackendConfigured } from "@/lib/supabase";
import { assertUsableOAuthRedirect } from "./auth-redirect";
import { useSession } from "./SessionProvider";
import {
    consumeCanceledBrowserSignIn,
    startBrowserSignIn,
} from "./browser-auth";
import { InstallHelp } from "@/features/shell/InstallHelp";

if (Platform.OS !== "web") WebBrowser.maybeCompleteAuthSession();

const copy = {
    en: {
        checking: "Opening your directory",
        reconnect: "Reconnect",
        reconnectTitle: "Let’s reconnect",
        reconnectDetail: "We couldn’t reconnect to the directory. Check your internet connection and reconnect. If this continues, contact a church administrator.",
        title: "FUBC",
        subtitle: "Member Directory",
        apple: "Continue with Apple",
        google: "Continue with Google",
        retry: "Try again",
        signOut: "Sign out",
        signingOut: "Signing out…",
        signOutError: "Unable to sign out. Please try again.",
        checkAgain: "Check again",
        errorTitle: "We couldn’t confirm access",
        pending: "Approval pending",
        denied: "Access denied",
        revoked: "Access revoked",
        pendingDetail:
            "An administrator needs to approve your account before directory information is available.",
        deniedDetail:
            "This account was not approved. Contact a church administrator if this seems incorrect.",
        revokedDetail:
            "Access for this account has been revoked. Contact a church administrator for help.",
        secure: "Private church community · secure access",
    },
    uk: {
        checking: "Відкриваємо ваш довідник",
        reconnect: "Підключитися знову",
        reconnectTitle: "Відновімо з’єднання",
        reconnectDetail: "Не вдалося відновити з’єднання з довідником. Перевірте інтернет і підключіться знову. Якщо це повторюється, зверніться до адміністратора церкви.",
        title: "FUBC",
        subtitle: "Довідник членів церкви",
        apple: "Продовжити з Apple",
        google: "Продовжити з Google",
        retry: "Спробувати ще раз",
        signOut: "Вийти",
        signingOut: "Вихід…",
        signOutError: "Не вдалося вийти. Спробуйте ще раз.",
        checkAgain: "Перевірити знову",
        errorTitle: "Не вдалося підтвердити доступ",
        pending: "Очікує схвалення",
        denied: "Доступ відхилено",
        revoked: "Доступ відкликано",
        pendingDetail:
            "Адміністратор має схвалити ваш обліковий запис, перш ніж довідник стане доступним.",
        deniedDetail:
            "Цей обліковий запис не схвалено. Зверніться до церковного адміністратора, якщо це помилка.",
        revokedDetail:
            "Доступ для цього облікового запису відкликано. Зверніться до церковного адміністратора.",
        secure: "Приватна церковна спільнота · захищений доступ",
    },
} as const;
const appleAuthEnabled = process.env.EXPO_PUBLIC_ENABLE_APPLE_AUTH === "true";
const isExpoGo = Constants.expoGoConfig != null;
const accessColors = {
    background: "#091722",
    surface: "#112B3A",
    line: "#3A5260",
    text: "#F8F3EA",
    brand: "#FFFFFF",
    secondaryText: "#D6CDBF",
    accent: "#D5AA58",
    accentSoft: "#263A3F",
    warningSoft: "#3B2D20",
};

export function AccessGate({ children }: PropsWithChildren) {
    const { locale } = useLocalization();
    const labels = copy[locale];
    const session = useSession();
    const { height } = useWindowDimensions();
    const [busy, setBusy] = useState<"apple" | "google" | null>(null);
    const [authError, setAuthError] = useState<string | null>(null);
    const [signingOut, setSigningOut] = useState(false);
    const [signOutError, setSignOutError] = useState<string | null>(null);
    useEffect(() => {
        if (Platform.OS !== "web") return;
        const reset = () => {
            if (consumeCanceledBrowserSignIn()) {
                setBusy(null);
                setAuthError(
                    locale === "uk"
                        ? "Вхід скасовано. Спробуйте ще раз."
                        : "Sign-in was canceled. Please try again.",
                );
            }
        };
        reset();
        window.addEventListener("pageshow", reset);
        return () => window.removeEventListener("pageshow", reset);
    }, [locale]);
    async function retrySession() {
        setSignOutError(null);
        try {
            await refreshSession();
        } catch {
            setSignOutError(labels.reconnectDetail);
        }
    }
    async function submitSignOut() {
        if (signingOut) return;
        setSigningOut(true);
        setSignOutError(null);
        try {
            await signOut();
        } catch {
            setSignOutError(labels.signOutError);
        } finally {
            setSigningOut(false);
        }
    }
    if (!isBackendConfigured) {
        if (Platform.OS === "web" && !__DEV__)
            return (
                <State
                    title={labels.errorTitle}
                    detail={
                        locale === "uk"
                            ? "Підключення до церкви не налаштовано. Зверніться до адміністратора."
                            : "The church connection has not been configured. Contact an administrator."
                    }
                    icon="cloud-offline-outline"
                />
            );
        return children;
    }
    if (session.status === "ready" && session.account.status === "active")
        return children;
    if (session.status === "loading" || session.status === "unconfigured")
        return (
            <State
                icon="shield-checkmark-outline"
                loading
                title={labels.checking}
            />
        );
    if (session.status === "error")
        return (
            <State
                action={() => void retrySession()}
                actionLabel={labels.reconnect}
                secondaryAction={() => void submitSignOut()}
                secondaryActionBusy={signingOut}
                secondaryActionError={signOutError}
                secondaryActionLabel={
                    signingOut ? labels.signingOut : labels.signOut
                }
                detail={labels.reconnectDetail}
                icon="cloud-offline-outline"
                title={labels.reconnectTitle}
            />
        );
    if (session.status === "ready") {
        const status = session.account.status;
        if (status === "pending")
            return (
                <State
                    action={() => void retrySession()}
                    actionLabel={labels.checkAgain}
                    secondaryAction={() => void submitSignOut()}
                    secondaryActionBusy={signingOut}
                    secondaryActionError={signOutError}
                    secondaryActionLabel={
                        signingOut ? labels.signingOut : labels.signOut
                    }
                    detail={labels.pendingDetail}
                    icon="lock-closed-outline"
                    title={labels.pending}
                />
            );
        if (status === "denied")
            return (
                <State
                    secondaryAction={() => void submitSignOut()}
                    secondaryActionBusy={signingOut}
                    secondaryActionError={signOutError}
                    secondaryActionLabel={
                        signingOut ? labels.signingOut : labels.signOut
                    }
                    detail={labels.deniedDetail}
                    icon="lock-closed-outline"
                    title={labels.denied}
                />
            );
        return (
            <State
                secondaryAction={() => void submitSignOut()}
                secondaryActionBusy={signingOut}
                secondaryActionError={signOutError}
                secondaryActionLabel={
                    signingOut ? labels.signingOut : labels.signOut
                }
                detail={labels.revokedDetail}
                icon="lock-closed-outline"
                title={labels.revoked}
            />
        );
    }
    async function signIn(provider: "apple" | "google") {
        setBusy(provider);
        setAuthError(null);
        try {
            if (Platform.OS === "web") {
                await startBrowserSignIn(provider);
                return;
            }
            // Expo Go must return through the current Metro URL. A standalone custom
            // scheme only works after installing a separately signed native build.
            const redirectTo = assertUsableOAuthRedirect(
                Linking.createURL("auth/callback"),
                isExpoGo,
            );
            const url = await beginOAuth(provider, redirectTo);
            const result = await WebBrowser.openAuthSessionAsync(
                url,
                redirectTo,
                {
                    preferEphemeralSession: false,
                },
            );
            if (result.type === "success") await completeOAuth(result.url);
            else
                setAuthError(
                    locale === "uk"
                        ? "Вхід скасовано. Спробуйте ще раз."
                        : "Sign-in was canceled. Please try again.",
                );
        } catch (error) {
            setAuthError(errorMessage(error));
        } finally {
            setBusy(null);
        }
    }
    const compact = height < 650;
    return (
        <GateShell>
            <View
                style={[
                    styles.loginContent,
                    compact && styles.loginContentCompact,
                ]}
            >
                <Image
                    accessibilityLabel={labels.title}
                    accessibilityRole="header"
                    contentFit="contain"
                    source={require("../../../assets/images/church-logo-light.png")}
                    style={[styles.logo, compact && styles.logoCompact]}
                />
                <Text
                    selectable
                    style={[styles.subtitle, { color: accessColors.brand }]}
                >
                    {labels.subtitle}
                </Text>
                <View
                    style={[
                        styles.providers,
                        compact && styles.providersCompact,
                    ]}
                >
                    {appleAuthEnabled ? (
                        <ProviderButton
                            busy={busy === "apple"}
                            icon="logo-apple"
                            label={labels.apple}
                            onPress={() => void signIn("apple")}
                        />
                    ) : null}
                    <ProviderButton
                        busy={busy === "google"}
                        icon="logo-google"
                        label={labels.google}
                        onPress={() => void signIn("google")}
                    />
                </View>
                {authError ? (
                    <Text
                        accessibilityLiveRegion="polite"
                        selectable
                        style={[
                            styles.error,
                            {
                                backgroundColor: accessColors.warningSoft,
                                color: accessColors.text,
                            },
                        ]}
                    >
                        {authError}
                    </Text>
                ) : null}
                <Text
                    selectable
                    style={[
                        styles.secure,
                        { color: accessColors.secondaryText },
                    ]}
                >
                    {labels.secure}
                </Text>
                <InstallHelp />
            </View>
        </GateShell>
    );
}

function GateShell({ children }: PropsWithChildren) {
    const insets = useSafeAreaInsets();
    return (
        <View
            style={[
                styles.screen,
                { backgroundColor: accessColors.background },
            ]}
        >
            <StatusBar style="light" />
            <Image
                accessibilityIgnoresInvertColors
                contentFit="cover"
                pointerEvents="none"
                source={require("../../../assets/images/login-field.svg")}
                style={styles.backdrop}
            />
            <ScrollView
                contentInsetAdjustmentBehavior="automatic"
                contentContainerStyle={[
                    styles.content,
                    {
                        paddingTop: insets.top + 24,
                        paddingBottom: Math.max(insets.bottom, 24),
                    },
                ]}
                keyboardShouldPersistTaps="handled"
            >
                {children}
            </ScrollView>
        </View>
    );
}
function ProviderButton({
    busy,
    icon,
    label,
    onPress,
}: {
    busy: boolean;
    icon: "logo-apple" | "logo-google";
    label: string;
    onPress: () => void;
}) {
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy, disabled: busy }}
            disabled={busy}
            onPress={onPress}
            style={({ pressed }) => [
                styles.provider,
                {
                    backgroundColor: accessColors.surface,
                    borderColor: accessColors.line,
                },
                (pressed || busy) && styles.pressed,
            ]}
        >
            {busy ? (
                <ActivityIndicator color={accessColors.accent} />
            ) : icon === "logo-google" ? (
                <Image
                    accessibilityLabel="Google"
                    contentFit="contain"
                    source={require("../../../assets/images/google-g.svg")}
                    style={styles.googleIcon}
                />
            ) : (
                <Ionicons color={accessColors.text} name={icon} size={22} />
            )}
            <Text
                selectable
                style={[styles.providerText, { color: accessColors.text }]}
            >
                {label}
            </Text>
        </Pressable>
    );
}
export function State({
    action,
    actionLabel,
    secondaryAction,
    secondaryActionBusy,
    secondaryActionError,
    secondaryActionLabel,
    detail,
    icon,
    loading,
    title,
}: {
    action?: () => void;
    actionLabel?: string;
    secondaryAction?: () => void;
    secondaryActionBusy?: boolean;
    secondaryActionError?: string | null;
    secondaryActionLabel?: string;
    detail?: string;
    icon:
        | "shield-checkmark-outline"
        | "cloud-offline-outline"
        | "lock-closed-outline";
    loading?: boolean;
    title: string;
}) {
    if (loading) return (
        <GateShell>
            <View accessibilityLabel={title} accessibilityState={{ busy: true }} style={styles.state}>
                <Image
                    accessibilityLabel="FUBC"
                    contentFit="contain"
                    source={require("../../../assets/images/church-logo-light.png")}
                    style={styles.loadingMark}
                />
                <ActivityIndicator accessibilityLabel={title} color={accessColors.brand} size="large" />
            </View>
        </GateShell>
    );
    return (
        <GateShell>
            <View style={styles.state}>
                <Image
                    accessibilityLabel="FUBC"
                    contentFit="contain"
                    source={require("../../../assets/images/church-logo-light.png")}
                    style={styles.stateMark}
                />
                <View
                    style={[
                        styles.stateIcon,
                        { backgroundColor: accessColors.accentSoft },
                    ]}
                >
                    <Ionicons color={accessColors.accent} name={icon} size={28} />
                </View>
                <Text
                    accessibilityRole="header"
                    selectable
                    style={[styles.stateTitle, { color: accessColors.text }]}
                >
                    {title}
                </Text>
                {detail ? (
                    <Text
                        selectable
                        style={[
                            styles.stateDetail,
                            { color: accessColors.secondaryText },
                        ]}
                    >
                        {detail}
                    </Text>
                ) : null}
                {action ? (
                    <Pressable
                        accessibilityRole="button"
                        onPress={action}
                        style={({ pressed }) => [
                            styles.retry,
                            { backgroundColor: accessColors.accent },
                            pressed && styles.pressed,
                        ]}
                    >
                        <Text selectable style={styles.retryText}>
                            {actionLabel}
                        </Text>
                    </Pressable>
                ) : null}
                {secondaryAction ? (
                    <Pressable
                        accessibilityRole="button"
                        accessibilityState={{
                            busy: secondaryActionBusy,
                            disabled: secondaryActionBusy,
                        }}
                        disabled={secondaryActionBusy}
                        onPress={secondaryAction}
                        style={({ pressed }) => [
                            styles.secondaryAction,
                            pressed && styles.pressed,
                        ]}
                    >
                        {secondaryActionBusy ? (
                            <ActivityIndicator
                                color={accessColors.secondaryText}
                                size="small"
                            />
                        ) : null}
                        <Text
                            selectable
                            style={[
                                styles.secondaryActionText,
                                { color: accessColors.secondaryText },
                            ]}
                        >
                            {secondaryActionLabel}
                        </Text>
                    </Pressable>
                ) : null}
                {secondaryActionError ? (
                    <Text
                        accessibilityLiveRegion="polite"
                        selectable
                        style={[
                            styles.stateActionError,
                            { color: accessColors.text },
                        ]}
                    >
                        {secondaryActionError}
                    </Text>
                ) : null}
            </View>
        </GateShell>
    );
}
const styles = StyleSheet.create({
    screen: { flex: 1 },
    backdrop: { bottom: 0, left: 0, position: "absolute", right: 0, top: 0 },
    content: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24 },
    loginContent: {
        alignSelf: "center",
        maxWidth: 430,
        transform: [{ translateY: 32 }],
        width: "100%",
    },
    loginContentCompact: { transform: [{ translateY: 0 }] },
    logo: { alignSelf: "center", height: 138, width: 146 },
    logoCompact: { height: 104, width: 110 },
    subtitle: {
        fontSize: 12,
        fontWeight: "600",
        letterSpacing: 3.2,
        lineHeight: 18,
        marginTop: 10,
        textAlign: "center",
        textTransform: "uppercase",
    },
    providers: { gap: 10, marginTop: 46 },
    providersCompact: { marginTop: 34 },
    provider: {
        alignItems: "center",
        borderCurve: "continuous",
        borderRadius: 16,
        borderWidth: 1,
        flexDirection: "row",
        gap: 12,
        justifyContent: "center",
        minHeight: 58,
        paddingHorizontal: 22,
    },
    providerText: { fontSize: 16, fontWeight: "700", textAlign: "center" },
    googleIcon: { height: 24, width: 24 },
    pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
    error: {
        borderCurve: "continuous",
        borderRadius: 12,
        fontSize: 14,
        lineHeight: 20,
        marginTop: 14,
        padding: 12,
        textAlign: "center",
    },
    secure: {
        fontSize: 12,
        letterSpacing: 0.2,
        marginTop: 22,
        textAlign: "center",
    },
    state: {
        alignItems: "center",
        alignSelf: "center",
        justifyContent: "center",
        maxWidth: 430,
        width: "100%",
    },
    stateMark: { height: 42, marginBottom: 20, width: 45 },
    loadingMark: { aspectRatio: 438 / 414, marginBottom: 32, maxWidth: "100%", width: 200 },
    stateIcon: {
        alignItems: "center",
        borderRadius: 28,
        height: 56,
        justifyContent: "center",
        width: 56,
    },
    stateTitle: {
        fontFamily: "Georgia",
        fontSize: 30,
        fontWeight: "400",
        lineHeight: 36,
        marginTop: 18,
        textAlign: "center",
    },
    stateDetail: {
        fontSize: 16,
        lineHeight: 23,
        marginTop: 10,
        maxWidth: 350,
        textAlign: "center",
    },
    retry: {
        borderCurve: "continuous",
        borderRadius: 14,
        justifyContent: "center",
        marginTop: 24,
        minHeight: 50,
        paddingHorizontal: 22,
        paddingVertical: 14,
    },
    retryText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
    secondaryAction: {
        alignItems: "center",
        flexDirection: "row",
        gap: 8,
        justifyContent: "center",
        minHeight: 44,
        marginTop: 8,
        paddingHorizontal: 16,
    },
    secondaryActionText: { fontSize: 15, fontWeight: "700" },
    stateActionError: {
        fontSize: 13,
        lineHeight: 18,
        marginTop: 4,
        textAlign: "center",
    },
});
