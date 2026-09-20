import type { Session } from "@supabase/supabase-js";
import type { Account } from "./domain";
import { errorMessage } from "./async-state";
import { getSupabase, requireSupabase } from "./supabase";
import { createSessionRevalidator } from "./session-revalidation";

export type SessionState =
    | { status: "unconfigured" | "loading" | "signed-out"; account: null }
    | { status: "ready"; account: Account }
    | { status: "error"; account: null; error: string };
let state: SessionState = { status: "loading", account: null };
const listeners = new Set<() => void>();
function publish(next: SessionState) {
    state = next;
    listeners.forEach((listener) => listener());
}
export function getSessionState(): SessionState {
    return state;
}
export function subscribeSession(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
const revalidation = createSessionRevalidator<Account>({
    isReady: () => state.status === "ready",
    loading: () => publish({ status: "loading", account: null }),
    signedOut: () => publish({ status: "signed-out", account: null }),
    ready: (account) => publish({ status: "ready", account }),
    error: (cause) =>
        publish({ status: "error", account: null, error: errorMessage(cause) }),
    async load() {
        const contract = await requireSupabase().rpc("mobile_contract_version");
        if (contract.error || contract.data !== "expo-directory-v3")
            throw new Error(
                "The church connection needs an update before this app can sign in. Please contact an administrator.",
            );
        const { data, error } = await requireSupabase().rpc(
            "current_account",
            {},
        );
        if (error) throw error;
        const account = data[0];
        if (!account) throw new Error("This account is no longer available.");
        return {
            id: account.id,
            personId: account.person_id,
            displayName: account.display_name,
            status: account.status,
            role: account.role,
            leadershipMinistry: account.leadership_ministry,
            revision: account.revision,
        };
    },
});
function resolveAccount(session: Session | null) {
    return revalidation.resolve(session?.user.id ?? null);
}
/** Start once from the application provider; cleanup is safe on React remount. */
export function startSession(): () => void {
    const supabase = getSupabase();
    if (!supabase) {
        publish({ status: "unconfigured", account: null });
        return () => {};
    }
    let mounted = true;
    let authEventObserved = false;
    const {
        data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
        authEventObserved = true;
        // Supabase auth callbacks must return before another async auth/data operation.
        queueMicrotask(() => {
            if (mounted) void resolveAccount(session);
        });
    });
    void supabase.auth.getSession().then(({ data, error }) => {
        if (!mounted || authEventObserved) return;
        if (error) {
            revalidation.invalidate();
            publish({ status: "error", account: null, error: error.message });
        } else void resolveAccount(data.session);
    });
    return () => {
        mounted = false;
        revalidation.invalidate();
        subscription.unsubscribe();
    };
}
export async function refreshSession(): Promise<void> {
    const revision = revalidation.revision;
    const { data, error } = await requireSupabase().auth.getSession();
    if (revision !== revalidation.revision) return;
    if (error) throw error;
    await resolveAccount(data.session);
}
export async function signOut(): Promise<void> {
    const { error } = await requireSupabase().auth.signOut();
    if (error) throw error;
    await revalidation.resolve(null);
}
export async function signInWithIdentityToken(
    provider: "apple" | "google",
    token: string,
    nonce?: string,
): Promise<void> {
    const { error } = await requireSupabase().auth.signInWithIdToken({
        provider,
        token,
        nonce,
    });
    if (error) throw error;
}
export async function beginOAuth(
    provider: "apple" | "google",
    redirectTo: string,
): Promise<string> {
    const { data, error } = await requireSupabase().auth.signInWithOAuth({
        provider,
        options: {
            redirectTo,
            skipBrowserRedirect: true,
            queryParams:
                provider === "google"
                    ? { prompt: "select_account" }
                    : undefined,
        },
    });
    if (error) throw error;
    if (!data.url)
        throw new Error("Sign-in did not return an authorization URL.");
    return data.url;
}
export async function completeOAuth(callbackUrl: string): Promise<void> {
    const callback = new URL(callbackUrl);
    const code = callback.searchParams.get("code");
    if (!code)
        throw new Error(
            callback.searchParams.get("error_description") ??
                "Sign-in was not completed.",
        );
    const { error } = await requireSupabase().auth.exchangeCodeForSession(code);
    if (error) throw error;
}
