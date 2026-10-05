import { activeAccount } from "@/lib/repository-helpers";
import { canManageAccounts } from "@/lib/permissions";
import { requireSupabase } from "@/lib/supabase";
import { invalidateData } from "@/lib/session-cache";
import { refreshSession } from "@/lib/session";
export { parseMemberCsv, MemberCsvError, memberCsvColumns } from "../../../supabase/functions/_shared/member-csv";
export type { MemberImportRow } from "../../../supabase/functions/_shared/member-csv";

export class MemberImportError extends Error {
  outcome: "rejected" | "uncertain";
  constructor(message: string, outcome: "rejected" | "uncertain") { super(message); this.outcome = outcome; }
}
export type MemberImportResult = { importId: string; importedCount: number; replacedCount: number; pendingPhotos: number; status: "completed" | "cleanup-pending" };
export function newMemberImportId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, char => {
    const random = Math.floor(Math.random() * 16);
    return (char === "x" ? random : (random & 3) | 8).toString(16);
  });
}
export async function importMemberCsv(request: { action: "import"; importId: string; csv: string; mode: "add" | "replace"; confirmation: string } | { action: "retry-cleanup"; importId: string }): Promise<MemberImportResult> {
  if (!canManageAccounts(activeAccount())) throw new Error("Only active administrators can import members.");
  const { data, error } = await requireSupabase().functions.invoke("import-members", { body: request });
  if (error) {
    const context = "context" in error && error.context && typeof error.context === "object" ? error.context as Response : null;
    const payload = context && "json" in context ? await context.json().catch(() => null) : null;
    throw new MemberImportError(payload?.message ?? "The response was not confirmed. Retry this import; it will not create duplicates.", context && context.status < 500 && payload?.status === "failed" ? "rejected" : "uncertain");
  }
  if (!["completed", "cleanup-pending"].includes(data?.status) || data.importId !== request.importId || !Number.isInteger(data.importedCount) || !Number.isInteger(data.replacedCount) || !Number.isInteger(data.pendingPhotos)) throw new Error("The import response was not confirmed. Retry this import.");
  invalidateData("directory", "groups", "duty", "visits", "photos", "accounts");
  // The caller's member link/revision changed on replacement. Import has already
  // committed; session refresh failure must not turn success into an import retry.
  await refreshSession().catch(() => {});
  return data;
}
