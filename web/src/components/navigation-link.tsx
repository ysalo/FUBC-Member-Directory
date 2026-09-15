"use client";

import Link, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";

function NavigationIndicator() {
  const { pending } = useLinkStatus();

  if (!pending) return null;

  return (
    <span
      role="status"
      aria-label="Loading"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center pt-[max(0.75rem,env(safe-area-inset-top))]"
    >
      <span className="rounded-full bg-white/95 p-3 shadow-lg">
        <span className="block size-5 animate-spin rounded-full border-2 border-[var(--app-line)] border-t-[var(--app-brand)]" />
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
