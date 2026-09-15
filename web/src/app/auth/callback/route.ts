import { NextResponse, type NextRequest } from "next/server";
import { accessPath, type AccountProfile } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  if (!code) return NextResponse.redirect(new URL("/login?error=oauth_failed", request.url));
  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/login?error=oauth_failed", request.url));
  const { data: token } = await supabase.auth.getClaims();
  const userId = token?.claims.sub;
  const { data } = userId ? await supabase.from("profiles").select("status").eq("id", userId).single() : { data: null };
  const profile = data as Pick<AccountProfile, "status"> | null;
  if (!profile) return NextResponse.redirect(new URL("/login?error=profile_failed", request.url));
  return NextResponse.redirect(new URL(profile.status === "active" ? next : accessPath(profile.status), request.url));
}
