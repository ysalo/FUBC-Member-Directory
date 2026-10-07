import { useRouter } from "expo-router";
import { AboutContent } from "@/features/menu/AboutContent";

export default function AboutRoute() {
  const router = useRouter();
  return <AboutContent safeArea onClose={() => {
    if (router.canGoBack()) router.back();
    else router.replace("/menu" as never);
  }} />;
}
