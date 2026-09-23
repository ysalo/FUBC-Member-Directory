import { activeAccount, privatePhotoSources, unwrap } from "@/lib/repository-helpers";
import { requireSupabase } from "@/lib/supabase";
import type { MemberProfile, MemberProfileRepository } from "./member-repository";

export class SupabaseMemberProfileRepository implements MemberProfileRepository {
  async hydratePhotos(profile: MemberProfile, photoVariant: "avatar" | "original" = "original", part: "portrait" | "deacons" | "all" = "all"): Promise<MemberProfile> {
    activeAccount();
    if (!profile.photoPaths) return profile;
    const { portrait, deacons } = profile.photoPaths;
    const [portraits, photos] = await Promise.all([
      part !== "deacons" ? privatePhotoSources([portrait], photoVariant) : new Map(),
      part !== "portrait" ? privatePhotoSources(Object.values(deacons)) : new Map(),
    ]);
    return { ...profile, photo: part === "deacons" ? profile.photo : portrait ? portraits.get(portrait) ?? {} : {}, responsibleDeacons: part === "portrait" ? profile.responsibleDeacons : profile.responsibleDeacons?.map((deacon) => ({
      ...deacon, avatar: deacons[deacon.id] ? photos.get(deacons[deacon.id]!) ?? {} : {},
    })) };
  }

  async getProfile(memberId: string, photoVariant: "avatar" | "original" = "original", deferPhotos = false): Promise<MemberProfile | null> {
    activeAccount();
    const client = requireSupabase();
    const { data: person, error } = await client.from("people").select("*").eq("id", memberId).is("archived_at", null).maybeSingle();
    if (error) throw new Error(error.message);
    if (!person) return null;
    const [groupResult, detailResult, ministryLinksResult, deaconAssignmentsResult] = await Promise.all([
      person.membership_group_id ? client.from("deacon_groups").select("id,name").eq("id", person.membership_group_id).single() : null,
      client.rpc("member_profile_details", { p_person_id: memberId }),
      client.from("person_ministries").select("ministry_id").eq("person_id", memberId),
      person.membership_group_id ? client.from("deacon_group_deacons").select("person_id").eq("group_id", person.membership_group_id).order("slot") : null,
    ]);
    const groupRow = groupResult ? unwrap(groupResult) : null;
    const group = groupRow?.name ?? "";
    const details = unwrap(detailResult)[0];
    const deaconIds = deaconAssignmentsResult ? unwrap(deaconAssignmentsResult).map((assignment) => assignment.person_id) : [];
    const ministryIds = ministryLinksResult.error ? [] : (ministryLinksResult.data ?? []).map((link) => link.ministry_id);
    const [deaconResult, ministryResult] = await Promise.all([
      deaconIds.length ? client.from("people").select("id,name,phone,photo_path").in("id", deaconIds).is("archived_at", null) : null,
      ministryIds.length ? client.from("ministries").select("id,name,name_uk,system_key,archived_at").in("id", ministryIds).is("archived_at", null).order("name") : null,
    ]);
    const deaconPeople = deaconResult ? unwrap(deaconResult) : [];
    const responsibleDeacons = [...new Set(deaconIds)].flatMap((deaconId) => {
      const deacon = deaconPeople.find((candidate) => candidate.id === deaconId);
      return deacon ? [{ id: deacon.id, name: deacon.name, phone: deacon.phone, avatar: {}, ministry: "", ministryUk: "", leadershipMinistry: "deacon" as const, isOrphan: false, isWidow: false }] : [];
    });
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
    const profile: MemberProfile = { id: person.id, name: person.name, nameUk: person.name, photo: {}, photoPaths: { portrait: person.photo_path, deacons: Object.fromEntries(deaconPeople.map((deacon) => [deacon.id, deacon.photo_path])) }, phone: person.phone ?? undefined, email: leadershipMinistry ? person.email ?? undefined : undefined, address: details?.address ?? undefined, birthDate: details?.birth_date ?? undefined, membershipJoinedAt: details?.membership_joined_at ?? undefined, maritalStatus: details?.marital_status ?? undefined, isOrphan: details?.orphan_status ?? undefined, leadershipMinistry, membershipGroup: group, membershipGroupUk: group, membershipGroupId: groupRow?.id, responsibleDeacons, responsibilityGroup: responsibilityGroup?.name, responsibilityGroupUk: responsibilityGroup?.name, responsibilityGroupId: responsibilityGroup?.id, ministries: ministryNames, ministriesUk: ministryNamesUk };
    profile.patronymic = person.patronymic;
    return deferPhotos ? profile : this.hydratePhotos(profile, photoVariant);
  }
}
