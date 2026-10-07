export type LocalePreference = "en" | "uk";

// A selection made while storage is loading is authoritative.
export function createLocaleHydration() {
  let current = true;
  return {
    cancel: () => { current = false; },
    async restore(read: () => Promise<string | null>, apply: (locale: LocalePreference) => void) {
      try {
        const stored = await read();
        if (current && (stored === "en" || stored === "uk")) apply(stored);
      } catch { /* Language remains usable when storage is unavailable. */ }
    },
  };
}
