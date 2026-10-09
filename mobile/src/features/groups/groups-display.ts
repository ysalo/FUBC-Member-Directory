import { memberSearchScore } from "@/lib/member-search";
import type { MinistryGroup } from "./groups-repository";

export function partitionGroups(groups: MinistryGroup[], accountId?: string) {
  if (!accountId) return { assigned: undefined, others: groups };
  const assigned = groups.find((group) => group.responsibleDeaconIds.includes(accountId));
  return { assigned, others: groups.filter((group) => group.id !== assigned?.id) };
}

/** Search group names and each assigned deacon's name in either name order. */
export function groupMatchesSearch(group: MinistryGroup, query: string, locale: string): boolean {
  const needle = query.trim().toLocaleLowerCase(locale);
  return !needle || `${group.name} ${group.nameUk}`.toLocaleLowerCase(locale).includes(needle)
    || (group.responsibleDeacons ?? []).some(deacon => memberSearchScore(deacon, query) !== null);
}
