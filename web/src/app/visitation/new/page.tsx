import { redirect, notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { requireActiveProfile } from "@/lib/auth";
import { loadDirectory } from "@/lib/directory-data";
import { getLocale } from "@/lib/locale";
import VisitForm from "@/components/visit-form";
import { visitCopy, type VisitDeacon } from "@/lib/visitation";
export default async function NewVisit({
  searchParams,
}: {
  searchParams: Promise<{ person?: string }>;
}) {
  const { supabase, profile } = await requireActiveProfile();
  if (!profile.ministry_roles.includes("pastor")) redirect("/visitation");
  const { person } = await searchParams;
  if (!person || !/^[0-9a-f-]{36}$/i.test(person)) notFound();
  const [members, result, locale] = await Promise.all([
    loadDirectory(supabase, [person]),
    supabase.rpc("list_visit_deacons"),
    getLocale(),
  ]);
  if (result.error) throw new Error("Unable to load deacons");
  const member = members[0];
  if (!member) notFound();
  return (
    <>
      <h1 className="py-5 text-2xl font-semibold">
        {visitCopy(locale).request}
      </h1>
      <VisitForm
        member={member}
        deacons={(result.data ?? []) as VisitDeacon[]}
        locale={locale}
        submission={randomUUID()}
      />
    </>
  );
}
