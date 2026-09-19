import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { router, type Href } from "expo-router";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { State } from "@/features/session/AccessGate";
import { completeBrowserSignIn, takeBrowserReturnPath } from "@/features/session/browser-auth";
import { errorMessage } from "@/lib/async-state";

export default function AuthCallback() {
  const { locale } = useLocalization();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    // Native auth is completed by openAuthSessionAsync in AccessGate. Once the
    // gate grants access, leave this deep-link route instead of spinning forever.
    if (Platform.OS !== "web") { router.replace("/"); return; }
    let mounted = true;
    void completeBrowserSignIn(window.location.href).then(() => {
      if (mounted) router.replace(takeBrowserReturnPath() as Href);
    }).catch((reason: unknown) => {
      if (!mounted) return;
      takeBrowserReturnPath();
      // Remove the one-use authorization code from browser history after failure.
      window.history.replaceState(window.history.state, "", "/auth/callback");
      setError(errorMessage(reason));
    });
    return () => { mounted = false; };
  }, []);
  const uk = locale === "uk";
  return <State
    title={error ? (uk ? "Не вдалося ввійти" : "Sign-in couldn’t finish") : (uk ? "Завершуємо вхід" : "Finishing sign-in")}
    detail={error ?? (uk ? "Підтверджуємо ваш обліковий запис." : "Confirming your account.")}
    loading={!error}
    icon={error ? "cloud-offline-outline" : "shield-checkmark-outline"}
    action={error ? () => router.replace("/") : undefined}
    actionLabel={uk ? "Повернутися до входу" : "Return to sign-in"}
  />;
}
