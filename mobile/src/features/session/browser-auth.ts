import { beginOAuth } from "@/lib/session";
import { requireSupabase } from "@/lib/supabase";
import { createCallbackCompleter, oauthPendingKey, oauthReturnKey, safeReturnPath } from "./web-oauth";

export async function startBrowserSignIn(provider: "apple" | "google") {
  const { origin, pathname, search, hash } = window.location;
  // Fail visibly if storage is blocked: PKCE and a persistent session require it.
  window.localStorage.setItem("fubc.storage-check", "1");
  window.localStorage.removeItem("fubc.storage-check");
  window.sessionStorage.setItem(oauthReturnKey, safeReturnPath(`${pathname}${search}${hash}`, origin));
  const url = await beginOAuth(provider, `${origin}/auth/callback`);
  window.sessionStorage.setItem(oauthPendingKey, "1");
  window.location.assign(url);
}

export const completeBrowserSignIn = createCallbackCompleter(async (code) => {
  const { error } = await requireSupabase().auth.exchangeCodeForSession(code);
  if (error) throw error;
});

export function takeBrowserReturnPath(): string {
  try {
    const path = safeReturnPath(window.sessionStorage.getItem(oauthReturnKey), window.location.origin);
    window.sessionStorage.removeItem(oauthReturnKey);
    window.sessionStorage.removeItem(oauthPendingKey);
    return path;
  } catch { return "/"; }
}

export function consumeCanceledBrowserSignIn(): boolean {
  try {
    const pending = window.sessionStorage.getItem(oauthPendingKey) === "1";
    window.sessionStorage.removeItem(oauthPendingKey);
    return pending;
  } catch { return false; }
}
