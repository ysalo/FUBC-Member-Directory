import type { ImageSourcePropType } from "react-native";

export type Member = {
  id: string;
  name: string;
  ministry: string;
  ministryUk: string;
  avatar: ImageSourcePropType;
  phone: string | null;
  designation: "none" | "pastor" | "deacon";
  isOrphan: boolean;
  isWidow: boolean;
};

export const members: Member[] = [
  { id: "amelia-brooks", name: "Amelia Brooks", ministry: "Children’s Ministry", ministryUk: "Дитяче служіння", avatar: require("../../../assets/plates/avatar-amelia.png"), phone: null, designation: "none", isOrphan: false, isWidow: false },
  { id: "daniel-chen", name: "Daniel Chen", ministry: "Worship Team", ministryUk: "Команда прославлення", avatar: require("../../../assets/plates/avatar-daniel.png"), phone: null, designation: "none", isOrphan: false, isWidow: false },
  { id: "marta-kovalenko", name: "Marta Kovalenko", ministry: "Hospitality", ministryUk: "Гостинність", avatar: require("../../../assets/plates/avatar-marta.png"), phone: null, designation: "none", isOrphan: false, isWidow: false },
  { id: "noah-williams", name: "Noah Williams", ministry: "Small Groups", ministryUk: "Малі групи", avatar: require("../../../assets/plates/avatar-noah.png"), phone: null, designation: "none", isOrphan: false, isWidow: false },
];
