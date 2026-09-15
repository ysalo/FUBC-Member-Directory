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
        time = visitTimeToIso(value("time"));
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
    if (result.error)
      return {
        error: result.error.message.includes("future visit time")
          ? copy.future
          : copy.failed,
      };
  } catch {
    return { error: copy.failed };
  }
  revalidatePath("/visitation", "layout");
  return { id: typeof result.data === "string" ? result.data : undefined };
}

export async function pendingVisitCount(): Promise<number | null> {
  const { supabase, profile } = await requireActiveProfile();
  const pastor = profile.ministry_roles.includes("pastor");
  const deacon = profile.ministry_roles.includes("deacon");
  try {
    const queries = [];
    if (pastor)
      queries.push(
        supabase
          .from("visit_requests")
          .select("id,visit_recipients!inner(response)", {
            count: "exact",
            head: true,
          })
          .eq("status", "open")
          .eq("pastor_id", profile.id)
          .eq("visit_recipients.response", "pending"),
      );
    if (deacon) {
      let query = supabase
        .from("visit_recipients")
        .select("request_id,visit_requests!inner(status,pastor_id)", {
          count: "exact",
          head: true,
        })
        .eq("deacon_id", profile.id)
        .eq("response", "pending")
        .eq("visit_requests.status", "open");
      if (pastor) query = query.neq("visit_requests.pastor_id", profile.id);
      queries.push(query);
    }
    const results = await Promise.all(queries);
    if (results.some((r) => r.error || r.count === null)) return null;
    return results.reduce((total, r) => total + (r.count ?? 0), 0);
  } catch {
    return null;
  }
}
