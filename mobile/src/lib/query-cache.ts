export type AsyncCacheOptions = {
    now?: () => number;
    maxEntries?: number;
    retainMs?: number;
};

export class InvalidatedRequestError extends Error {
    constructor() { super("The request was invalidated."); }
}

type CacheEntry<Value> = {
    value: Value;
    expiresAt: number;
    retainUntil: number;
};

export function createAsyncCache<Value>({
    now = Date.now,
    maxEntries = 100,
    retainMs = 0,
}: AsyncCacheOptions = {}) {
    const entries = new Map<string, CacheEntry<Value>>();
    const pending = new Map<string, Promise<Value>>();

    const read = (key: string): Value | undefined => {
        const entry = entries.get(key);
        if (!entry) return undefined;
        if (entry.expiresAt <= now()) {
            if (entry.retainUntil <= now()) entries.delete(key);
            return undefined;
        }
        return entry.value;
    };

    return {
        peek(key: string) {
            const entry = entries.get(key);
            if (!entry || entry.retainUntil <= now()) {
                entries.delete(key);
                return undefined;
            }
            return entry.value;
        },
        get(key: string) {
            return read(key);
        },
        async getOrLoad(
            key: string,
            load: () => Promise<Value>,
            ttlMs: number,
        ): Promise<Value> {
            const cached = read(key);
            if (cached !== undefined) return cached;

            const existing = pending.get(key);
            if (existing) return existing;

            let request: Promise<Value>;
            request = Promise.resolve().then(load)
                .then((value) => {
                    if (pending.get(key) !== request) throw new InvalidatedRequestError();
                    entries.delete(key);
                    entries.set(key, { value, expiresAt: now() + ttlMs, retainUntil: now() + ttlMs + retainMs });
                    while (entries.size > maxEntries) entries.delete(entries.keys().next().value!);
                    return value;
                })
                .finally(() => {
                    if (pending.get(key) === request) pending.delete(key);
                });
            pending.set(key, request);
            return request;
        },
        clear(key?: string) {
            if (key === undefined) {
                entries.clear();
                pending.clear();
                return;
            }
            entries.delete(key);
            pending.delete(key);
        },
        size() {
            return entries.size;
        },
    };
}
