import BottomNavigation from "@/components/bottom-navigation";
import { requireEditor } from "@/lib/auth";
import { getLocale } from "@/lib/locale";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireEditor();
  const locale = await getLocale();
  return (
    <div className="pb-[calc(5rem+env(safe-area-inset-bottom))]">
      {children}
      <BottomNavigation
        role={profile.role}
        isDeacon={profile.ministry_roles.includes("deacon")}
        locale={locale}
        fixed
      />
    </div>
  );
}
