import type { ImageSourcePropType } from "react-native";

export type Member = {
  id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  patronymic?: string | null;
  gender?: "male" | "female";
  ministry: string;
  ministryUk: string;
  membershipGroupId?: string | null;
  avatar: ImageSourcePropType;
  phone: string | null;
  leadershipMinistry: "pastor" | "deacon" | null;
  isOrphan: boolean;
  isWidow: boolean;
};

export const members: Member[] = [
  { id: "amelia-brooks", name: "Amelia Brooks", gender: "female", ministry: "Children’s Ministry", ministryUk: "Дитяче служіння", avatar: require("../../../assets/plates/avatar-amelia.png"), phone: null, leadershipMinistry: null, isOrphan: false, isWidow: false },
  { id: "daniel-chen", name: "Daniel Chen", gender: "male", ministry: "Worship Team", ministryUk: "Команда прославлення", avatar: require("../../../assets/plates/avatar-daniel.png"), phone: null, leadershipMinistry: null, isOrphan: false, isWidow: false },
  { id: "marta-kovalenko", name: "Marta Kovalenko", gender: "female", ministry: "Hospitality", ministryUk: "Гостинність", avatar: require("../../../assets/plates/avatar-marta.png"), phone: null, leadershipMinistry: null, isOrphan: false, isWidow: false },
  { id: "noah-williams", name: "Noah Williams", gender: "male", ministry: "Small Groups", ministryUk: "Малі групи", avatar: require("../../../assets/plates/avatar-noah.png"), phone: null, leadershipMinistry: null, isOrphan: false, isWidow: false },
];
