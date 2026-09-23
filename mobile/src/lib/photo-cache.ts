import { createAsyncCache } from "./query-cache";

export type PhotoSource = { uri: string; cacheKey: string };
export const thumbnailPath = (original: string) => `${original}.avatar-256.jpg`;

export function createPhotoCache(sign: (paths: string[]) => Promise<Map<string, string>>, now = Date.now) {
    const cache = createAsyncCache<PhotoSource>({ now, maxEntries: 2000 });
    let queue: Array<{ path: string; resolve: (url: string) => void; reject: (error: unknown) => void }> = [];
    let scheduled = false;
    async function flush() {
        const batch = queue;
        queue = [];
        scheduled = false;
        for (let offset = 0; offset < batch.length; offset += 100) {
            const chunk = batch.slice(offset, offset + 100);
            try {
                const urls = await sign([...new Set(chunk.map((item) => item.path))]);
                for (const item of chunk) {
                    const url = urls.get(item.path);
                    if (url) item.resolve(url);
                    else item.reject(new Error("Photo unavailable."));
                }
            } catch (error) { for (const item of chunk) item.reject(error); }
        }
    }
    return {
        clear: () => cache.clear(),
        async sources(paths: Array<string | null>, scope: string, variant: "avatar" | "original" = "avatar") {
            const unique = [...new Set(paths.filter((path): path is string => Boolean(path)))];
            const values = await Promise.all(unique.map(async (original) => {
                const path = variant === "avatar" ? thumbnailPath(original) : original;
                const key = `${scope}:${path}`;
                try {
                    const source = await cache.getOrLoad(key, async () => {
                        const uri = await new Promise<string>((resolve, reject) => {
                            queue.push({ path, resolve, reject });
                            if (!scheduled) { scheduled = true; queueMicrotask(() => { void flush(); }); }
                        });
                        return { uri, cacheKey: key };
                    }, 240_000);
                    return [original, source] as const;
                } catch { return null; }
            }));
            return new Map(values.filter((value) => value !== null));
        },
    };
}