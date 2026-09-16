"use client";

import Link, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";
import LoadingSpinner from "@/components/loading-spinner";

function NavigationIndicator() {
  const { pending } = useLinkStatus();

  if (!pending) return null;

  return (
    <span
      role="status"
      aria-label={
        typeof document !== "undefined" &&
        document.documentElement.lang === "uk"
          ? "Завантаження…"
          : "Loading…"
      }
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center pt-[max(0.75rem,env(safe-area-inset-top))]"
    >
      <span className="rounded-full border border-[var(--app-line)] bg-[var(--app-surface)] p-3 shadow-lg">
        <LoadingSpinner />
      </span>
    </span>
  );
}

export default function NavigationLink({
  children,
  ...props
}: ComponentProps<typeof Link>) {
  return (
    <Link {...props}>
      {children}
      <NavigationIndicator />
    </Link>
  );
}
