import { activeAccount, privatePhotoSources, unwrap } from "@/lib/repository-helpers";
import { requireSupabase } from "@/lib/supabase";
import type { MemberProfile, MemberProfileRepository } from "./member-repository";

export class SupabaseMemberProfileRepository implements MemberProfileRepository {
  async getProfile(memberId: string): Promise<MemberProfile | null> {
    activeAccount();
    const client = requireSupabase();
    const { data: person, error } = await client.from("people").select("*").eq("id", memberId).is("archived_at", null).maybeSingle();
    if (error) throw new Error(error.message);
    if (!person) return null;
    const [groupResult, detailResult, leadershipAccountResult, ministryLinksResult, deaconAssignmentsResult] = await Promise.all([
      person.membership_group_id ? client.from("deacon_groups").select("id,name").eq("id", person.membership_group_id).single() : null,
      client.rpc("member_profile_details", { p_person_id: memberId }),
      client.from("ministry_accounts").select("id,leadership_ministry").eq("person_id", memberId).maybeSingle(),
      client.from("person_ministries").select("ministry_id").eq("person_id", memberId),
      person.membership_group_id ? client.from("deacon_group_deacons").select("person_id").eq("group_id", person.membership_group_id).order("slot") : null,
    ]);
    const groupRow = groupResult ? unwrap(groupResult) : null;
    const group = groupRow?.name ?? "";
    const details = unwrap(detailResult)[0];
    const deaconIds = deaconAssignmentsResult ? unwrap(deaconAssignmentsResult).map((assignment) => assignment.person_id) : [];
    const deaconPeople = deaconIds.length ? unwrap(await client.from("people").select("id,name,phone,photo_path").in("id", deaconIds).is("archived_at", null)) : [];
    const photos = await privatePhotoSources([person.photo_path, ...deaconPeople.map((deacon) => deacon.photo_path)]);
    const responsibleDeacons = [...new Set(deaconIds)].flatMap((deaconId) => {
      const deacon = deaconPeople.find((candidate) => candidate.id === deaconId);
      return deacon ? [{ id: deacon.id, name: deacon.name, phone: deacon.phone, avatar: deacon.photo_path ? photos.get(deacon.photo_path) ?? {} : {}, ministry: "", ministryUk: "", leadershipMinistry: "deacon" as const, isOrphan: false, isWidow: false }] : [];
    });
    const ministryIds = ministryLinksResult.error ? [] : (ministryLinksResult.data ?? []).map((link) => link.ministry_id);
    const ministryResult = ministryIds.length ? await client.from("ministries").select("id,name,name_uk,system_key,archived_at").in("id", ministryIds).is("archived_at", null).order("name") : null;
    const leadershipMinistry = ministryResult && !ministryResult.error ? ministryResult.data.find((ministry) => ministry.system_key)?.system_key ?? null : null;
    let responsibilityGroup: { id: string; name: string } | null = null;
    if (leadershipMinistry === "deacon") {
      const assignmentResult = await client.from("deacon_group_deacons").select("group_id").eq("person_id", memberId).maybeSingle();
      if (!assignmentResult.error && assignmentResult.data?.group_id) {
        const responsibleGroupResult = await client.from("deacon_groups").select("id,name").eq("id", assignmentResult.data.group_id).maybeSingle();
        if (!responsibleGroupResult.error) responsibilityGroup = responsibleGroupResult.data;
      }
    }
    const loadedMinistries = ministryResult && !ministryResult.error ? ministryResult.data ?? [] : null;
    const hasLoadedMinistries = loadedMinistries !== null;
    const ordinaryMinistries = loadedMinistries?.filter((ministry) => !ministry.system_key) ?? [];
    const ministryNames = hasLoadedMinistries ? ordinaryMinistries.map((ministry) => ministry.name) : (person.ministry ? [person.ministry] : []);
    const ministryNamesUk = hasLoadedMinistries ? ordinaryMinistries.map((ministry) => ministry.name_uk || ministry.name) : ministryNames;
    return { id: person.id, name: person.name, nameUk: person.name, photo: person.photo_path ? photos.get(person.photo_path) ?? {} : {}, phone: person.phone ?? undefined, email: leadershipMinistry ? person.email ?? undefined : undefined, address: details?.address ?? undefined, birthDate: details?.birth_date ?? undefined, membershipJoinedAt: details?.membership_joined_at ?? undefined, maritalStatus: details?.marital_status ?? undefined, isOrphan: details?.orphan_status ?? undefined, leadershipMinistry, membershipGroup: group, membershipGroupUk: group, membershipGroupId: groupRow?.id, responsibleDeacons, responsibilityGroup: responsibilityGroup?.name, responsibilityGroupUk: responsibilityGroup?.name, responsibilityGroupId: responsibilityGroup?.id, ministries: ministryNames, ministriesUk: ministryNamesUk };
  }
}
