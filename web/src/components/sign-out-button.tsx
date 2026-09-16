"use client";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { clearDirectoryViews } from "@/lib/directory-view";

export default function SignOutButton({
  compact = false,
  destructive = false,
  label = "Sign out",
  loadingLabel = "Signing out…",
}: {
  compact?: boolean;
  destructive?: boolean;
  label?: string;
  loadingLabel?: string;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  async function signOut() {
    setLoading(true);
    await createClient().auth.signOut();
    clearDirectoryViews();
    router.replace("/login");
    router.refresh();
  }
  return (
    <button
      type="button"
      onClick={signOut}
      disabled={loading}
      aria-label={label}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-60 ${destructive ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100" : "border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-muted)] hover:bg-[var(--app-brand-soft)] hover:text-[var(--app-brand)]"}`}
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
