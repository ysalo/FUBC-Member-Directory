import type { ImageSourcePropType } from "react-native";
import { getSessionState } from "./session";
import { requireSupabase } from "./supabase";

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
export async function privatePhotoSources(paths: Array<string | null>): Promise<Map<string, ImageSourcePropType>> {
  const unique = [...new Set(paths.filter((path): path is string => Boolean(path)))];
  if (!unique.length) return new Map();
  const result = await requireSupabase().storage.from("member-photos").createSignedUrls(unique, 300);
  if (result.error) throw new Error(result.error.message);
  return new Map((result.data ?? []).flatMap((item) => item.path && item.signedUrl ? [[item.path, { uri: item.signedUrl }] as const] : []));
}
