import type { Session } from "@supabase/supabase-js";
import type { Account } from "./domain";
import { errorMessage } from "./async-state";
import { getSupabase, requireSupabase } from "./supabase";

export type SessionState =
  | { status: "unconfigured" | "loading" | "signed-out"; account: null }
  | { status: "ready"; account: Account }
  | { status: "error"; account: null; error: string };
let state: SessionState = { status: "loading", account: null };
const listeners = new Set<() => void>();
let generation = 0;
function publish(next: SessionState) { state = next; listeners.forEach((listener) => listener()); }
export function getSessionState(): SessionState { return state; }
export function subscribeSession(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; }
async function resolveAccount(session: Session | null) {
  const current = ++generation;
  if (!session) { publish({ status: "signed-out", account: null }); return; }
  // Clear formerly authorized content while resolving a new/revoked identity.
  publish({ status: "loading", account: null });
  try {
    const contract = await requireSupabase().rpc("mobile_contract_version");
    if (contract.error || contract.data !== "expo-directory-v1") throw new Error("The church connection needs an update before this app can sign in. Please contact an administrator.");
    const { data, error } = await requireSupabase().from("profiles").select("*").eq("id", session.user.id).single();
    if (error) throw error;
    if (current !== generation) return;
    publish({ status: "ready", account: { id: data.id, personId: data.person_id, displayName: data.display_name, status: data.status, role: data.role, designation: data.designation, revision: data.revision } });
  } catch (error) {
    if (current === generation) publish({ status: "error", account: null, error: errorMessage(error) });
  }
}
/** Start once from the application provider; cleanup is safe on React remount. */
export function startSession(): () => void {
  const supabase = getSupabase();
  if (!supabase) { publish({ status: "unconfigured", account: null }); return () => {}; }
  let mounted = true;
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    // Supabase auth callbacks must return before another async auth/data operation.
    queueMicrotask(() => { if (mounted) void resolveAccount(session); });
  });
  void supabase.auth.getSession().then(({ data, error }) => {
    if (!mounted) return;
    if (error) publish({ status: "error", account: null, error: error.message });
    else void resolveAccount(data.session);
  });
  return () => { mounted = false; generation++; subscription.unsubscribe(); };
}
export async function refreshSession(): Promise<void> {
  const { data, error } = await requireSupabase().auth.getSession();
  if (error) throw error;
  await resolveAccount(data.session);
}
export async function signOut(): Promise<void> {
  const { error } = await requireSupabase().auth.signOut();
  if (error) throw error;
  generation++;
  publish({ status: "signed-out", account: null });
}
export async function signInWithIdentityToken(provider: "apple" | "google", token: string, nonce?: string): Promise<void> {
  const { error } = await requireSupabase().auth.signInWithIdToken({ provider, token, nonce });
  if (error) throw error;
}
export async function beginOAuth(provider: "apple" | "google", redirectTo: string): Promise<string> {
  const { data, error } = await requireSupabase().auth.signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect: true } });
  if (error) throw error;
  if (!data.url) throw new Error("Sign-in did not return an authorization URL.");
  return data.url;
}
export async function completeOAuth(callbackUrl: string): Promise<void> {
  const callback = new URL(callbackUrl);
  const code = callback.searchParams.get("code");
  if (!code) throw new Error(callback.searchParams.get("error_description") ?? "Sign-in was not completed.");
  const { error } = await requireSupabase().auth.exchangeCodeForSession(code);
  if (error) throw error;
}
