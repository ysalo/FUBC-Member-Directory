"use client";

import { ArrowLeft } from "lucide-react";
import Link from "@/components/navigation-link";

export default function BackButton({
  href,
  onClick,
  label,
  className = "",
}: {
  href?: string;
  onClick?: () => void;
  label: string;
  className?: string;
}) {
  const style = `grid size-11 shrink-0 place-items-center rounded-full border border-[var(--app-line)] bg-[var(--app-surface)] text-[var(--app-ink)] shadow-sm transition-colors hover:bg-[var(--app-surface-muted)] ${className}`;
  const icon = <ArrowLeft aria-hidden="true" className="size-5" />;
  return href ? (
    <Link href={href} aria-label={label} className={style}>
      {icon}
    </Link>
  ) : (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={style}
    >
      {icon}
    </button>
  );
}
