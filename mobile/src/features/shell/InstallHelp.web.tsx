import { useEffect, useState } from "react";
import { useLocalization } from "@/features/localization/LocalizationProvider";
import { useTextSize } from "@/features/accessibility/TextSizeProvider";

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
  const uk = locale === "uk";
  useEffect(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const update = () => {
      setStandalone(displayMode.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
      setPrompt(pendingPrompt);
    };
    const installed = () => setStandalone(true);
    subscribers.add(update);
    displayMode.addEventListener("change", update);
    window.addEventListener("appinstalled", installed);
    update();
    return () => { subscribers.delete(update); displayMode.removeEventListener("change", update); window.removeEventListener("appinstalled", installed); };
  }, []);
  if (standalone) return null;

  async function install() {
    if (!prompt || busy) return;
    setBusy(true); setError(false);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") setStandalone(true);
    } catch { setError(true); }
    finally { pendingPrompt = null; subscribers.forEach((notify) => notify()); setBusy(false); }
  }

  return <section className="web-install-help" style={{ fontSize: `${16 * scale}px` }} aria-label={uk ? "Додати на головний екран" : "Add to Home Screen"}>
    <h2>{uk ? "Довідник на головному екрані" : "Your directory on the Home Screen"}</h2>
    <p>{uk ? "Відкривайте довідник власною іконкою, як застосунок." : "Open the directory from its own icon, like an app."}</p>
    {prompt && <button type="button" disabled={busy} onClick={() => void install()}>{busy ? (uk ? "Відкриваємо…" : "Opening…") : (uk ? "Встановити довідник" : "Install directory")}</button>}
    <details><summary>{uk ? "Як додати іконку" : "How to add the icon"}</summary>
      <p>{uk ? "На iPhone відкрийте цей сайт у Safari, натисніть «Поширити», а потім «На початковий екран». Увімкніть «Відкривати як вебпрограму», якщо цей параметр доступний." : "On iPhone, open this site in Safari, tap Share, then Add to Home Screen. Enable Open as Web App if offered."}</p>
      <p>{uk ? "В інших браузерах відкрийте меню та виберіть «Встановити застосунок» або «Додати на головний екран», якщо доступно." : "In other browsers, open the browser menu and choose Install app or Add to Home Screen when available."}</p>
    </details>
    {error && <p role="alert">{uk ? "Не вдалося відкрити встановлення. Скористайтеся інструкцією вище." : "Installation could not open. Use the instructions above."}</p>}
  </section>;
}
