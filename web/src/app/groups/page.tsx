import BottomNavigation from "@/components/bottom-navigation";
import GroupsBrowser from "@/components/groups-browser";
import { requireActiveProfile } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { loadDeaconGroups } from "@/lib/directory-data";
import { groupCopy } from "@/lib/group-copy";

export default async function GroupsPage() {
  const { supabase, profile } = await requireActiveProfile();
  const locale = await getLocale();
  const groups = await loadDeaconGroups(supabase);
  const isDeacon = profile.ministry_roles.includes("deacon");
  const ledGroup = isDeacon
    ? groups.find((group) =>
        group.deacons.some((deacon) => deacon.id === profile.id),
      )
    : undefined;
  const collator = new Intl.Collator(locale === "uk" ? "uk-UA" : "en-US", {
    sensitivity: "base",
  });
  groups.sort((a, b) => collator.compare(a.name, b.name));
  return (
    <main className="fixed inset-0 h-dvh overflow-hidden overscroll-none bg-[var(--app-bg)] sm:p-6">
      <section className="native-enter native-shadow mx-auto flex h-full max-w-xl flex-col overflow-hidden bg-[var(--app-surface)] sm:rounded-[2rem]">
        <header className="safe-top flex-none px-5 pb-3">
          <h1 className="text-xl font-semibold">
            {groupCopy(locale).browseGroups}
          </h1>
        </header>
        <GroupsBrowser
          groups={groups}
          ledGroupId={ledGroup?.id}
          isDeacon={isDeacon}
          locale={locale}
        />
        <BottomNavigation
          role={profile.role}
          isDeacon={isDeacon}
          locale={locale}
        />
      </section>
    </main>
  );
}
