"use server";

import { revalidatePath } from "next/cache";
import { requireEditor } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { groupCopy } from "@/lib/group-copy";

export async function mutateGroup(
  operation: "save" | "assign" | "delete",
  form: FormData,
): Promise<{ error?: string }> {
  const { supabase } = await requireEditor();
  const copy = groupCopy(await getLocale());
  const id = (name: string) => String(form.get(name) ?? "").trim() || null;
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const fields = [
    "groupId",
    "personId",
    "expectedGroup",
    "firstDeacon",
    "secondDeacon",
  ];
  if (fields.some((field) => id(field) && !uuid.test(id(field)!)))
    return { error: copy.failed };
  let result;
  if (operation === "save") {
    result = await supabase.rpc("save_deacon_group", {
      target_group: id("groupId"),
      group_name: String(form.get("name") ?? "").trim(),
      deacon_ids: [id("firstDeacon"), id("secondDeacon")].filter(Boolean),
    });
  } else if (operation === "assign" && id("personId")) {
    result = await supabase.rpc("assign_deacon_group_member", {
      target_person: id("personId"),
      target_group: id("groupId"),
      expected_group: id("expectedGroup"),
    });
  } else if (operation === "delete" && id("groupId")) {
    result = await supabase.rpc("delete_deacon_group", {
      target_group: id("groupId"),
    });
  } else return { error: copy.failed };
  if (result.error) {
    const message = result.error.message;
    const error = message.includes("Assignment changed")
      ? copy.stale
      : message.includes("two distinct")
        ? copy.invalidDeacons
        : message.includes("designated deacons")
          ? copy.activeRequired
          : message.includes("Remove all")
            ? copy.emptyRequired
            : message.includes("Group name")
              ? copy.invalidName
              : copy.failed;
    return { error };
  }
  revalidatePath("/admin/groups");
  revalidatePath("/groups");
  return {};
}
