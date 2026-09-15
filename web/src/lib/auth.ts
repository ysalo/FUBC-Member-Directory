import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AppRole = "member" | "editor" | "admin";
export type MinistryRole = "deacon";
export type AccountStatus = "pending" | "active" | "denied" | "revoked";
export type AccountProfile = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  provider: string;
  role: AppRole;
  status: AccountStatus;
  person_id: string | null;
  decision_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  ministry_roles: MinistryRole[];
};

export function accessPath(status: AccountStatus) {
  return status === "active" ? "/" : `/access/${status}`;
}

export async function getAuthenticatedProfile() {
  const supabase = await createClient();
  const { data: token } = await supabase.auth.getClaims();
  const userId = token?.claims.sub;
  if (!userId) return { supabase, profile: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  return { supabase, profile: profile as AccountProfile | null };
}

export async function requireActiveProfile() {
  const context = await getAuthenticatedProfile();
  if (!context.profile) redirect("/login");
  if (context.profile.status !== "active")
    redirect(accessPath(context.profile.status));
  return { supabase: context.supabase, profile: context.profile };
}

export async function requireEditor() {
  const context = await requireActiveProfile();
  if (!(["editor", "admin"] as AppRole[]).includes(context.profile.role))
    redirect("/");
  return context;
}

export async function requireAdmin() {
  const context = await requireActiveProfile();
  if (context.profile.role !== "admin") redirect("/");
  return context;
}
