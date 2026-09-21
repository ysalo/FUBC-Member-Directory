// @ts-nocheck -- Supabase Edge Functions run in Deno, outside the Expo TypeScript runtime.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Origin": "*",
};
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ status: "failed", code: "method-not-allowed", message: "Method not allowed." }, 405);

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return failed("unauthenticated", "Sign in first.", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: callerData, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerData.user) return failed("unauthenticated", "Your session has expired.", 401);

    const body = await request.json().catch(() => ({}));
    const personId = typeof body.personId === "string" ? body.personId.trim() : "";
    const expectedRevision = Number(body.expectedRevision);
    const confirmation = typeof body.confirmation === "string" ? body.confirmation.trim() : "";
    if (!uuidPattern.test(personId) || !Number.isInteger(expectedRevision) || expectedRevision < 1 || !confirmation) {
      return failed("invalid-request", "Choose a current member and type their name to confirm deletion.", 400);
    }

    const { data: caller, error: callerProfileError } = await adminClient.from("profiles").select("id,status,role,person_id").eq("id", callerData.user.id).maybeSingle();
    if (callerProfileError) throw callerProfileError;
    if (!caller || caller.status !== "active" || caller.role !== "admin") return failed("not-authorized", "Only active administrators can delete members.", 403);

    const { data: person, error: personError } = await adminClient.from("people").select("id,name,revision,photo_path").eq("id", personId).maybeSingle();
    if (personError) throw personError;
    // A lost response after a successful deletion is safe to retry.
    if (!person) return completed(personId, null, 0);
    if (person.revision !== expectedRevision) return failed("conflict", "This member changed. Reload and review the current record before deleting it.", 409);
    if (confirmation !== person.name.trim()) return failed("confirmation", "Type the member name exactly as shown.", 400);

    const { data: linkedAccount, error: linkedError } = await adminClient.from("profiles").select("id,status,role").eq("person_id", personId).maybeSingle();
    if (linkedError) throw linkedError;
    if (linkedAccount?.id === caller.id || caller.person_id === personId) {
      return failed("self-delete", "You cannot delete your own member record. Ask another administrator to do this.", 409);
    }
    if (linkedAccount?.status === "active" && linkedAccount.role === "admin") {
      const { count, error: countError } = await adminClient.from("profiles").select("id", { count: "exact", head: true }).eq("status", "active").eq("role", "admin").neq("id", linkedAccount.id);
      if (countError) throw countError;
      if ((count ?? 0) === 0) return failed("final-admin", "Assign another active administrator before deleting this member.", 409);
    }

    const deletedAccountId = linkedAccount?.id ?? null;
    if (deletedAccountId) {
      const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(deletedAccountId, false);
      if (authDeleteError && !isMissingIdentity(authDeleteError)) throw authDeleteError;
      const { error: profileDeleteError } = await adminClient.from("profiles").delete().eq("id", deletedAccountId);
      if (profileDeleteError) throw profileDeleteError;
    }

    if (person.photo_path) {
      const { error: photoError } = await adminClient.storage.from("member-photos").remove([person.photo_path]);
      if (photoError) throw new Error(`Private photo cleanup failed: ${photoError.message}`);
    }

    const { data: deletionRows, error: deletionError } = await callerClient.rpc("delete_member_record", {
      p_person_id: personId,
      p_deleted_account_id: deletedAccountId,
    });
    if (deletionError) throw deletionError;
    const deletion = Array.isArray(deletionRows) ? deletionRows[0] : deletionRows;
    return completed(personId, deletedAccountId, Number(deletion?.deleted_visit_count ?? 0));
  } catch (error) {
    return failed("unexpected", error instanceof Error ? error.message : "Member deletion failed.", 500);
  }
});

function isMissingIdentity(error: { code?: string; status?: number; message?: string }) {
  return error.status === 404 || error.code === "user_not_found" || /user not found/i.test(error.message ?? "");
}

function completed(deletedPersonId: string, deletedAccountId: string | null, deletedVisitCount: number) {
  return json({ status: "completed", deletedPersonId, deletedAccountId, deletedVisitCount });
}

function failed(code: string, message: string, status: number) {
  return json({ status: "failed", code, message }, status);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
