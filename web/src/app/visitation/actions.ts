"use server";
import { requireActiveProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getLocale } from "@/lib/locale";
import { visitCopy, visitTimeToIso } from "@/lib/visitation";
export async function mutateVisit(
  operation: "save" | "respond" | "close" | "view",
  form: FormData,
): Promise<{ id?: string; error?: string }> {
  const { supabase } = await requireActiveProfile();
  const copy = visitCopy(await getLocale());
  const value = (key: string) => String(form.get(key) ?? "");
  let result;
  try {
    if (operation === "save") {
      let time: string;
      try {
        time = visitTimeToIso(
          value("time"),
          process.env.CHURCH_TIMEZONE || "America/Los_Angeles",
        );
      } catch {
        return { error: copy.future };
      }
      result = await supabase.rpc("save_visit", {
        target: value("id") || null,
        expected_revision: Number(value("revision")) || null,
        target_person: value("personId") || null,
        visit_location: value("location"),
        visit_time: time,
        visit_notes: value("notes"),
        deacon_ids: form.getAll("deacon").map(String),
        submission: value("submission") || null,
      });
    } else if (operation === "respond")
      result = await supabase.rpc("respond_visit", {
        target: value("id"),
        decision: value("decision"),
        reason: value("reason"),
        expected_revision: Number(value("revision")),
      });
    else if (operation === "close")
      result = await supabase.rpc("close_visit", {
        target: value("id"),
        decision: value("decision"),
        expected_revision: Number(value("revision")),
      });
    else
      result = await supabase.rpc("view_visit", {
        target: value("id"),
        seen_revision: Number(value("revision")),
      });
    if (result.error) return { error: copy.failed };
  } catch {
    return { error: copy.failed };
  }
  revalidatePath("/visitation", "layout");
  return { id: typeof result.data === "string" ? result.data : undefined };
}
