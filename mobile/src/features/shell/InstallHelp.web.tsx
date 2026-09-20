import { useEffect, useState } from "react";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { useTextSize } from "@/features/accessibility/TextSizeProvider";
import {
    detectInstallPlatform,
    type InstallPlatform,
} from "./install-platform";

type InstallPrompt = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// Capture at module load: the browser can offer installation before Menu opens.
let pendingPrompt: InstallPrompt | null = null;
const subscribers = new Set<() => void>();
if (typeof window !== "undefined") {
    window.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();
        pendingPrompt = event as InstallPrompt;
        subscribers.forEach((notify) => notify());
    });
    window.addEventListener("appinstalled", () => {
        pendingPrompt = null;
        subscribers.forEach((notify) => notify());
    });
}

export function InstallHelp() {
    const { locale } = useLocalization();
    const { scale } = useTextSize();
    const [standalone, setStandalone] = useState(false);
    const [prompt, setPrompt] = useState(pendingPrompt);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(false);
    const [platform, setPlatform] = useState<InstallPlatform>("desktop");
    const [showSteps, setShowSteps] = useState(false);
    const uk = locale === "uk";
    useEffect(() => {
        const displayMode = window.matchMedia("(display-mode: standalone)");
        const update = () => {
            setStandalone(
                displayMode.matches ||
                    Boolean(
                        (navigator as Navigator & { standalone?: boolean })
                            .standalone,
                    ),
            );
            setPrompt(pendingPrompt);
            setPlatform(
                detectInstallPlatform(
                    navigator.userAgent,
                    navigator.platform,
                    navigator.maxTouchPoints,
                ),
            );
        };
        const installed = () => setStandalone(true);
        subscribers.add(update);
        displayMode.addEventListener("change", update);
        window.addEventListener("appinstalled", installed);
        update();
        return () => {
            subscribers.delete(update);
            displayMode.removeEventListener("change", update);
            window.removeEventListener("appinstalled", installed);
        };
    }, []);
    if (standalone) return null;

    async function install() {
        if (!prompt || busy) return;
        setBusy(true);
        setError(false);
        try {
            await prompt.prompt();
            const choice = await prompt.userChoice;
            if (choice.outcome === "accepted") setStandalone(true);
        } catch {
            setError(true);
        } finally {
            pendingPrompt = null;
            subscribers.forEach((notify) => notify());
            setBusy(false);
        }
    }

    return (
        <section
            className="web-install-help"
            style={{ fontSize: `${16 * scale}px` }}
            aria-label={uk ? "Додати на головний екран" : "Add to Home Screen"}
        >
            <div className="web-install-heading">
                <span className="web-install-icon" aria-hidden="true">
                    <Ionicons name="phone-portrait-outline" size={22} />
                </span>
                <div>
                    <h2>
                        {uk
                            ? "Довідник на головному екрані"
                            : "Your directory on the Home Screen"}
                    </h2>
                    <p>
                        {uk
                            ? "Відкривайте довідник власною іконкою, як застосунок."
                            : "Open the directory from its own icon, like an app."}
                    </p>
                </div>
            </div>
            {prompt ? (
                <button
                    className="web-install-action"
                    type="button"
                    disabled={busy}
                    onClick={() => void install()}
                >
                    <Ionicons aria-hidden name="download-outline" size={18} />
                    {busy
                        ? uk
                            ? "Відкриваємо…"
                            : "Opening…"
                        : uk
                          ? "Встановити довідник"
                          : "Install directory"}
                </button>
            ) : platform === "ios" ? (
                <button
                    className="web-install-action"
                    type="button"
                    aria-expanded={showSteps}
                    onClick={() => setShowSteps((visible) => !visible)}
                >
                    <Ionicons aria-hidden name="share-outline" size={18} />
                    {uk ? "Додати на iPhone" : "Add on iPhone"}
                </button>
            ) : (
                <button
                    className="web-install-action web-install-action-secondary"
                    type="button"
                    aria-expanded={showSteps}
                    onClick={() => setShowSteps((visible) => !visible)}
                >
                    <Ionicons
                        aria-hidden
                        name="ellipsis-horizontal"
                        size={18}
                    />
                    {uk ? "Показати спосіб встановлення" : "Show install steps"}
                </button>
            )}
            {showSteps && (
                <div className="web-install-steps" role="status">
                    {platform === "ios" ? (
                        <ol>
                            <li>
                                {uk
                                    ? "Відкрийте цю сторінку в Safari."
                                    : "Open this page in Safari."}
                            </li>
                            <li>
                                {uk
                                    ? "Натисніть «Поширити» внизу екрана."
                                    : "Tap Share at the bottom of the screen."}
                            </li>
                            <li>
                                {uk
                                    ? "Виберіть «На початковий екран», потім «Додати»."
                                    : "Choose Add to Home Screen, then Add."}
                            </li>
                        </ol>
                    ) : platform === "android" ? (
                        <p>
                            {uk
                                ? "Відкрийте меню браузера та виберіть «Встановити застосунок» або «Додати на головний екран»."
                                : "Open the browser menu and choose Install app or Add to Home screen."}
                        </p>
                    ) : (
                        <p>
                            {uk
                                ? "Відкрийте меню браузера та виберіть «Встановити застосунок», якщо цей параметр доступний."
                                : "Open the browser menu and choose Install app when available."}
                        </p>
                    )}
                </div>
            )}
            {error && (
                <p role="alert">
                    {uk
                        ? "Не вдалося відкрити встановлення. Скористайтеся інструкцією вище."
                        : "Installation could not open. Use the instructions above."}
                </p>
            )}
        </section>
    );
}
