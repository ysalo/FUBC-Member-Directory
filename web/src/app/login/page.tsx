"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { safeNextPath } from "@/lib/safe-next";

type Provider = "google" | "apple";
function ProviderIcon({ provider }: { provider: Provider }) {
  return provider === "google" ? <span aria-hidden className="text-lg font-bold text-blue-600">G</span> : <span aria-hidden className="text-xl">●</span>;
}

function LoginForm() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<Provider | null>(null);
  const [error, setError] = useState(searchParams.get("error") ? "Sign-in could not be completed. Please try again." : "");
  const appleEnabled = process.env.NEXT_PUBLIC_ENABLE_APPLE_AUTH === "true";
  async function signIn(provider: Provider) {
    setLoading(provider); setError("");
    const next = safeNextPath(searchParams.get("next"));
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error: authError } = await createClient().auth.signInWithOAuth({ provider, options: { redirectTo } });
    if (authError) { setLoading(null); setError("That provider is unavailable right now. Please try again."); }
  }
  return <main className="safe-page grid min-h-dvh place-items-center bg-slate-100 p-5"><section className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-xl"><div className="grid size-12 place-items-center rounded-2xl bg-blue-700 text-xl font-bold text-white">PD</div><p className="mt-6 text-sm font-semibold text-blue-700">Private Directory</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Welcome</h1><p className="mt-2 text-sm leading-6 text-slate-500">Sign in with an identity provider. New accounts are reviewed before directory access is granted.</p><div className="mt-7 space-y-3"><button onClick={() => signIn("google")} disabled={loading !== null} className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"><ProviderIcon provider="google" />{loading === "google" ? "Opening Google…" : "Continue with Google"}</button>{appleEnabled && <button onClick={() => signIn("apple")} disabled={loading !== null} className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-black px-4 font-semibold text-white hover:bg-slate-900 disabled:opacity-60"><ProviderIcon provider="apple" />{loading === "apple" ? "Opening Apple…" : "Continue with Apple"}</button>}</div>{error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<p className="mt-6 text-xs leading-5 text-slate-400">Your provider confirms your identity. The directory does not store a separate password.</p></section></main>;
}
export default function LoginPage() { return <Suspense fallback={<main className="min-h-dvh bg-slate-100" />}><LoginForm /></Suspense>; }
