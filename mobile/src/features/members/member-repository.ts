import type { ImageSourcePropType } from "react-native";
import type { Member } from "@/features/directory/members";
import { isBackendConfigured } from "@/lib/supabase";
import { SupabaseMemberProfileRepository } from "./SupabaseMemberProfileRepository";

export type MemberProfile = {
  id: string;
  name: string;
  nameUk: string;
  patronymic?: string | null;
  photo: ImageSourcePropType;
  photoPaths?: { portrait: string | null; deacons: Record<string, string | null> };
  phone?: string;
  email?: string;
  address?: string;
  birthDate?: string;
  membershipJoinedAt?: string;
  maritalStatus?: string;
  isOrphan?: boolean;
  leadershipMinistry: "pastor" | "deacon" | null;
  membershipGroup: string;
  membershipGroupUk: string;
  membershipGroupId?: string;
  responsibleDeacons?: Member[];
  responsibilityGroup?: string;
  responsibilityGroupUk?: string;
  responsibilityGroupId?: string;
  ministries: string[];
  ministriesUk: string[];
};

export interface MemberProfileRepository {
  getProfile(memberId: string, photoVariant?: "avatar" | "original", deferPhotos?: boolean): Promise<MemberProfile | null>;
  hydratePhotos(profile: MemberProfile, photoVariant?: "avatar" | "original", part?: "portrait" | "deacons" | "all"): Promise<MemberProfile>;
}

const profiles: MemberProfile[] = [
  { id: "amelia-brooks", name: "Amelia Brooks", nameUk: "Амелія Брукс", photo: require("../../../assets/plates/avatar-amelia.png"), phone: "+1 206 555 0143", address: "Seattle, WA", leadershipMinistry: null, membershipGroup: "Northside Families", membershipGroupUk: "Родини Нортсайду", ministries: ["Children’s Ministry"], ministriesUk: ["Дитяче служіння"] },
  { id: "daniel-chen", name: "Daniel Chen", nameUk: "Даніель Чен", photo: require("../../../assets/plates/avatar-daniel.png"), phone: "+1 206 555 0172", email: "daniel@example.org", leadershipMinistry: "deacon", membershipGroup: "Worship Team", membershipGroupUk: "Команда прославлення", responsibilityGroup: "Northside Families", responsibilityGroupUk: "Родини Нортсайду", ministries: ["Worship Team"], ministriesUk: ["Команда прославлення"] },
  { id: "marta-kovalenko", name: "Marta Kovalenko", nameUk: "Марта Коваленко", photo: require("../../../assets/plates/avatar-marta.png"), phone: "+1 206 555 0181", leadershipMinistry: null, membershipGroup: "Northside Families", membershipGroupUk: "Родини Нортсайду", ministries: ["Hospitality"], ministriesUk: ["Гостинність"] },
  { id: "noah-williams", name: "Noah Williams", nameUk: "Ноа Вільямс", photo: require("../../../assets/plates/avatar-noah.png"), leadershipMinistry: null, membershipGroup: "Worship Team", membershipGroupUk: "Команда прославлення", ministries: ["Small Groups"], ministriesUk: ["Малі групи"] },
];

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Local preview adapter used when the Supabase environment is unavailable. */
class InMemoryMemberProfileRepository implements MemberProfileRepository {
  async hydratePhotos(profile: MemberProfile) { return profile; }
  async getProfile(memberId: string) {
    const profile = profiles.find((candidate) => candidate.id === memberId);
    if (!profile) return null;
    const responsibleDeacons: Member[] = profiles
      .filter((candidate) => candidate.leadershipMinistry === "deacon" && candidate.responsibilityGroup === profile.membershipGroup)
      .map((deacon) => ({ id: deacon.id, name: deacon.name, avatar: deacon.photo, phone: deacon.phone ?? null, ministry: deacon.ministries.join(" · "), ministryUk: deacon.ministriesUk.join(" · "), leadershipMinistry: "deacon", isOrphan: false, isWidow: false }));
    return clone({ ...profile, responsibleDeacons });
  }
}

export const memberProfileRepository: MemberProfileRepository = isBackendConfigured ? new SupabaseMemberProfileRepository() : new InMemoryMemberProfileRepository();
