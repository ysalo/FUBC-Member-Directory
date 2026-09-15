import type { createClient } from "@/lib/supabase/server";
type Client = Awaited<ReturnType<typeof createClient>>;
export async function loadVisitPhotos(supabase: Client, personIds: string[]) {
  const result = new Map<string, string>();
  if (!personIds.length) return result;
  const { data, error } = await supabase
    .from("people")
    .select("id,photo_path")
    .in("id", [...new Set(personIds)])
    .is("archived_at", null);
  if (error) return result;
  const paths = [
    ...new Set(
      (data ?? []).flatMap((p) =>
        p.photo_path && !p.photo_path.startsWith("/") ? [p.photo_path] : [],
      ),
    ),
  ];
  const { data: signed } = paths.length
    ? await supabase.storage.from("member-photos").createSignedUrls(paths, 3600)
    : { data: [] };
  const urls = new Map(
    (signed ?? []).filter((p) => p.signedUrl).map((p) => [p.path, p.signedUrl]),
  );
  for (const person of data ?? []) {
    const path = person.photo_path;
    const url = path?.startsWith("/") ? path : urls.get(path ?? "");
    if (url) result.set(person.id, url);
  }
  return result;
}
