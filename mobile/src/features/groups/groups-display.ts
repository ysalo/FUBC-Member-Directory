import type { MinistryGroup } from "./groups-repository";

export function partitionGroups(groups: MinistryGroup[], accountId?: string) {
  if (!accountId) return { assigned: undefined, others: groups };
  const assigned = groups.find((group) => group.responsibleDeaconIds.includes(accountId));
  return { assigned, others: groups.filter((group) => group.id !== assigned?.id) };
}
