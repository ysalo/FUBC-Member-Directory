import type { ImageSourcePropType } from "react-native";
import { getSessionState, subscribeSession } from "./session";
import { requireSupabase } from "./supabase";
import { createPhotoCache } from "./photo-cache";
import { sessionCacheScope, subscribeDataChanges } from "./session-cache";

const photoCache = createPhotoCache(async (paths) => {
  const result = await requireSupabase().storage.from("member-photos").createSignedUrls(paths, 300);
  if (result.error) throw new Error(result.error.message);
  return new Map((result.data ?? []).flatMap((item) => item.path && item.signedUrl ? [[item.path, item.signedUrl] as const] : []));
});
let photoScope: string | null = null;
function clearChangedPhotoScope() {
  let next: string | null = null;
  try { next = sessionCacheScope(); } catch {}
  if (next !== photoScope) { photoCache.clear(); photoScope = next; }
}
subscribeSession(clearChangedPhotoScope);
subscribeDataChanges(clearChangedPhotoScope);

export function activeAccount() {
  const session = getSessionState();
  if (session.status !== "ready" || session.account.status !== "active") throw new Error("Sign in with an approved account to continue.");
  return session.account;
}
export function unwrap<T>(result: { data: T | null; error: { message: string } | null }): NonNullable<T> {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error("The requested information is unavailable.");
  return result.data as NonNullable<T>;
}
export async function privatePhotoSources(paths: Array<string | null>, variant: "avatar" | "original" = "avatar"): Promise<Map<string, ImageSourcePropType>> {
  activeAccount();
  clearChangedPhotoScope();
  const scope = sessionCacheScope();
  const sources = await photoCache.sources(paths, scope, variant);
  if (scope !== sessionCacheScope()) throw new Error("The photo session changed.");
  return sources;
}
