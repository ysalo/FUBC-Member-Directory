import Link from "next/link";
import { addMember, archiveMember, restoreMember } from "./actions";
import { requireEditor } from "@/lib/auth";

export default async function AdminPage() {
  const { supabase, profile } = await requireEditor();

  const { data: people, error } = await supabase
    .from("people")
    .select("id, first_name, last_name, phone, city, state, archived_at")
    .order("last_name")
    .order("first_name");
  if (error) throw new Error("Unable to load member records.");
  const activePeople = (people ?? []).filter((person) => !person.archived_at);
  const archivedPeople = (people ?? []).filter((person) => person.archived_at);
  const { count: pendingCount } = profile.role === "admin"
    ? await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "pending")
    : { count: 0 };

  return (
    <main className="safe-page min-h-dvh bg-slate-100 p-4 sm:p-8">
      <section className="mx-auto max-w-6xl">
        <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center">
          <div><p className="font-medium text-blue-700">Private Directory</p><h1 className="text-3xl font-bold tracking-tight text-slate-950">{profile.role === "admin" ? "Admin Portal" : "Editor Portal"}</h1></div>
          <div className="flex flex-col gap-2 min-[380px]:flex-row">{profile.role === "admin" && <Link href="/admin/accounts" className="min-h-11 rounded-xl bg-blue-50 px-4 py-2.5 text-center font-semibold text-blue-700 hover:bg-blue-100">Account requests{pendingCount ? ` (${pendingCount})` : ""}</Link>}<Link href="/" className="min-h-11 rounded-xl bg-slate-900 px-4 py-2.5 text-center font-semibold text-white hover:bg-slate-800">View directory</Link></div>
        </header>
        <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <article className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-end justify-between gap-4"><div><p className="text-sm font-medium text-slate-500">Directory records</p><h2 className="mt-1 text-3xl font-bold text-slate-950">{activePeople.length}</h2></div><span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">Live data</span></div>
            <div className="mt-6 divide-y divide-slate-100 border-y border-slate-100">
              {activePeople.map((person) => <div key={person.id} className="flex flex-col gap-3 py-4 min-[430px]:flex-row min-[430px]:items-center min-[430px]:justify-between"><div className="min-w-0"><p className="truncate font-semibold text-slate-900">{person.first_name} {person.last_name}</p><p className="truncate text-sm text-slate-500">{[person.phone, [person.city, person.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ") || "No contact details yet"}</p></div><div className="flex shrink-0 items-center gap-2"><Link href={`/admin/${person.id}`} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100">Edit</Link><form action={archiveMember.bind(null, person.id)} className="flex-1"><button className="min-h-11 w-full rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-red-50 hover:text-red-700">Archive</button></form></div></div>)}
              {!activePeople.length && <p className="py-12 text-center text-slate-500">Add the first directory record using the form.</p>}
            </div>
            {archivedPeople.length > 0 && <div className="mt-8"><h3 className="font-semibold text-slate-900">Archived ({archivedPeople.length})</h3><div className="mt-2 divide-y divide-slate-100 border-y border-slate-100">{archivedPeople.map((person) => <div key={person.id} className="flex items-center justify-between gap-4 py-3"><Link href={`/admin/${person.id}`} className="font-medium text-slate-500 hover:text-blue-700">{person.first_name} {person.last_name}</Link><form action={restoreMember.bind(null, person.id)}><button className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200">Restore</button></form></div>)}</div></div>}
          </article>
          <aside className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-blue-700">Directory record</p><h2 className="mt-1 text-xl font-bold text-slate-950">Add member</h2>
            <form action={addMember} className="mt-5 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700">First name<input name="firstName" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-600" /></label><label className="text-sm font-medium text-slate-700">Last name<input name="lastName" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-600" /></label></div>
              <label className="block text-sm font-medium text-slate-700">Photo<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="mt-1 block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-semibold file:text-blue-700 hover:file:bg-blue-100" /><span className="mt-1 block text-xs font-normal text-slate-500">JPG, PNG, or WebP · maximum 5 MB</span></label>
              <label className="block text-sm font-medium text-slate-700">Date of birth<input name="dateOfBirth" type="date" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-600" /></label>
              <label className="block text-sm font-medium text-slate-700">Phone<input name="phone" type="tel" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-600" /></label>
              <label className="block text-sm font-medium text-slate-700">Street address<input name="addressLine1" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-600" /></label>
              <div className="grid gap-3 min-[380px]:grid-cols-[1fr_80px]"><label className="text-sm font-medium text-slate-700">City<input name="city" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-600" /></label><label className="text-sm font-medium text-slate-700">State<input name="state" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-600" /></label></div>
              <label className="block text-sm font-medium text-slate-700">Postal code<input name="postalCode" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-600" /></label>
              <button className="mt-2 w-full rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800">Add member</button>
            </form>
          </aside>
        </div>
      </section>
    </main>
  );
}
