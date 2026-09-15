import Link from "@/components/navigation-link";
import BottomNavigation from "@/components/bottom-navigation";
import { ChevronRight, UsersRound } from "lucide-react";
import { requireActiveProfile } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { loadDeaconGroups } from "@/lib/directory-data";
import { groupCopy } from "@/lib/group-copy";

export default async function GroupsPage() {
  const { supabase, profile } = await requireActiveProfile();
  const locale = await getLocale();
  const copy = groupCopy(locale);
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
      <section className="native-enter native-shadow mx-auto flex h-full max-w-xl flex-col overflow-hidden bg-white sm:rounded-[2rem]">
        <header className="safe-top flex-none px-5 pb-3">
          <h1 className="text-xl font-semibold">{copy.browseGroups}</h1>
        </header>
        <div className="native-scroll min-h-0 flex-1 overflow-y-auto">
          {isDeacon && (
            <div className="border-b border-[var(--app-line)] px-5 py-3">
              {ledGroup ? (
                <Link
                  href={`/groups/${ledGroup.id}`}
                  className="flex min-h-11 items-center justify-between gap-3 text-sm font-semibold text-[var(--app-brand)]"
                >
                  <span>{copy.groupILead}</span>
                  <ChevronRight className="size-5 shrink-0" />
                </Link>
              ) : (
                <p className="text-sm text-[var(--app-muted)]">
                  {copy.noGroups}
                </p>
              )}
            </div>
          )}
          <div className="divide-y divide-[var(--app-line)]">
            {groups.map((group) => (
              <Link
                key={group.id}
                href={`/groups/${group.id}`}
                className="flex min-h-20 items-center gap-3 px-5 py-4 hover:bg-[var(--app-surface-muted)]"
              >
                <UsersRound className="size-5 shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1">
                  <span className="block break-words font-semibold">
                    {group.name}
                  </span>
                  <span className="mt-1 block text-sm text-[var(--app-muted)]">
                    {group.deacons.length
                      ? group.deacons
                          .map(
                            (deacon) =>
                              `${deacon.name}${deacon.status !== "active" ? ` — ${copy.inactive}` : ""}`,
                          )
                          .join(", ")
                      : copy.none}
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-slate-300" />
              </Link>
            ))}
          </div>
          {!groups.length && (
            <p className="px-5 py-12 text-center text-sm text-[var(--app-muted)]">
              {copy.noGroupList}
            </p>
          )}
        </div>
        <BottomNavigation
          role={profile.role}
          isDeacon={isDeacon}
          locale={locale}
        />
      </section>
    </main>
  );
}
