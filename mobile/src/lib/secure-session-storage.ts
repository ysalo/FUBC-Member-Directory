type KeyValueStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};
/** Keeps large OAuth sessions within older iOS Keychain item limits. Header switches only after all chunks are written. */
export function createSecureSessionStorage(storage: KeyValueStorage): KeyValueStorage {
  const readHeader = async (key: string): Promise<{ version: string; count: number } | null> => {
    const value = await storage.getItem(`${key}.manifest`);
    if (!value) return null;
    try {
      const header: unknown = JSON.parse(value);
      if (header && typeof header === "object" && "version" in header && "count" in header && typeof header.version === "string" && /^[a-z0-9-]+$/.test(header.version) && typeof header.count === "number" && Number.isInteger(header.count) && header.count > 0 && header.count < 1000) return { version: header.version, count: header.count };
    } catch { /* Invalid/incomplete session is treated as signed out. */ }
    return null;
  };
  const removeChunks = async (key: string, header: { version: string; count: number }) => {
    await Promise.all(Array.from({ length: header.count }, (_, index) => storage.removeItem(`${key}.${header.version}.${index}`)));
  };
  return {
    async getItem(key) {
      const header = await readHeader(key);
      if (!header) return storage.getItem(key); // Existing non-chunked sessions can migrate on refresh.
      const chunks = await Promise.all(Array.from({ length: header.count }, (_, index) => storage.getItem(`${key}.${header.version}.${index}`)));
      if (chunks.some((chunk) => chunk === null)) return null;
      try { return decodeURIComponent(chunks.join("")); } catch { return null; }
    },
    async setItem(key, value) {
      const previous = await readHeader(key);
      const version = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      // Percent encoding makes the 1,800-character chunks ASCII and therefore <2 KB in UTF-8.
      const encoded = encodeURIComponent(value);
      const count = Math.max(1, Math.ceil(encoded.length / 1800));
      const next = { version, count };
      try {
        for (let index = 0; index < count; index++) await storage.setItem(`${key}.${version}.${index}`, encoded.slice(index * 1800, (index + 1) * 1800));
        await storage.setItem(`${key}.manifest`, JSON.stringify(next));
      } catch (error) {
        await removeChunks(key, next).catch(() => {});
        throw error;
      }
      // Cleanup failure cannot invalidate the newly committed session.
      if (previous) await removeChunks(key, previous).catch(() => {});
      await storage.removeItem(key).catch(() => {});
    },
    async removeItem(key) {
      const previous = await readHeader(key);
      await storage.removeItem(`${key}.manifest`);
      await storage.removeItem(key);
      if (previous) await removeChunks(key, previous);
    },
  };
}
