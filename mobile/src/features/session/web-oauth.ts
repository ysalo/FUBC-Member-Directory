/** Only relative, same-origin application destinations may survive OAuth. */
export function safeReturnPath(value: string | null, origin: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return "/";
  try {
    const url = new URL(value, origin);
    if (url.origin !== origin || url.pathname.replace(/\/+$/, "") === "/auth/callback") return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return "/"; }
}

export const oauthReturnKey = "fubc.oauth.return";
export const oauthPendingKey = "fubc.oauth.pending";

export function recoverRootOAuthCallback(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.pathname !== "/" || (!url.searchParams.has("code") && !url.searchParams.has("error"))) return null;
    return `/auth/callback${url.search}${url.hash}`;
  } catch { return null; }
}

/** React remounts share the pending/result promise; a one-use code is never exchanged twice. */
export function createCallbackCompleter(exchange: (code: string) => Promise<void>) {
  let previousCode: string | null = null;
  let previousResult: Promise<void> | null = null;
  return (callbackUrl: string): Promise<void> => {
    const callback = new URL(callbackUrl);
    const failure = callback.searchParams.get("error_description") ?? callback.searchParams.get("error");
    if (failure) return Promise.reject(new Error(failure));
    const code = callback.searchParams.get("code");
    if (!code) return Promise.reject(new Error("Sign-in was canceled or this link has expired. Please sign in again."));
    if (previousCode === code && previousResult) return previousResult;
    previousCode = code;
    previousResult = Promise.resolve().then(() => exchange(code));
    return previousResult;
  };
}
