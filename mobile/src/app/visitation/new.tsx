import { useLocalSearchParams } from "expo-router";
import { VisitFormScreen } from "@/features/visitation/VisitFormScreen";

export default function NewVisitRoute() {
  const { person } = useLocalSearchParams<{ person?: string | string[] }>();
  return <VisitFormScreen initialPersonId={(Array.isArray(person) ? person[0] : person) ?? ""} />;
}
