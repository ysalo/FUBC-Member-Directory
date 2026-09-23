export type AsyncCacheOptions = {
    now?: () => number;
};

type CacheEntry<Value> = {
    value: Value;
    expiresAt: number;
};

export function createAsyncCache<Value>({
    now = Date.now,
}: AsyncCacheOptions = {}) {
    const entries = new Map<string, CacheEntry<Value>>();
    const pending = new Map<string, Promise<Value>>();
    let generation = 0;

    const read = (key: string): Value | undefined => {
        const entry = entries.get(key);
        if (!entry) return undefined;
        if (entry.expiresAt <= now()) {
            entries.delete(key);
            return undefined;
        }
        return entry.value;
    };

    return {
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

            const requestGeneration = generation;
            let request: Promise<Value>;
            request = load()
                .then((value) => {
                    if (requestGeneration === generation)
                        entries.set(key, { value, expiresAt: now() + ttlMs });
                    return value;
                })
                .finally(() => {
                    if (pending.get(key) === request) pending.delete(key);
                });
            pending.set(key, request);
            return request;
        },
        clear(key?: string) {
            generation++;
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
