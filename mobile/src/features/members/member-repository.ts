import type { ImageSourcePropType } from "react-native";
import { isBackendConfigured } from "@/lib/supabase";
import { SupabaseMemberProfileRepository } from "./SupabaseMemberProfileRepository";

export type MemberProfile = {
  id: string;
  name: string;
  nameUk: string;
  photo: ImageSourcePropType;
  phone?: string;
  email?: string;
  address?: string;
  birthDate?: string;
  membershipJoinedAt?: string;
  maritalStatus?: string;
  isOrphan?: boolean;
  designation: "none" | "pastor" | "deacon";
  membershipGroup: string;
  membershipGroupUk: string;
  membershipGroupId?: string;
  responsibilityGroup?: string;
  responsibilityGroupUk?: string;
  responsibilityGroupId?: string;
  ministries: string[];
  ministriesUk: string[];
};

export interface MemberProfileRepository {
  getProfile(memberId: string): Promise<MemberProfile | null>;
}

const profiles: MemberProfile[] = [
  { id: "amelia-brooks", name: "Amelia Brooks", nameUk: "Амелія Брукс", photo: require("../../../assets/plates/avatar-amelia.png"), phone: "+1 206 555 0143", address: "Seattle, WA", designation: "none", membershipGroup: "Northside Families", membershipGroupUk: "Родини Нортсайду", ministries: ["Children’s Ministry"], ministriesUk: ["Дитяче служіння"] },
  { id: "daniel-chen", name: "Daniel Chen", nameUk: "Даніель Чен", photo: require("../../../assets/plates/avatar-daniel.png"), phone: "+1 206 555 0172", email: "daniel@example.org", designation: "deacon", membershipGroup: "Worship Team", membershipGroupUk: "Команда прославлення", responsibilityGroup: "Northside Families", responsibilityGroupUk: "Родини Нортсайду", ministries: ["Worship Team"], ministriesUk: ["Команда прославлення"] },
  { id: "marta-kovalenko", name: "Marta Kovalenko", nameUk: "Марта Коваленко", photo: require("../../../assets/plates/avatar-marta.png"), phone: "+1 206 555 0181", designation: "none", membershipGroup: "Northside Families", membershipGroupUk: "Родини Нортсайду", ministries: ["Hospitality"], ministriesUk: ["Гостинність"] },
  { id: "noah-williams", name: "Noah Williams", nameUk: "Ноа Вільямс", photo: require("../../../assets/plates/avatar-noah.png"), designation: "none", membershipGroup: "Worship Team", membershipGroupUk: "Команда прославлення", ministries: ["Small Groups"], ministriesUk: ["Малі групи"] },
];

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Local preview adapter used when the Supabase environment is unavailable. */
export class InMemoryMemberProfileRepository implements MemberProfileRepository {
  async getProfile(memberId: string) { return clone(profiles.find((profile) => profile.id === memberId) ?? null); }
}

export const memberProfileRepository: MemberProfileRepository = isBackendConfigured ? new SupabaseMemberProfileRepository() : new InMemoryMemberProfileRepository();
