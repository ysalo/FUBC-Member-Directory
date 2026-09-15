"use client";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

export default function SignOutButton({ compact = false }: { compact?: boolean }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  async function signOut() { setLoading(true); await createClient().auth.signOut(); router.replace("/login"); router.refresh(); }
  return <button type="button" onClick={signOut} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-60"><LogOut className="size-4" />{compact ? <span className="sr-only">Sign out</span> : loading ? "Signing out…" : "Sign out"}</button>;
}
