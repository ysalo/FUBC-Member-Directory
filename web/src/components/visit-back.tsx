import BackButton from "@/components/back-button";
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
    <BackButton href={href} label={visitCopy(locale).back} className="mb-4" />
  );
}
