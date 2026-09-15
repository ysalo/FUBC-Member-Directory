"use client";

import { MapPin, Phone, Search, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import SignOutButton from "@/components/sign-out-button";

export type DirectoryPerson = { id: string; name: string; phone: string; address: string; dateOfBirth: string; photoPath: string | null };
const gradients = ["from-sky-500 to-blue-700", "from-rose-400 to-fuchsia-700", "from-amber-400 to-orange-700", "from-emerald-400 to-teal-700", "from-violet-400 to-indigo-700"];
const initials = (name: string) => name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
const formatDate = (date: string) => date ? new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${date}T00:00:00`)) : "Not provided";

function Avatar({ person, large = false }: { person: DirectoryPerson; large?: boolean }) {
  const size = large ? "h-36 w-36 text-4xl ring-4 ring-white/70" : "h-12 w-12 text-base";
  const color = gradients[Number.parseInt(person.id.replace(/\D/g, "").slice(-2) || "0", 10) % gradients.length];
  return <div className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br ${color} font-semibold text-white shadow-sm ${size}`}>{person.photoPath ? <img src={person.photoPath} alt={`${person.name} profile`} className="h-full w-full object-cover" /> : initials(person.name)}</div>;
}

export default function DirectoryClient({ members, role }: { members: DirectoryPerson[]; role: "member" | "editor" | "admin" }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<DirectoryPerson | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? members.filter((person) => [person.name, person.phone, person.address, person.dateOfBirth].some((value) => value.toLowerCase().includes(term))) : members;
  }, [members, query]);

  if (selected) return (
    <main className="safe-page min-h-dvh bg-slate-100 sm:p-6">
      <section className="mx-auto min-h-screen max-w-xl overflow-hidden bg-white shadow-xl sm:min-h-0 sm:rounded-3xl">
        <div className="relative h-72 overflow-hidden bg-gradient-to-br from-sky-500 to-blue-700 sm:h-80">
          {selected.photoPath ? <button onClick={() => setPhotoOpen(true)} aria-label={`View ${selected.name}'s photo full screen`} className="block h-full w-full cursor-zoom-in"><img src={selected.photoPath} alt={`${selected.name} profile`} className="h-full w-full object-cover" /></button> : <div className="grid h-full place-items-center"><Avatar person={selected} large /></div>}
          <button onClick={() => { setPhotoOpen(false); setSelected(null); }} aria-label="Back to Directory" className="absolute left-4 top-4 grid size-11 place-items-center rounded-full bg-black/40 text-2xl font-semibold text-white backdrop-blur hover:bg-black/55">←</button>
        </div>
        <div className="px-6 pb-10 pt-7"><p className="text-sm font-medium text-slate-500">Member profile</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{selected.name}</h1><div className="mt-7 divide-y divide-slate-200 border-y border-slate-200">{selected.phone && <a href={`tel:${selected.phone.replace(/\D/g, "")}`} className="flex gap-4 py-5 hover:bg-slate-50"><Phone className="mt-1 size-5 text-blue-600" /><span><span className="block text-sm text-slate-500">Phone</span><span className="text-lg font-medium text-blue-700">{selected.phone}</span></span></a>}{selected.address && <a href={`https://maps.apple.com/?q=${encodeURIComponent(selected.address)}`} target="_blank" rel="noreferrer" className="flex gap-4 py-5 hover:bg-slate-50"><MapPin className="mt-1 size-5 text-blue-600" /><span><span className="block text-sm text-slate-500">Address</span><span className="text-lg font-medium text-blue-700">{selected.address}</span></span></a>}<div className="flex gap-4 py-5"><span className="mt-1 grid size-5 place-items-center rounded-full border border-slate-300 text-xs text-slate-600">i</span><span><span className="block text-sm text-slate-500">Date of birth</span><span className="text-lg font-medium text-slate-900">{formatDate(selected.dateOfBirth)}</span></span></div></div></div>
      </section>
      {photoOpen && selected.photoPath && <div role="dialog" aria-modal="true" aria-label={`${selected.name} profile photo`} onClick={() => setPhotoOpen(false)} className="fixed inset-0 z-50 grid cursor-zoom-out place-items-center bg-black/95 p-4"><button onClick={() => setPhotoOpen(false)} aria-label="Close full-screen photo" className="absolute right-5 top-5 grid size-11 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"><X className="size-6" /></button><img src={selected.photoPath} alt={`${selected.name} profile`} onClick={(event) => event.stopPropagation()} className="max-h-full max-w-full cursor-default object-contain" /></div>}
    </main>
  );

  return <main className="safe-page min-h-dvh bg-slate-100 sm:p-6"><section className="mx-auto min-h-dvh max-w-xl bg-white shadow-xl sm:min-h-0 sm:overflow-hidden sm:rounded-3xl"><header className="safe-top sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-5 pb-4 pt-6 backdrop-blur"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-sm font-medium text-blue-700">Private access</p><h1 className="truncate text-2xl font-bold tracking-tight text-slate-950">Member Directory</h1></div><div className="flex shrink-0 gap-2">{role !== "member" && <Link href="/admin" className="inline-flex min-h-11 items-center rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200">Manage</Link>}<SignOutButton compact /></div></div><label className="relative mt-5 block"><Search className="absolute left-3 top-3 size-5 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, phone, address, or DOB" className="w-full rounded-xl border border-transparent bg-slate-100 py-3 pl-10 pr-10 text-base outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100" />{query && <button onClick={() => setQuery("")} className="absolute right-2 top-1 grid size-11 place-items-center text-slate-400 hover:text-slate-700" aria-label="Clear search"><X className="size-5" /></button>}</label></header><p className="px-5 py-3 text-sm text-slate-500">{query ? `${results.length} result${results.length === 1 ? "" : "s"}` : `${members.length} members`}</p><div className="divide-y divide-slate-100">{results.map((person) => <button key={person.id} onClick={() => setSelected(person)} className="flex min-h-16 w-full items-center gap-3 px-5 py-3 text-left hover:bg-blue-50"><Avatar person={person} /><span className="min-w-0 flex-1"><span className="block truncate text-[17px] font-semibold text-slate-900">{person.name}</span><span className="block truncate text-sm text-slate-500">{query.match(/\d/) ? person.phone : person.address}</span></span><span className="text-2xl text-slate-300">›</span></button>)}</div>{!results.length && <div className="px-5 py-16 text-center text-slate-500">No members have been added yet.</div>}<footer className="safe-bottom flex items-center gap-2 px-5 py-6 text-xs text-slate-400"><ShieldCheck className="size-4" /> Directory data is visible only to approved accounts.</footer></section></main>;
}
