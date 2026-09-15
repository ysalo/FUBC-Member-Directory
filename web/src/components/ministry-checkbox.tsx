"use client";
import type { Locale } from "@/lib/i18n";
import { groupCopy } from "@/lib/group-copy";

export default function MinistryCheckbox({
  checked,
  locale,
}: {
  checked: boolean;
  locale: Locale;
}) {
  return (
    <input
      type="checkbox"
      name="isDeacon"
      defaultChecked={checked}
      className="size-5"
      onChange={(event) => {
        if (
          checked &&
          !event.target.checked &&
          !window.confirm(groupCopy(locale).designationConfirm)
        )
          event.target.checked = true;
      }}
    />
  );
}
