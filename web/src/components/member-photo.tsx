"use client";
import { useState } from "react";

export default function MemberPhoto({
  name,
  photoPath,
}: {
  name: string;
  photoPath?: string | null;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase();
  return (
    <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--app-brand-soft)] text-sm font-semibold text-[var(--app-brand)] ring-1 ring-[var(--app-line)]">
      {photoPath && failed !== photoPath ? (
        // Signed private-storage URLs are displayed directly, as in the directory.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoPath}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setFailed(photoPath)}
        />
      ) : (
        <span aria-hidden="true">{initials || "?"}</span>
      )}
    </span>
  );
}
