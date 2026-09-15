import { redirect } from "next/navigation";
import BottomNavigation from "@/components/bottom-navigation";
import { requireActiveProfile } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
export default async function VisitationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireActiveProfile();
  if (!profile.ministry_roles.some((r) => r === "pastor" || r === "deacon"))
    redirect("/");
  return (
    <main className="safe-top mx-auto min-h-dvh max-w-xl bg-[var(--app-surface)] px-5 pb-[calc(6rem+env(safe-area-inset-bottom))] text-[var(--app-ink)]">
      {children}
      <BottomNavigation
        role={profile.role}
        isDeacon={profile.ministry_roles.includes("deacon")}
        isPastor={profile.ministry_roles.includes("pastor")}
        locale={await getLocale()}
        fixed
      />
    </main>
  );
}
