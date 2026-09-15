import { groupCopy } from "@/lib/group-copy";
import type { Locale } from "@/lib/i18n";

export default function MemberStatusFields({
  locale,
  maritalStatus,
  isOrphan = false,
}: {
  locale: Locale;
  maritalStatus?: string | null;
  isOrphan?: boolean;
}) {
  const copy = groupCopy(locale);
  return (
    <fieldset className="space-y-3">
      <label className="block text-sm font-medium">
        {copy.maritalStatus}
        <select
          name="maritalStatus"
          defaultValue={maritalStatus ?? ""}
          className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3"
        >
          <option value="">{copy.unknown}</option>
          <option value="single">{copy.single}</option>
          <option value="married">{copy.married}</option>
          <option value="widowed">{copy.widowed}</option>
        </select>
      </label>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="isOrphan"
          defaultChecked={isOrphan}
          className="size-5"
        />
        {copy.orphan}
      </label>
    </fieldset>
  );
}
