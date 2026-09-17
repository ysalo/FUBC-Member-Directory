import { useLocalSearchParams } from "expo-router";

import { GroupDetailScreen } from "@/features/groups/GroupDetailScreen";

export default function GroupDetailRoute() {
  const { groupId } = useLocalSearchParams<{ groupId?: string | string[] }>();
  const id = Array.isArray(groupId) ? groupId[0] : groupId;
  return <GroupDetailScreen groupId={id ?? ""} />;
}
