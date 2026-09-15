import type { DirectoryPerson } from "@/components/directory-client";
import type { createClient } from "@/lib/supabase/server";
import type { DeaconGroup } from "@/lib/group-copy";

type Client = Awaited<ReturnType<typeof createClient>>;

export async function loadDirectory(
  supabase: Client,
  ids?: string[],
): Promise<DirectoryPerson[]> {
  if (ids && !ids.length) return [];
  let query = supabase
    .from("people")
    .select(
      "id, first_name, last_name, date_of_birth, membership_joined_at, phone, address_line_1, address_line_2, city, state, postal_code, photo_path",
    )
    .is("archived_at", null)
    .order("last_name")
    .order("first_name");
  if (ids) query = query.in("id", ids);
  const { data: people, error } = await query;
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

  return members;
}

export async function loadDeaconGroups(
  supabase: Client,
  profileId?: string,
): Promise<DeaconGroup[]> {
  let visibleIds: string[] | undefined;
  if (profileId) {
    const { data, error } = await supabase
      .from("deacon_group_deacons")
      .select("group_id")
      .eq("profile_id", profileId);
    if (error) throw new Error("Unable to load deacon assignments.");
    visibleIds = (data ?? []).map((row) => row.group_id);
    if (!visibleIds.length) return [];
  }
  let query = supabase.from("deacon_groups").select("id, name").order("name");
  if (visibleIds) query = query.in("id", visibleIds);
  const [
    { data: groups, error },
    { data: assignments, error: membersError },
    { data: deacons, error: deaconsError },
  ] = await Promise.all([
    query,
    supabase.from("deacon_group_members").select("group_id, person_id"),
    supabase.rpc("list_group_deacons"),
  ]);
  if (error || membersError || deaconsError)
    throw new Error("Unable to load Deacon Groups.");
  return (groups ?? []).map((group) => ({
    ...group,
    memberIds: (assignments ?? [])
      .filter((row) => row.group_id === group.id)
      .map((row) => row.person_id),
    deacons: (
      (deacons ?? []) as {
        group_id: string;
        profile_id: string;
        display_name: string;
        status: string;
      }[]
    )
      .filter((row) => row.group_id === group.id)
      .map((row) => ({
        id: row.profile_id,
        name: row.display_name,
        status: row.status,
      })),
  }));
}
