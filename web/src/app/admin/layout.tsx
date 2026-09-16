import BottomNavigation from "@/components/bottom-navigation";
import { requireEditor } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { loadNavigationUser } from "@/lib/navigation-user";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, profile } = await requireEditor();
  const locale = await getLocale();
  return (
    <div className="pb-[calc(5rem+env(safe-area-inset-bottom))]">
      {children}
      <BottomNavigation
        currentUser={await loadNavigationUser(supabase, profile)}
        role={profile.role}
        isDeacon={profile.ministry_roles.includes("deacon")}
        isPastor={profile.ministry_roles.includes("pastor")}
        locale={locale}
        fixed
      />
    </div>
  );
}
