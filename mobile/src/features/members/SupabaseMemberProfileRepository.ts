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
    const [groupResult, detailResult, designationResult] = await Promise.all([
      person.membership_group_id ? client.from("deacon_groups").select("id,name").eq("id", person.membership_group_id).single() : null,
      client.rpc("member_profile_details", { p_person_id: memberId }),
      client.from("ministry_accounts").select("id,designation").eq("person_id", memberId).maybeSingle(),
    ]);
    const groupRow = groupResult ? unwrap(groupResult) : null;
    const group = groupRow?.name ?? "";
    const details = unwrap(detailResult)[0];
    const photos = await privatePhotoSources([person.photo_path]);
    const designation = designationResult && !designationResult.error ? designationResult.data?.designation ?? "none" : "none";
    let responsibilityGroup: { id: string; name: string } | null = null;
    if (designation === "deacon" && designationResult?.data?.id) {
      const assignmentResult = await client.from("deacon_group_deacons").select("group_id").eq("account_id", designationResult.data.id).maybeSingle();
      if (!assignmentResult.error && assignmentResult.data?.group_id) {
        const responsibleGroupResult = await client.from("deacon_groups").select("id,name").eq("id", assignmentResult.data.group_id).maybeSingle();
        if (!responsibleGroupResult.error) responsibilityGroup = responsibleGroupResult.data;
      }
    }
    return { id: person.id, name: person.name, nameUk: person.name, photo: person.photo_path ? photos.get(person.photo_path) ?? {} : {}, phone: person.phone ?? undefined, email: designation !== "none" ? person.email ?? undefined : undefined, address: details?.address ?? undefined, birthDate: details?.birth_date ?? undefined, membershipJoinedAt: details?.membership_joined_at ?? undefined, maritalStatus: details?.marital_status ?? undefined, isOrphan: details?.orphan_status ?? undefined, designation, membershipGroup: group, membershipGroupUk: group, membershipGroupId: groupRow?.id, responsibilityGroup: responsibilityGroup?.name, responsibilityGroupUk: responsibilityGroup?.name, responsibilityGroupId: responsibilityGroup?.id, ministries: person.ministry ? [person.ministry] : [], ministriesUk: person.ministry_uk || person.ministry ? [person.ministry_uk || person.ministry] : [] };
  }
}
