import Link from "@/components/navigation-link";
import { notFound } from "next/navigation";
import { requireEditor } from "@/lib/auth";
import { updateMember } from "../actions";
import BackButton from "@/components/back-button";
import VisitMemberLink from "@/components/visit-member-link";
import { loadVisitPhotos } from "@/lib/visit-photos";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import MemberStatusFields from "@/components/member-status-fields";

export default async function EditMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const { supabase } = await requireEditor();

  const { data: person, error } = await supabase
    .from("people")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !person) notFound();
  const photos = await loadVisitPhotos(supabase, [person.id]);
  const updateAction = updateMember.bind(null, id);
  const inputClass =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-600";

  return (
    <main className="safe-page min-h-dvh p-4 sm:p-8">
      <section className="native-enter mx-auto max-w-2xl">
        <header className="flex items-start gap-3 border-b border-slate-200 pb-6 sm:items-center sm:gap-4">
          <BackButton href="/admin" label={t(locale, "backToManagement")} />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-[var(--app-accent)]">
              {t(locale, "directoryRecord")}
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              {t(locale, "editMember")}{" "}
              <VisitMemberLink
                personId={person.archived_at ? null : person.id}
                name={`${person.first_name} ${person.last_name}`}
                photoPath={photos.get(person.id)}
                showPhoto
                locale={locale}
              />
            </h1>
          </div>
        </header>
        <form
          action={updateAction}
          className="mt-6 space-y-4 rounded-2xl bg-white p-5 shadow-sm sm:mt-8 sm:p-8"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              {t(locale, "firstName")}
              <input
                name="firstName"
                required
                defaultValue={person.first_name}
                className={inputClass}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              {t(locale, "lastName")}
              <input
                name="lastName"
                required
                defaultValue={person.last_name}
                className={inputClass}
              />
            </label>
          </div>
          <label className="block text-sm font-medium text-slate-700">
            {t(locale, "replacementPhoto")}
            <input
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="mt-1 block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
            />
            <span className="mt-1 block text-xs font-normal text-slate-500">
              {t(locale, "replacementPhotoHelp")}
            </span>
          </label>
          {person.photo_path && (
            <label className="flex min-h-11 items-center gap-2 text-sm text-slate-600">
              <input name="removePhoto" type="checkbox" className="size-4" />{" "}
              {t(locale, "removePhoto")}
            </label>
          )}
          <label className="block text-sm font-medium text-slate-700">
            {t(locale, "dateOfBirth")}
            <input
              name="dateOfBirth"
              type="date"
              defaultValue={person.date_of_birth ?? ""}
              className={inputClass}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            {t(locale, "membershipDate")}
            <input
              name="membershipJoinedAt"
              type="date"
              defaultValue={person.membership_joined_at ?? ""}
              className={inputClass}
            />
          </label>
          <MemberStatusFields
            locale={locale}
            maritalStatus={person.marital_status}
            isOrphan={person.is_orphan}
          />
          <label className="block text-sm font-medium text-slate-700">
            {t(locale, "phone")}
            <input
              name="phone"
              type="tel"
              defaultValue={person.phone ?? ""}
              className={inputClass}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            {t(locale, "streetAddress")}
            <input
              name="addressLine1"
              defaultValue={person.address_line_1 ?? ""}
              className={inputClass}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            {t(locale, "addressLine2")}
            <input
              name="addressLine2"
              defaultValue={person.address_line_2 ?? ""}
              className={inputClass}
            />
          </label>
          <div className="grid gap-3 min-[380px]:grid-cols-[1fr_90px]">
            <label className="text-sm font-medium text-slate-700">
              {t(locale, "city")}
              <input
                name="city"
                defaultValue={person.city ?? ""}
                className={inputClass}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              {t(locale, "state")}
              <input
                name="state"
                defaultValue={person.state ?? ""}
                className={inputClass}
              />
            </label>
          </div>
          <label className="block text-sm font-medium text-slate-700">
            {t(locale, "postalCode")}
            <input
              name="postalCode"
              defaultValue={person.postal_code ?? ""}
              className={inputClass}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            {t(locale, "notes")}
            <textarea
              name="notes"
              rows={4}
              defaultValue={person.notes ?? ""}
              className={inputClass}
            />
          </label>
          <div className="flex flex-col-reverse gap-2 pt-2 min-[380px]:flex-row min-[380px]:justify-end">
            <Link
              href="/admin"
              className="min-h-11 rounded-xl px-4 py-3 text-center font-semibold text-slate-600 hover:bg-slate-100"
            >
              {t(locale, "cancel")}
            </Link>
            <button className="min-h-11 rounded-xl bg-[var(--app-brand)] px-5 py-3 font-semibold text-white shadow-sm hover:bg-[var(--app-brand-strong)]">
              {t(locale, "saveChanges")}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
