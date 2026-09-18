import { useLocalSearchParams } from "expo-router";

import { VisitDetailScreen } from "@/features/visitation/VisitDetailScreen";

export default function VisitDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <VisitDetailScreen id={id} />;
}
