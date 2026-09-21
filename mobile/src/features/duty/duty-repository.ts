import { listDirectory } from "@/features/directory/directory-repository";
import type { DutyPeriod } from "@/lib/domain";
import { isBackendConfigured } from "@/lib/supabase";
import { buildRotation, sortCandidatesByLastName, type DutyCandidate } from "./duty-domain";

export type DutyYear = {
  year: number;
  periods: DutyPeriod[];
  eligibleDeacons: DutyCandidate[];
};

export interface DutyRepository {
  loadYear(year: number): Promise<DutyYear>;
  saveRotation(year: number, orderedPersonIds: readonly string[]): Promise<DutyYear>;
  reassignPeriod(year: number, sundayOn: string, personId: string, expectedRevision: number): Promise<DutyYear>;
}

async function eligibleDeacons(): Promise<DutyCandidate[]> {
  const directory = await listDirectory();
  const candidates = directory.filter((member) => member.leadershipMinistry === "deacon").map((member) => ({ personId: member.id, name: member.name }));
  return sortCandidatesByLastName(candidates);
}

const inMemoryYears = new Map<number, DutyPeriod[]>();

class InMemoryDutyRepository implements DutyRepository {
  async loadYear(year: number): Promise<DutyYear> {
    return { year, periods: inMemoryYears.get(year) ?? [], eligibleDeacons: await eligibleDeacons() };
  }
  async saveRotation(year: number, orderedPersonIds: readonly string[]): Promise<DutyYear> {
    const candidates = (await eligibleDeacons()).filter((deacon) => orderedPersonIds.includes(deacon.personId));
    const ordered = orderedPersonIds.map((personId) => candidates.find((deacon) => deacon.personId === personId)).filter((candidate): candidate is DutyCandidate => Boolean(candidate));
    inMemoryYears.set(year, buildRotation(year, ordered));
    return this.loadYear(year);
  }
  async reassignPeriod(year: number, sundayOn: string, personId: string, expectedRevision: number): Promise<DutyYear> {
    const periods = inMemoryYears.get(year) ?? [];
    const target = periods.find((period) => period.sundayOn === sundayOn);
    if (!target) throw new Error("That weekend isn’t part of the generated schedule.");
    if (target.revision !== expectedRevision) throw new Error("Someone else already updated this weekend. Reload and try again.");
    target.personId = personId;
    target.revision += 1;
    return this.loadYear(year);
  }
}

/** Supabase-backed reads/writes ship with the deacon_duty_periods migration; until then, surface a clear error instead of guessing. */
class SupabaseDutyRepository implements DutyRepository {
  async loadYear(): Promise<DutyYear> {
    throw new Error("The duty schedule isn’t connected to the server yet.");
  }
  async saveRotation(): Promise<DutyYear> {
    throw new Error("The duty schedule isn’t connected to the server yet.");
  }
  async reassignPeriod(): Promise<DutyYear> {
    throw new Error("The duty schedule isn’t connected to the server yet.");
  }
}

export const dutyRepository: DutyRepository = isBackendConfigured ? new SupabaseDutyRepository() : new InMemoryDutyRepository();
