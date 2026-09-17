import { useLocalSearchParams } from "expo-router";

import { MemberProfileScreen } from "@/features/members/MemberProfileScreen";

export default function MemberProfileRoute() {
  const { memberId } = useLocalSearchParams<{ memberId?: string | string[] }>();
  return <MemberProfileScreen memberId={(Array.isArray(memberId) ? memberId[0] : memberId) ?? ""} />;
}
