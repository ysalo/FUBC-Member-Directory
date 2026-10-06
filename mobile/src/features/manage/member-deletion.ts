import { requireSupabase } from "@/lib/supabase";
import { invalidateData } from "@/lib/session-cache";

export type DeleteMemberRequest = {
  personId: string;
  expectedRevision: number;
  confirmation: string;
  permanent?: boolean;
};

export type DeleteMemberResult = {
  deletedPersonId: string;
  deletedAccountId: string | null;
  deletedVisitCount: number;
  cleanupWarning?: string;
};

export class MemberDeletionError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "MemberDeletionError";
  }
}

export async function deleteMembers(requests: readonly DeleteMemberRequest[]) {
  const completed: DeleteMemberResult[] = [];
  for (const request of requests) {
    try {
      completed.push(await deleteMember(request));
    } catch (cause) {
      return { completed, failedPersonId: request.personId, error: cause instanceof MemberDeletionError ? cause.code : "unexpected" };
    }
  }
  return { completed, failedPersonId: null, error: null };
}

export async function deleteMember(request: DeleteMemberRequest): Promise<DeleteMemberResult> {
  const client = requireSupabase();
  const { data, error } = request.permanent
    ? await client.functions.invoke("delete-member", { body: request })
    : await client.functions.invoke("remove-member", { body: request });
  if (error) {
    const context = "context" in error && error.context && typeof error.context === "object" ? error.context as Response : null;
    const payload = context && "json" in context ? await context.json().catch(() => null) : null;
    throw new MemberDeletionError(payload?.code ?? "unexpected", payload?.message ?? error.message ?? "Member deletion failed.");
  }
  if (data?.status !== "completed" || typeof data.deletedPersonId !== "string" || typeof data.deletedVisitCount !== "number") {
    throw new MemberDeletionError(data?.code ?? "unexpected", data?.message ?? "The member deletion service returned an invalid response.");
  }
  invalidateData("directory", "groups", "duty", "visits", "photos", "accounts");
  return {
    deletedPersonId: data.deletedPersonId,
    deletedAccountId: typeof data.deletedAccountId === "string" ? data.deletedAccountId : null,
    deletedVisitCount: data.deletedVisitCount,
    ...(typeof data.cleanupWarning === "string" ? { cleanupWarning: data.cleanupWarning } : {}),
  };
}
