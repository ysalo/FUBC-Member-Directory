import type { Member } from "./members";
import { members } from "./members";
import { activeAccount, privatePhotoSources, unwrap } from "@/lib/repository-helpers";
import { getSessionState, subscribeSession } from "@/lib/session";
import { createAsyncCache } from "@/lib/query-cache";
import { isBackendConfigured, requireSupabase } from "@/lib/supabase";

const cacheTtlMs = 30_000;
const directoryCache = createAsyncCache<Member[]>();
const visitCountCache = createAsyncCache<number>();
let sessionKey: string | null = null;

subscribeSession(() => {
  const state = getSessionState();
  const nextKey =
    state.status === "ready"
      ? `${state.account.id}:${state.account.revision}`
      : null;
  if (nextKey !== sessionKey) {
    directoryCache.clear();
    visitCountCache.clear();
    sessionKey = nextKey;
  }
});

function cacheKey(kind: "members" | "visits", accountId: string, revision: number) {
  return `${kind}:${accountId}:${revision}`;
}

export async function listDirectory(options: { fresh?: boolean } = {}): Promise<Member[]> {
  if (!isBackendConfigured) return members;
  const account = activeAccount();
  const key = cacheKey("members", account.id, account.revision);
  if (!options.fresh) {
    const cached = directoryCache.get(key);
    if (cached) return cached;
  } else {
    directoryCache.clear(key);
  }
  return directoryCache.getOrLoad(key, async () => {
    const client = requireSupabase();
    const peopleResult = await client.rpc("directory_active_members", {}).order("name");
    const people = unwrap(peopleResult);
    const photos = await privatePhotoSources(people.map((person) => person.photo_path));
    return people.map((person) => ({ id: person.id, name: person.name, ministry: person.ministry, ministryUk: person.ministry_uk || person.ministry, avatar: person.photo_path ? photos.get(person.photo_path) ?? {} : {}, phone: person.phone, leadershipMinistry: person.leadership_ministry, isOrphan: Boolean(person.is_orphan), isWidow: Boolean(person.is_widow) }));
  }, cacheTtlMs);
}

export async function getDirectoryVisitCount(options: { fresh?: boolean } = {}): Promise<number> {
  if (!isBackendConfigured) return 0;
  const account = activeAccount();
  const key = cacheKey("visits", account.id, account.revision);
  if (!options.fresh) {
    const cached = visitCountCache.get(key);
    if (cached !== undefined) return cached;
  } else {
    visitCountCache.clear(key);
  }
  return visitCountCache.getOrLoad(key, async () => unwrap(await requireSupabase().rpc("directory_visible_visit_count", {})), cacheTtlMs);
}
