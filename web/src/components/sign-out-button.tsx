"use client";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

export default function SignOutButton({
  compact = false,
  label = "Sign out",
  loadingLabel = "Signing out…",
}: {
  compact?: boolean;
  label?: string;
  loadingLabel?: string;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  async function signOut() {
    setLoading(true);
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }
  return (
    <button
      type="button"
      onClick={signOut}
      disabled={loading}
      aria-label={label}
      className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-3 py-2 text-sm font-semibold text-[var(--app-muted)] hover:bg-[var(--app-brand-soft)] hover:text-[var(--app-brand)] disabled:opacity-60"
    >
      <LogOut className="size-4" />
      {compact ? (
        <span className="sr-only">{label}</span>
      ) : loading ? (
        loadingLabel
      ) : (
        label
      )}
    </button>
  );
}
