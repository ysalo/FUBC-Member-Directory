import Link from "@/components/navigation-link";
import MemberPhoto from "@/components/member-photo";
import type { Locale } from "@/lib/i18n";

export default function VisitMemberLink({
  personId,
  name,
  photoPath,
  showPhoto = false,
  profileLink = true,
  locale,
}: {
  personId?: string | null;
  name: string;
  photoPath?: string | null;
  showPhoto?: boolean;
  profileLink?: boolean;
  locale: Locale;
}) {
  const content = (
    <>
      {showPhoto && <MemberPhoto name={name} photoPath={photoPath} />}
      <span className="min-w-0 break-words">{name}</span>
    </>
  );
  if (!profileLink)
    return (
      <span className="inline-flex min-w-0 items-center gap-3">{content}</span>
    );
  return personId ? (
    <Link
      href={`/members/${personId}`}
      className="inline-flex min-w-0 items-center gap-3 rounded-md text-[var(--app-brand)] underline-offset-4 hover:underline"
    >
      {content}
    </Link>
  ) : (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-3">
      {content}
      <span className="text-xs font-normal text-[var(--app-muted)]">
        {locale === "uk" ? "Профіль недоступний" : "Profile unavailable"}
      </span>
    </span>
  );
}
