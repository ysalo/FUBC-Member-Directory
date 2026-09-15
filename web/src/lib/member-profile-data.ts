import type { createClient } from "@/lib/supabase/server";
import { loadVisitPhotos } from "@/lib/visit-photos";
import type { Visit } from "@/lib/visitation";

type Client = Awaited<ReturnType<typeof createClient>>;

export async function loadMemberProfileIds(
  supabase: Client,
  profileIds: string[],
) {
  const result = new Map<string, string>();
  if (!profileIds.length) return result;
  const { data, error } = await supabase.rpc("resolve_member_profiles", {
    requested_profile_ids: [...new Set(profileIds)],
  });
  if (error) throw new Error("Unable to load member profile links.");
  for (const row of (data ?? []) as { profile_id: string; person_id: string }[])
    result.set(row.profile_id, row.person_id);
  return result;
}

export async function loadVisitIdentities(supabase: Client, visits: Visit[]) {
  if (!visits.length) return visits;
  const identities = await loadMemberProfileIds(
    supabase,
    visits.flatMap((visit) => [
      visit.pastor_id,
      ...visit.visit_recipients.map((recipient) => recipient.deacon_id),
    ]),
  );
  const personIds = [...new Set(visits.map((visit) => visit.person_id))];
  const [{ data: people, error }, photos] = await Promise.all([
    supabase
      .from("people")
      .select("id")
      .in("id", personIds)
      .is("archived_at", null),
    loadVisitPhotos(supabase, [...personIds, ...identities.values()]),
  ]);
  if (error) throw new Error("Unable to load visit members.");
  const available = new Set((people ?? []).map((person) => person.id));
  return visits.map((visit) => ({
    ...visit,
    member_available: available.has(visit.person_id),
    member_photo: photos.get(visit.person_id),
    pastor_person_id: identities.get(visit.pastor_id) ?? null,
    pastor_photo: photos.get(identities.get(visit.pastor_id) ?? ""),
    visit_recipients: visit.visit_recipients.map((recipient) => ({
      ...recipient,
      deacon_person_id: identities.get(recipient.deacon_id) ?? null,
      deacon_photo: photos.get(identities.get(recipient.deacon_id) ?? ""),
    })),
  }));
}
