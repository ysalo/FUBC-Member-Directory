import { useLocalSearchParams } from "expo-router";

import { VisitFormScreen } from "@/features/visitation/VisitFormScreen";

export default function EditVisitRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <VisitFormScreen visitId={id} />;
}
