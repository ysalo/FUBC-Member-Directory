import Link from "@/components/navigation-link";
import { visitCopy } from "@/lib/visitation";
import type { Locale } from "@/lib/i18n";

export default function VisitBack({
  href = "/visitation",
  locale,
}: {
  href?: string;
  locale: Locale;
}) {
  return (
    <Link
      href={href}
      aria-label={visitCopy(locale).back}
      className="mb-4 grid size-11 shrink-0 place-items-center rounded-full border border-white/15 bg-[#171716]/65 text-2xl font-medium text-white shadow-lg backdrop-blur-xl hover:bg-[#171716]/80"
    >
      ←
    </Link>
  );
}
