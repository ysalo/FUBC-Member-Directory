import type { Json } from "@/lib/database";
import { canManageAccounts } from "@/lib/permissions";
import { activeAccount, unwrap } from "@/lib/repository-helpers";
import { invalidateData, sessionCacheScope } from "@/lib/session-cache";
import { requireSupabase } from "@/lib/supabase";

export type AuditAction = {
  id: string; actor_id: string | null; actor_name: string | null;
  action: string; created_at: string; schema_version: number;
  restoration: "legacy" | "supported" | "irreversible";
  original_action_id: string | null; reason: string | null; change_count: number;
};
export type AuditChange = { id: number; entity: string; record_key: Json; before_data: Json; after_data: Json; subject_ids: string[] };
export type AuditFilters = { actor?: string; action?: string; subject?: string; from?: string; to?: string };
export type AuditPage<T> = { items: T[]; total: number };
export type RollbackPreview = {
  available: boolean; reasonCode?: string; reason: string | null; photoLimitations: boolean; total: number;
  conflicts: { code?: string; entity?: string; key?: Json; field: string; reason: string }[];
  changes: { entity: string; key: Json; fields: string[]; current: Json; proposed: Json }[];
};
async function protectedRead<T>(read: () => PromiseLike<{ data: Json | null; error: { message: string } | null }>): Promise<T> {
  if (!canManageAccounts(activeAccount())) throw new Error("Only active administrators can read audit history.");
  const scope = sessionCacheScope();
  const data = unwrap(await read());
  if (scope !== sessionCacheScope() || !canManageAccounts(activeAccount())) throw new Error("The audit session changed.");
  return data as T;
}
export const auditRepository = {
  history: (filters: AuditFilters, offset = 0) => protectedRead<AuditPage<AuditAction>>(() => requireSupabase().rpc("audit_history", { p_filters: filters, p_limit: 25, p_offset: offset })),
  details: (id: string, offset = 0) => protectedRead<AuditPage<AuditChange>>(() => requireSupabase().rpc("audit_action_details", { p_action_id: id, p_limit: 25, p_offset: offset })),
  preview: (id: string, offset = 0) => protectedRead<RollbackPreview>(() => requireSupabase().rpc("preview_audit_rollback", { p_action_id: id, p_limit: 25, p_offset: offset })),
  async rollback(id: string, operation: string, reason: string) {
    const result = await protectedRead<{ actionId: string }>(() => requireSupabase().rpc("execute_audit_rollback", { p_action_id: id, p_operation_id: operation, p_reason: reason }));
    invalidateData("directory", "groups", "duty", "visits", "photos", "accounts");
    return result;
  },
};
