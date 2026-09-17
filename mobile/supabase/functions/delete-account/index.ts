// @ts-nocheck -- Supabase Edge Functions run in Deno, outside the Expo TypeScript runtime.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Origin": "*",
};

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ status: "failed", message: "Method not allowed." }, 405);

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return json({ status: "failed", message: "Sign in first." }, 401);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: callerData, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerData.user) return json({ status: "failed", message: "Your session has expired." }, 401);

    const body = await request.json().catch(() => ({}));
    const targetAccountId = typeof body.targetAccountId === "string" ? body.targetAccountId : callerData.user.id;
    const selfDelete = targetAccountId === callerData.user.id;
    const [{ data: caller }, { data: target }] = await Promise.all([
      adminClient.from("profiles").select("id,status,role,person_id").eq("id", callerData.user.id).maybeSingle(),
      adminClient.from("profiles").select("id,status,role,person_id,display_name").eq("id", targetAccountId).maybeSingle(),
    ]);
    if (!caller || !target) return json({ status: "failed", message: "Account not found." }, 404);
    if (!selfDelete && (caller.status !== "active" || caller.role !== "admin")) return json({ status: "failed", message: "Not authorized." }, 403);
    if (typeof body.confirmation !== "string" || body.confirmation.trim() !== target.display_name.trim()) {
      return json({ status: "failed", message: "Type the account name exactly to confirm deletion." }, 400);
    }

    if (target.status === "active" && target.role === "admin") {
      const { count } = await adminClient.from("profiles").select("id", { count: "exact", head: true }).eq("status", "active").eq("role", "admin").neq("id", targetAccountId);
      if ((count ?? 0) === 0) return json({ status: "blocked", message: "Assign another active administrator before deleting this account." });
    }

    let providerRevoked = false;
    if (selfDelete && callerData.user.app_metadata?.provider === "google" && typeof body.providerToken === "string" && body.providerToken.length > 0) {
      const response = await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(body.providerToken)}`, { method: "POST" });
      providerRevoked = response.ok;
    }

    const { error: auditError } = await adminClient.from("audit_events").insert({
      actor_id: callerData.user.id,
      action: selfDelete ? "account.self_deleted" : "account.admin_deleted",
      entity_id: targetAccountId,
      metadata: { preserved_person_id: target.person_id, target_display_name: target.display_name, provider_revoked: providerRevoked },
    });
    if (auditError) throw auditError;

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetAccountId, false);
    if (deleteError) throw deleteError;
    return json({ status: "completed", deletedAccountId: targetAccountId, selfDeleted: selfDelete });
  } catch (error) {
    return json({ status: "failed", message: error instanceof Error ? error.message : "Account deletion failed." }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
