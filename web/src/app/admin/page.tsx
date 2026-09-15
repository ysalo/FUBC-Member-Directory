import Link from "@/components/navigation-link";
import { addMember, archiveMember, restoreMember } from "./actions";
import { requireEditor } from "@/lib/auth";
import LanguageSwitcher from "@/components/language-switcher";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { groupCopy } from "@/lib/group-copy";

export default async function AdminPage() {
  const locale = await getLocale();
  const { supabase, profile } = await requireEditor();

  const { data: people, error } = await supabase
    .from("people")
    .select("id, first_name, last_name, phone, city, state, archived_at")
    .order("last_name")
    .order("first_name");
  if (error) throw new Error("Unable to load member records.");
  const activePeople = (people ?? []).filter((person) => !person.archived_at);
  const archivedPeople = (people ?? []).filter((person) => person.archived_at);
  const { count: pendingCount } =
    profile.role === "admin"
      ? await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
      : { count: 0 };

  return (
    <main className="safe-page min-h-dvh p-4 sm:p-8">
      <section className="native-enter mx-auto max-w-6xl">
        <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center">
          <div>
            <p className="font-medium text-[var(--app-accent)]">
              {t(locale, "privateDirectory")}
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
              {profile.role === "admin"
                ? t(locale, "adminPortal")
                : t(locale, "editorPortal")}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/groups"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-4 py-2.5 font-semibold text-[var(--app-ink)]"
            >
              {groupCopy(locale).groups}
            </Link>
            <LanguageSwitcher locale={locale} />
            {profile.role === "admin" && (
              <Link
                href="/admin/accounts"
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-[var(--app-brand-soft)] px-4 py-2.5 text-center font-semibold text-[var(--app-brand)] hover:bg-[#d9e9f3] sm:flex-none"
              >
                {t(locale, "accountRequests")}
                {pendingCount ? ` (${pendingCount})` : ""}
              </Link>
            )}
            <Link
              href="/"
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-[var(--app-brand)] px-4 py-2.5 text-center font-semibold text-white shadow-sm hover:bg-[var(--app-brand-strong)] sm:flex-none"
            >
              {t(locale, "viewDirectory")}
            </Link>
          </div>
        </header>
        <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <article className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  {t(locale, "directoryRecords")}
                </p>
                <h2 className="mt-1 text-3xl font-bold text-slate-950">
                  {activePeople.length}
                </h2>
              </div>
              <span className="rounded-full bg-[var(--app-accent-soft)] px-3 py-1 text-sm font-semibold text-[#8a641f]">
                {t(locale, "liveData")}
              </span>
            </div>
            <div className="mt-6 divide-y divide-slate-100 border-y border-slate-100">
              {activePeople.map((person) => (
                <div
                  key={person.id}
                  className="flex flex-col gap-3 py-4 min-[430px]:flex-row min-[430px]:items-center min-[430px]:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">
                      {person.first_name} {person.last_name}
                    </p>
                    <p className="truncate text-sm text-slate-500">
                      {[
                        person.phone,
                        [person.city, person.state].filter(Boolean).join(", "),
                      ]
                        .filter(Boolean)
                        .join(" · ") || t(locale, "noContactDetails")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/admin/${person.id}`}
                      className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-[var(--app-brand-soft)] px-3 py-2 text-sm font-semibold text-[var(--app-brand)] hover:bg-[#d9e9f3]"
                    >
                      {t(locale, "edit")}
                    </Link>
                    <form
                      action={archiveMember.bind(null, person.id)}
                      className="flex-1"
                    >
                      <button className="min-h-11 w-full rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-red-50 hover:text-red-700">
                        {t(locale, "archive")}
                      </button>
                    </form>
                  </div>
                </div>
              ))}
              {!activePeople.length && (
                <p className="py-12 text-center text-slate-500">
                  {t(locale, "addFirstRecord")}
                </p>
              )}
            </div>
            {archivedPeople.length > 0 && (
              <div className="mt-8">
                <h3 className="font-semibold text-slate-900">
                  {t(locale, "archived")} ({archivedPeople.length})
                </h3>
                <div className="mt-2 divide-y divide-slate-100 border-y border-slate-100">
                  {archivedPeople.map((person) => (
                    <div
                      key={person.id}
                      className="flex items-center justify-between gap-4 py-3"
                    >
                      <Link
                        href={`/admin/${person.id}`}
                        className="font-medium text-slate-500 hover:text-blue-700"
                      >
                        {person.first_name} {person.last_name}
                      </Link>
                      <form action={restoreMember.bind(null, person.id)}>
                        <button className="min-h-11 rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200">
                          {t(locale, "restore")}
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </article>
          <aside className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-[var(--app-accent)]">
              {t(locale, "directoryRecord")}
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">
              {t(locale, "addMember")}
            </h2>
            <form action={addMember} className="mt-5 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  {t(locale, "firstName")}
                  <input
                    name="firstName"
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-600"
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  {t(locale, "lastName")}
                  <input
                    name="lastName"
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-600"
                  />
                </label>
              </div>
              <label className="block text-sm font-medium text-slate-700">
                {t(locale, "photo")}
                <input
                  name="photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="mt-1 block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                />
                <span className="mt-1 block text-xs font-normal text-slate-500">
                  {t(locale, "photoHelp")}
                </span>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                {t(locale, "dateOfBirth")}
                <input
                  name="dateOfBirth"
                  type="date"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-600"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                {t(locale, "membershipDate")}
                <input
                  name="membershipJoinedAt"
                  type="date"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-600"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                {t(locale, "phone")}
                <input
                  name="phone"
                  type="tel"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-600"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                {t(locale, "streetAddress")}
                <input
                  name="addressLine1"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-600"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                {t(locale, "addressLine2")}
                <input
                  name="addressLine2"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-600"
                />
              </label>
              <div className="grid gap-3 min-[380px]:grid-cols-[1fr_80px]">
                <label className="text-sm font-medium text-slate-700">
                  {t(locale, "city")}
                  <input
                    name="city"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-600"
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  {t(locale, "state")}
                  <input
                    name="state"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-600"
                  />
                </label>
              </div>
              <label className="block text-sm font-medium text-slate-700">
                {t(locale, "postalCode")}
                <input
                  name="postalCode"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-600"
                />
              </label>
              <button className="mt-2 w-full rounded-xl bg-[var(--app-brand)] px-4 py-3 font-semibold text-white shadow-sm hover:bg-[var(--app-brand-strong)]">
                {t(locale, "addMember")}
              </button>
            </form>
          </aside>
        </div>
      </section>
    </main>
  );
}
