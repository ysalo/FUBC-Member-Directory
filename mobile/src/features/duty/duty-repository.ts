import { listDirectory } from "@/features/directory/directory-repository";
import type { DutyPeriod } from "@/lib/domain";
import { isBackendConfigured, requireSupabase } from "@/lib/supabase";
import { unwrap } from "@/lib/repository-helpers";
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

/** Supabase-backed reads/writes against the deacon_duty_periods migration. */
class SupabaseDutyRepository implements DutyRepository {
  async loadYear(year: number): Promise<DutyYear> {
    const client = requireSupabase();
    const result = await client
      .from("deacon_duty_periods")
      .select("sunday_on,person_id,revision")
      .gte("sunday_on", `${year}-01-01`)
      .lte("sunday_on", `${year}-12-31`)
      .order("sunday_on");
    const rows = unwrap(result);
    const periods: DutyPeriod[] = rows.map((row) => ({ sundayOn: row.sunday_on, personId: row.person_id, revision: row.revision }));
    return { year, periods, eligibleDeacons: await eligibleDeacons() };
  }
  async saveRotation(year: number, orderedPersonIds: readonly string[]): Promise<DutyYear> {
    const client = requireSupabase();
    unwrap(await client.rpc("generate_duty_schedule", { p_year: year, p_person_ids: [...orderedPersonIds] }));
    return this.loadYear(year);
  }
  async reassignPeriod(year: number, sundayOn: string, personId: string, expectedRevision: number): Promise<DutyYear> {
    const client = requireSupabase();
    unwrap(await client.rpc("reassign_duty_period", { p_sunday_on: sundayOn, p_person_id: personId, p_revision: expectedRevision }));
    return this.loadYear(year);
  }
}

export const dutyRepository: DutyRepository = isBackendConfigured ? new SupabaseDutyRepository() : new InMemoryDutyRepository();
