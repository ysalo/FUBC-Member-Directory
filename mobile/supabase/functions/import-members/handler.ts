// @ts-ignore -- Deno deployment requires explicit .ts imports.
import { MemberCsvError, memberCsvMaxBytes, parseMemberCsv } from "../_shared/member-csv.ts";

const cors = { "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Origin": "*" };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Receipt = { importId: string; importedCount: number; replacedCount: number; pendingPhotos: number };
// Structural interfaces keep the handler independent of Deno and easy to exercise
// with a client that rejects every object download/signing method.
type Client = {
  auth: { getUser(): Promise<{ data: { user: { id: string } | null }; error: unknown }> };
  from(table: string): any;
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: any; error: { message: string; code?: string } | null }>;
  storage: { from(bucket: string): { remove(paths: string[]): Promise<{ error: { message: string } | null }> } };
};
export function createImportHandler(clients: (authorization: string) => { caller: Client; admin: Client }) {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
    if (request.method !== "POST") return json({ status: "failed", message: "Method not allowed." }, 405);
    try {
      const authorization = request.headers.get("Authorization");
      if (!authorization) return json({ status: "failed", message: "Sign in first." }, 401);
      const { caller, admin } = clients(authorization);
      const identity = await caller.auth.getUser();
      if (identity.error || !identity.data.user) return json({ status: "failed", message: "Your session has expired." }, 401);
      const profile = await admin.from("profiles").select("id,status,role").eq("id", identity.data.user.id).maybeSingle();
      if (profile.error) throw new Error(profile.error.message);
      if (profile.data?.status !== "active" || profile.data?.role !== "admin") return json({ status: "failed", message: "Only active administrators can import members." }, 403);
      if (Number(request.headers.get("Content-Length")) > memberCsvMaxBytes * 2) return json({ status: "failed", message: "CSV request is too large." }, 413);
      const text = await request.text();
      if (text.length > memberCsvMaxBytes * 2) return json({ status: "failed", message: "CSV request is too large." }, 413);
      const body = JSON.parse(text);
      if (typeof body.importId !== "string" || !uuidPattern.test(body.importId)) return json({ status: "failed", message: "Choose a valid import operation." }, 400);
      let receipt: Receipt;
      if (body.action === "retry-cleanup") {
        const result = await admin.rpc("member_import_receipt", { p_import_id: body.importId });
        if (result.error) throw new Error(result.error.message);
        if (!result.data) return json({ status: "failed", message: "Import operation not found." }, 404);
        receipt = result.data;
      } else {
        if (body.action !== "import" || typeof body.csv !== "string" || !["add", "replace"].includes(body.mode)) return json({ status: "failed", message: "Choose a CSV file and import mode." }, 400);
        const rows = parseMemberCsv(body.csv);
        const result = await caller.rpc("import_members_from_csv", { p_import_id: body.importId, p_rows: rows, p_mode: body.mode, p_confirmation: body.confirmation ?? "" });
        if (result.error) {
          if (!result.error.code) throw new Error("Import outcome is uncertain");
          return json({ status: "failed", message: result.error.message }, 400);
        }
        receipt = result.data;
      }
      // The database operation is already committed. Cleanup failures must never
      // report that the member import failed or cause another replacement.
      try {
        for (let batches = 0; receipt.pendingPhotos > 0 && batches < 20; batches++) {
          const result = await admin.rpc("member_import_cleanup_batch", { p_import_id: receipt.importId });
          if (result.error) throw new Error(result.error.message);
          const paths = result.data.map((item: { path: string }) => item.path);
          if (!paths.length) { receipt.pendingPhotos = 0; break; }
          const removed = await admin.storage.from("member-photos").remove(paths);
          if (removed.error) throw new Error(removed.error.message);
          const acknowledged = await admin.rpc("member_import_cleanup_completed", { p_import_id: receipt.importId, p_paths: paths });
          if (acknowledged.error) throw new Error(acknowledged.error.message);
          receipt.pendingPhotos = Number(acknowledged.data);
        }
        return json({ ...receipt, status: receipt.pendingPhotos > 0 ? "cleanup-pending" : "completed" });
      } catch {
        return json({ ...receipt, status: "cleanup-pending", message: "Members were imported. Old photo cleanup is pending; retry cleanup." });
      }
    } catch (cause) {
      if (cause instanceof MemberCsvError) return json({ status: "failed", message: "Fix the CSV before importing.", issues: cause.issues.slice(0, 50) }, 400);
      if (cause instanceof SyntaxError) return json({ status: "failed", message: "Invalid request." }, 400);
      return json({ status: "failed", message: "Import service failed. Retry with the same operation before starting another import." }, 500);
    }
  };
}
