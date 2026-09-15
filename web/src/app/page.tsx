import DirectoryClient, {
  type DirectoryPerson,
} from "@/components/directory-client";
import { requireActiveProfile } from "@/lib/auth";
import { getLocale } from "@/lib/locale";

export default async function DirectoryPage() {
  const { supabase, profile } = await requireActiveProfile();
  const locale = await getLocale();

  const { data: people, error } = await supabase
    .from("people")
    .select(
      "id, first_name, last_name, date_of_birth, membership_joined_at, phone, address_line_1, address_line_2, city, state, postal_code, photo_path",
    )
    .order("last_name")
    .order("first_name");
  if (error) throw new Error("Unable to load the directory.");

  const photoPaths = (people ?? []).flatMap((person) =>
    person.photo_path && !person.photo_path.startsWith("/")
      ? [person.photo_path]
      : [],
  );
  const { data: signedPhotos } = photoPaths.length
    ? await supabase.storage
        .from("member-photos")
        .createSignedUrls(photoPaths, 60 * 60)
    : { data: [] };
  const photoUrls = new Map(
    (signedPhotos ?? [])
      .filter((photo) => photo.signedUrl)
      .map((photo) => [photo.path, photo.signedUrl]),
  );

  const members: DirectoryPerson[] = (people ?? []).map((person) => ({
    id: person.id,
    firstName: person.first_name,
    lastName: person.last_name,
    name: `${person.first_name} ${person.last_name}`,
    phone: person.phone ?? "",
    dateOfBirth: person.date_of_birth ?? "",
    membershipJoinedAt: person.membership_joined_at ?? "",
    address: [
      person.address_line_1,
      person.address_line_2,
      [person.city, person.state].filter(Boolean).join(", "),
      person.postal_code,
    ]
      .filter(Boolean)
      .join(", "),
    photoPath: person.photo_path
      ? person.photo_path.startsWith("/")
        ? person.photo_path
        : (photoUrls.get(person.photo_path) ?? null)
      : null,
  }));

  return (
    <DirectoryClient members={members} role={profile.role} locale={locale} />
  );
}
