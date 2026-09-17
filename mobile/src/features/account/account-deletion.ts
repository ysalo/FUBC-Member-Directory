import { requireSupabase } from "@/lib/supabase";

export type DeleteAccountRequest = {
  /** Omit for self-deletion; administrators may provide another account id. */
  targetAccountId?: string;
  confirmation: string;
};

export type DeleteAccountResult = { deletedAccountId: string; selfDeleted: boolean };

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
  if (error) throw error;
  if (data?.status === "blocked" || data?.status === "failed") throw new Error(data.message ?? "Account deletion failed.");
  if (!data || typeof data.deletedAccountId !== "string" || typeof data.selfDeleted !== "boolean") {
    throw new Error("The account deletion service returned an invalid response.");
  }
  if (data.selfDeleted) await client.auth.signOut({ scope: "local" });
  return data as DeleteAccountResult;
}
