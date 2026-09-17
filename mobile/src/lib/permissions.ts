import type { Account, Visit } from "./domain";

type Actor = Pick<Account, "id" | "status" | "role" | "designation"> | null | undefined;
export const isActive = (actor: Actor): boolean => actor?.status === "active";
export const canReadDirectory = isActive;
export const canManageDirectory = (actor: Actor): boolean => isActive(actor) && (actor?.role === "editor" || actor?.role === "admin");
export const canManageAccounts = (actor: Actor): boolean => isActive(actor) && actor?.role === "admin";
export const canCreateVisit = (actor: Actor): boolean => isActive(actor) && actor?.designation === "pastor";
export function canReadVisit(actor: Actor, visit: Pick<Visit, "pastorId" | "recipients">): boolean {
  return isActive(actor) && (visit.pastorId === actor?.id || visit.recipients.some((recipient) => recipient.accountId === actor?.id));
}
export function canManageVisit(actor: Actor, visit: Pick<Visit, "pastorId">): boolean {
  return canCreateVisit(actor) && visit.pastorId === actor?.id;
}
export function canRespondToVisit(actor: Actor, visit: Pick<Visit, "status" | "archivedAt" | "recipients">): boolean {
  return isActive(actor) && actor?.designation === "deacon" && visit.status === "open" && !visit.archivedAt && visit.recipients.some((recipient) => recipient.accountId === actor.id);
}
export function canReadGroupBirthdays(actor: Actor, responsibleAccountIds: readonly string[]): boolean {
  return isActive(actor) && actor?.designation === "deacon" && responsibleAccountIds.includes(actor.id);
}
