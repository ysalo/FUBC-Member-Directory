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
            <section className="px-5 pt-2 pb-7">
              {ledGroup ? (
                <Link
                  href={`/groups/${ledGroup.id}`}
                  className="flex min-h-32 items-center justify-between gap-4 rounded-2xl bg-[var(--app-brand-soft)] p-5 text-[var(--app-brand)] ring-1 ring-inset ring-[var(--app-line)] transition-colors hover:ring-[var(--app-brand)]/30 active:bg-[var(--app-line)]"
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
                      {copy.groupILead}
                    </span>
                    <span className="mt-2 block break-words text-xl font-semibold leading-tight">
                      {ledGroup.name}
                    </span>
                    <span className="mt-4 flex items-center gap-2 text-sm font-medium">
                      {copy.openGroup}
                      <ChevronRight className="size-4" />
                    </span>
                  </span>
                  <UsersRound className="size-8 shrink-0 opacity-60" />
                </Link>
              ) : (
                <p className="text-sm text-[var(--app-muted)]">
                  {copy.noGroups}
                </p>
              )}
            </section>
          )}
          {groups.some((group) => group.id !== ledGroup?.id) && (
            <h2 className="px-5 pb-2 text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
              {ledGroup ? copy.otherGroups : copy.browseGroups}
            </h2>
          )}
          <div className="divide-y divide-[var(--app-line)]">
            {groups
              .filter((group) => group.id !== ledGroup?.id)
              .map((group) => (
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
