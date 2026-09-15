import { redirect } from "next/navigation";
import SignOutButton from "@/components/sign-out-button";
import { accessPath, getAuthenticatedProfile, type AccountStatus } from "@/lib/auth";

const content = {
  pending: { title: "Request received", body: "An administrator needs to approve your account before you can view the directory." },
  denied: { title: "Request not approved", body: "Your account request was reviewed but was not approved. Contact a directory administrator if you think this is a mistake." },
  revoked: { title: "Access revoked", body: "This account no longer has access to the directory. Contact a directory administrator for help." },
};

export default async function AccessStatusPage({ params }: { params: Promise<{ status: string }> }) {
  const { status } = await params;
  const { profile } = await getAuthenticatedProfile();
  if (!profile) redirect("/login");
  if (profile.status === "active") redirect("/");
  if (status !== profile.status) redirect(accessPath(profile.status));
  const message = content[status as Exclude<AccountStatus, "active">];
  if (!message) redirect(accessPath(profile.status));
  return <main className="safe-page grid min-h-dvh place-items-center bg-slate-100 p-5"><section className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-xl"><div className="mx-auto grid size-14 place-items-center rounded-full bg-blue-50 text-2xl text-blue-700">✓</div><p className="mt-6 text-sm font-semibold text-blue-700">Private Directory</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{message.title}</h1><p className="mt-3 leading-7 text-slate-600">{message.body}</p><p className="mt-5 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">Signed in as {profile.email}</p><div className="mt-6"><SignOutButton /></div></section></main>;
}
