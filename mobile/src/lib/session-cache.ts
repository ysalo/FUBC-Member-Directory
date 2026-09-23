import { createAsyncCache, InvalidatedRequestError } from "./query-cache";
import { getSessionState, subscribeSession } from "./session";
import { isBackendConfigured } from "./supabase";

export type DataTopic = "directory" | "groups" | "duty" | "visits" | "photos" | "accounts";
export const dataFreshnessMs = 5 * 60_000;
const caches = new Set<{ topics: readonly DataTopic[]; clear: () => void }>();
const listeners = new Set<() => void>();
let epoch = 0;

function fingerprint() {
    if (!isBackendConfigured) return "demo";
    const state = getSessionState();
    if (state.status !== "ready" || state.account.status !== "active") return null;
    const account = state.account;
    return JSON.stringify([account.id, account.status, account.role, account.leadershipMinistry, account.personId, account.revision]);
}

let scope = fingerprint();
subscribeSession(() => {
    const next = fingerprint();
    if (next === scope) return;
    scope = next;
    epoch++;
    for (const cache of caches) cache.clear();
    for (const listener of listeners) listener();
});

export function sessionCacheScope() {
    if (scope === null) throw new InvalidatedRequestError();
    return `${scope}:${epoch}`;
}

export function subscribeDataChanges(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export function invalidateData(...topics: DataTopic[]) {
    for (const cache of caches) {
        if (cache.topics.some((topic) => topics.includes(topic))) cache.clear();
    }
    for (const listener of listeners) listener();
}

export function createSessionCache<Value>(topics: readonly DataTopic[], maxEntries = 12, retainMs = dataFreshnessMs) {
    const cache = createAsyncCache<Value>({ maxEntries, retainMs });
    caches.add({ topics, clear: () => cache.clear() });
    return {
        peek(key: string) {
            return scope === null ? undefined : cache.peek(`${sessionCacheScope()}:${key}`);
        },
        async load(key: string, loader: () => Promise<Value>, fresh = false, ttlMs = dataFreshnessMs) {
            const scopedKey = `${sessionCacheScope()}:${key}`;
            if (fresh) cache.clear(scopedKey);
            return cache.getOrLoad(scopedKey, loader, ttlMs);
        },
        clear() { cache.clear(); },
    };
}