import Link from "@/components/navigation-link";
import GroupManagement from "@/components/group-management";
import { requireEditor } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { loadDeaconGroups } from "@/lib/directory-data";
import { groupCopy } from "@/lib/group-copy";

export default async function GroupsAdminPage() {
  const { supabase } = await requireEditor();
  const locale = await getLocale();
  const copy = groupCopy(locale);
  const [
    groups,
    { data: people, error },
    { data: eligible, error: deaconError },
  ] = await Promise.all([
    loadDeaconGroups(supabase),
    supabase
      .from("people")
      .select("id, first_name, last_name, archived_at")
      .order("last_name")
      .order("first_name"),
    supabase.rpc("list_eligible_deacons"),
  ]);
  if (error || deaconError) throw new Error("Unable to load group management.");
  return (
    <main className="safe-page min-h-dvh p-4 sm:p-8">
      <section className="native-enter mx-auto max-w-5xl">
        <header className="flex items-center gap-3">
          <Link
            href="/admin"
            aria-label={locale === "uk" ? "До керування" : "Back to management"}
            className="grid size-11 place-items-center text-2xl"
          >
            ←
          </Link>
          <h1 className="text-2xl font-bold">{copy.groups}</h1>
        </header>
        <GroupManagement
          groups={groups}
          people={people ?? []}
          eligible={eligible ?? []}
          locale={locale}
        />
      </section>
    </main>
  );
}
