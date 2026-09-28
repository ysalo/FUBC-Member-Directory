import type { ImageSourcePropType } from "react-native";
import type { Json } from "@/lib/database";
import { activeAccount, privatePhotoSources } from "@/lib/repository-helpers";
import { requireSupabase } from "@/lib/supabase";
import { invalidateData } from "@/lib/session-cache";

export type FamilyFailureKind = "conflict" | "spouse" | "cycle" | "self" | "unknown";
function repositoryError(error: { message: string; code: string }): Error & { code: string; kind: FamilyFailureKind } {
  const kinds: Record<string, FamilyFailureKind> = { "40001": "conflict", FM001: "spouse", FM002: "cycle", FM003: "self" };
  return Object.assign(new Error(error.message), { code: error.code, kind: kinds[error.code] ?? "unknown" });
}
export type FamilyMember = { id: string; name: string; archived: boolean; photo: ImageSourcePropType };
export type FamilySibling = FamilyMember & { explicit: boolean; supportingParents: FamilyMember[] };
export type FamilySnapshot = { memberId: string; revision: number; parents: FamilyMember[]; spouse: FamilyMember | null; children: FamilyMember[]; siblings: FamilySibling[] };
export type FamilyChanges = { parentIds: string[]; spouseId: string | null; childIds: string[]; siblingIds: string[] };
type StoredMember = Omit<FamilyMember, "photo"> & { photoPath: string | null };
type StoredSnapshot = Omit<FamilySnapshot, "parents" | "spouse" | "children" | "siblings"> & {
  parents: StoredMember[]; spouse: StoredMember | null; children: StoredMember[];
  siblings: (StoredMember & { explicit: boolean; supportingParents: StoredMember[] })[];
};
export function emptyFamily(memberId: string): FamilySnapshot {
  return { memberId, revision: 0, parents: [], spouse: null, children: [], siblings: [] };
}
async function hydrate(value: Json): Promise<FamilySnapshot> {
  const data = value as unknown as StoredSnapshot;
  const relatives = [...data.parents, ...data.children, ...data.siblings, ...(data.spouse ? [data.spouse] : []), ...data.siblings.flatMap((sibling) => sibling.supportingParents)];
  const photos = await privatePhotoSources(relatives.map((member) => member.photoPath)).catch(() => new Map<string, ImageSourcePropType>());
  const member = (row: StoredMember): FamilyMember => ({ id: row.id, name: row.name, archived: row.archived, photo: row.photoPath ? photos.get(row.photoPath) ?? {} : {} });
  return { memberId: data.memberId, revision: data.revision, parents: data.parents.map(member), children: data.children.map(member), spouse: data.spouse ? member(data.spouse) : null, siblings: data.siblings.map((row) => ({ ...member(row), explicit: row.explicit, supportingParents: row.supportingParents.map(member) })) };
}
export async function loadFamily(memberId: string, manage = true): Promise<FamilySnapshot> {
  activeAccount();
  const { data, error } = await requireSupabase().rpc("member_family", { p_person_id: memberId, p_manage: manage });
  if (error) throw repositoryError(error);
  return hydrate(data);
}
export const loadProfileFamily = (memberId: string) => loadFamily(memberId, false);
export async function saveFamily(memberId: string, revision: number, changes: FamilyChanges): Promise<FamilySnapshot> {
  activeAccount();
  const { data, error } = await requireSupabase().rpc("save_member_family", { p_person_id: memberId, p_revision: revision, p_parent_ids: changes.parentIds, p_spouse_id: changes.spouseId, p_child_ids: changes.childIds, p_sibling_ids: changes.siblingIds });
  if (error) throw repositoryError(error);
  invalidateData("directory");
  return hydrate(data);
}
