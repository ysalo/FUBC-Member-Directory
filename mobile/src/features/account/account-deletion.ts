import { requireSupabase } from "@/lib/supabase";

export type DeleteAccountRequest = {
  /** Omit for self-deletion; administrators may provide another account id. */
  targetAccountId?: string;
  confirmation: string;
};

export type DeleteAccountResult = { deletedAccountId: string; selfDeleted: boolean };

export class AccountDeletionError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "AccountDeletionError";
  }
}

export function adminDeleteHref(accountId: string, displayName: string): string {
  return `/manage/account/${encodeURIComponent(accountId)}/delete?admin=true&targetAccountId=${encodeURIComponent(accountId)}&displayName=${encodeURIComponent(displayName)}`;
}

/**
 * Client contract for the privileged `delete-account` Edge Function.
 * The function must authorize the caller, enforce the final-admin safeguard,
 * preserve/unlink directory people, and delete the Auth identity.
 */
export async function deleteAccount(request: DeleteAccountRequest): Promise<DeleteAccountResult> {
  const client = requireSupabase();
  const { data: sessionData } = await client.auth.getSession();
  const { data, error } = await client.functions.invoke("delete-account", {
    body: { ...request, providerToken: sessionData.session?.provider_token },
  });
  if (error) {
    const context = "context" in error && error.context && typeof error.context === "object" ? error.context as Response : null;
    const payload = context && "json" in context ? await context.json().catch(() => null) : null;
    throw new AccountDeletionError(payload?.code ?? "unexpected", payload?.message ?? error.message ?? "Account deletion failed.");
  }
  if (data?.status !== "completed" || typeof data.deletedAccountId !== "string" || typeof data.selfDeleted !== "boolean") {
    throw new AccountDeletionError(data?.code ?? "unexpected", data?.message ?? "The account deletion service returned an invalid response.");
  }
  if (data.selfDeleted) await client.auth.signOut({ scope: "local" });
  return data as DeleteAccountResult;
}
