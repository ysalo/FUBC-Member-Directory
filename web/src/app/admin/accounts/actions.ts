"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin, type AccountStatus, type AppRole } from "@/lib/auth";

const roles: AppRole[] = ["member", "editor", "admin"];
const statuses: AccountStatus[] = ["active", "denied", "revoked"];

export async function reviewAccount(targetId: string, formData: FormData) {
  const { supabase } = await requireAdmin();
  const role = String(formData.get("role") ?? "member") as AppRole;
  const status = String(formData.get("intent") ?? "active") as AccountStatus;
  const personId = String(formData.get("personId") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!roles.includes(role) || !statuses.includes(status))
    throw new Error("Invalid account review request.");
  const { error } = await supabase.rpc("review_account_designations", {
    target_id: targetId,
    new_status: status,
    new_role: role,
    new_person_id: personId,
    note,
    is_deacon: formData.get("isDeacon") === "on",
    is_pastor: formData.get("isPastor") === "on",
  });
  if (error) throw new Error(error.message || "Unable to update this account.");
  revalidatePath("/admin");
  revalidatePath("/admin/accounts");
  revalidatePath("/admin/groups");
  revalidatePath("/groups");
  revalidatePath("/groups/[id]", "page");
  revalidatePath("/");
}
