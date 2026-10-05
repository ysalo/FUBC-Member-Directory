// @ts-nocheck -- Supabase Edge Functions run in Deno, outside Expo TypeScript.
import { createClient } from "npm:@supabase/supabase-js@2";
import { createImportHandler } from "./handler.ts";
Deno.serve(createImportHandler(authorization => {
  const url = Deno.env.get("SUPABASE_URL")!;
  return {
    caller: createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authorization } }, auth: { autoRefreshToken: false, persistSession: false } }),
    admin: createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { autoRefreshToken: false, persistSession: false } }),
  };
}));
