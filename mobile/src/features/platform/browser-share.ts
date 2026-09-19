type ShareNavigator = {
  share?: (data: { title: string; text: string }) => Promise<void>;
  clipboard?: { writeText(text: string): Promise<void> };
};

export async function shareBrowserContact(message: string, title: string, browser: ShareNavigator): Promise<"shared" | "copied" | "dismissed"> {
  if (browser.share) {
    try { await browser.share({ title, text: message }); return "shared"; }
    catch (error) {
      if (error && typeof error === "object" && "name" in error && error.name === "AbortError") return "dismissed";
      throw error;
    }
  }
  if (!browser.clipboard) throw new Error("Sharing and clipboard are unavailable.");
  await browser.clipboard.writeText(message);
  return "copied";
}
