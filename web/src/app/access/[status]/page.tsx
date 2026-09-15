import { redirect } from "next/navigation";
import LanguageSwitcher from "@/components/language-switcher";
import SignOutButton from "@/components/sign-out-button";
import {
  accessPath,
  getAuthenticatedProfile,
  type AccountStatus,
} from "@/lib/auth";
import { dictionaries } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export default async function AccessStatusPage({
  params,
}: {
  params: Promise<{ status: string }>;
}) {
  const { status } = await params;
  const locale = await getLocale();
  const copy = dictionaries[locale];
  const { profile } = await getAuthenticatedProfile();
  if (!profile) redirect("/login");
  if (profile.status === "active") redirect("/");
  if (status !== profile.status) redirect(accessPath(profile.status));
  const content = {
    pending: { title: copy.requestReceived, body: copy.pendingBody },
    denied: { title: copy.requestDenied, body: copy.deniedBody },
    revoked: { title: copy.accessRevoked, body: copy.revokedBody },
  };
  const message = content[status as Exclude<AccountStatus, "active">];
  if (!message) redirect(accessPath(profile.status));
  return (
    <main className="safe-page grid min-h-dvh place-items-center p-5">
      <section className="native-enter native-shadow w-full max-w-md rounded-[2rem] border border-white/80 bg-white/95 p-7 text-center backdrop-blur">
        <div className="flex justify-end">
          <LanguageSwitcher locale={locale} />
        </div>
        <div className="mx-auto mt-2 grid size-14 place-items-center rounded-full bg-[var(--app-brand-soft)] text-2xl text-[var(--app-brand)]">
          ✓
        </div>
        <p className="mt-6 text-sm font-semibold text-[var(--app-accent)]">
          {copy.privateDirectory}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
          {message.title}
        </h1>
        <p className="mt-3 leading-7 text-slate-600">{message.body}</p>
        <p className="mt-5 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
          {copy.signedInAs} {profile.email}
        </p>
        <div className="mt-6">
          <SignOutButton label={copy.signOut} loadingLabel={copy.signingOut} />
        </div>
      </section>
    </main>
  );
}
