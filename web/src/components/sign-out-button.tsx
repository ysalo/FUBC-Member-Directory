"use client";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { clearDirectoryViews } from "@/lib/directory-view";

export default function SignOutButton({
  compact = false,
  variant = "button",
  label = "Sign out",
  loadingLabel = "Signing out…",
}: {
  compact?: boolean;
  variant?: "button" | "menu";
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
      className={variant === "menu"
        ? "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-[var(--app-muted)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-ink)] disabled:opacity-60"
        : "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-3 py-2 text-sm font-semibold text-[var(--app-muted)] hover:bg-[var(--app-brand-soft)] hover:text-[var(--app-brand)] disabled:opacity-60"}
    >
      <LogOut className="size-4 shrink-0" strokeWidth={1.75} />
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
