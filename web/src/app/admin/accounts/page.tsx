import Link from "next/link";
import {
  requireAdmin,
  type AccountProfile,
  type AccountStatus,
} from "@/lib/auth";
import { reviewAccount } from "./actions";
import LanguageSwitcher from "@/components/language-switcher";
import { t, type TranslationKey } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

const sectionKeys: {
  status: AccountStatus;
  title: TranslationKey;
  description: TranslationKey;
}[] = [
  {
    status: "pending",
    title: "pendingRequests",
    description: "pendingDescription",
  },
  {
    status: "active",
    title: "activeAccounts",
    description: "activeDescription",
  },
  {
    status: "denied",
    title: "deniedRequests",
    description: "deniedDescription",
  },
  {
    status: "revoked",
    title: "revokedAccounts",
    description: "revokedDescription",
  },
];

export default async function AccountsPage() {
  const locale = await getLocale();
  const { supabase } = await requireAdmin();
  const [{ data: profileRows, error }, { data: people }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at"),
    supabase
      .from("people")
      .select("id, first_name, last_name, archived_at")
      .is("archived_at", null)
      .order("last_name")
      .order("first_name"),
  ]);
  if (error) throw new Error("Unable to load account requests.");
  const profiles = (profileRows ?? []) as AccountProfile[];

  return (
    <main className="safe-page min-h-dvh bg-slate-100 p-4 sm:p-8">
      <section className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 min-[430px]:flex-row min-[430px]:items-center">
          <Link
            href="/admin"
            aria-label={t(locale, "backToManagement")}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-2xl font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            ←
          </Link>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-blue-700">
              {t(locale, "administratorOnly")}
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
              {t(locale, "accountAccess")}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {t(locale, "accountAccessHelp")}
            </p>
          </div>
          <LanguageSwitcher locale={locale} />
        </header>
        <div className="mt-8 space-y-8">
          {sectionKeys.map((section) => {
            const accounts = profiles.filter(
              (profile) => profile.status === section.status,
            );
            return (
              <section key={section.status}>
                <div>
                  <h2 className="text-xl font-bold text-slate-950">
                    {t(locale, section.title)} ({accounts.length})
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {t(locale, section.description)}
                  </p>
                </div>
                <div className="mt-3 space-y-3">
                  {accounts.map((account) => (
                    <form
                      key={account.id}
                      action={reviewAccount.bind(null, account.id)}
                      className="rounded-2xl bg-white p-4 shadow-sm sm:p-5"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="grid size-11 shrink-0 place-items-center rounded-full bg-blue-100 font-bold text-blue-700">
                          {(account.display_name || account.email)
                            .slice(0, 1)
                            .toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">
                            {account.display_name ||
                              t(locale, "unnamedAccount")}
                          </p>
                          <p className="truncate text-sm text-slate-500">
                            {account.email}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">
                            {account.provider} · {t(locale, "requested")}{" "}
                            {new Intl.DateTimeFormat(
                              locale === "uk" ? "uk-UA" : "en-US",
                              { dateStyle: "medium" },
                            ).format(new Date(account.created_at))}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <label className="text-sm font-medium text-slate-700">
                          {t(locale, "role")}
                          <select
                            name="role"
                            defaultValue={account.role}
                            className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3"
                          >
                            <option value="member">
                              {t(locale, "roleMember")}
                            </option>
                            <option value="editor">
                              {t(locale, "roleEditor")}
                            </option>
                            <option value="admin">
                              {t(locale, "roleAdmin")}
                            </option>
                          </select>
                        </label>
                        <label className="text-sm font-medium text-slate-700">
                          {t(locale, "directoryMemberOptional")}
                          <select
                            name="personId"
                            defaultValue={account.person_id ?? ""}
                            className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3"
                          >
                            <option value="">{t(locale, "notLinked")}</option>
                            {(people ?? []).map((person) => (
                              <option key={person.id} value={person.id}>
                                {person.first_name} {person.last_name}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <label className="mt-3 block text-sm font-medium text-slate-700">
                        {t(locale, "internalNote")}
                        <input
                          name="note"
                          defaultValue={account.decision_note ?? ""}
                          className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3"
                        />
                      </label>
                      <div className="mt-4 flex flex-col-reverse gap-2 min-[380px]:flex-row min-[380px]:justify-end">
                        {section.status === "pending" && (
                          <button
                            name="intent"
                            value="denied"
                            className="min-h-11 rounded-xl px-4 font-semibold text-red-700 hover:bg-red-50"
                          >
                            {t(locale, "deny")}
                          </button>
                        )}
                        {section.status === "active" && (
                          <button
                            name="intent"
                            value="revoked"
                            className="min-h-11 rounded-xl px-4 font-semibold text-red-700 hover:bg-red-50"
                          >
                            {t(locale, "revoke")}
                          </button>
                        )}
                        <button
                          name="intent"
                          value="active"
                          className="min-h-11 rounded-xl bg-blue-700 px-4 font-semibold text-white hover:bg-blue-800"
                        >
                          {section.status === "active"
                            ? t(locale, "saveAccess")
                            : t(locale, "approveAccess")}
                        </button>
                      </div>
                    </form>
                  ))}
                  {!accounts.length && (
                    <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                      {t(locale, "noAccounts")}
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </section>
    </main>
  );
}
