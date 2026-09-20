import { InMemoryVisitationRepository } from "./InMemoryVisitationRepository";
import { SupabaseVisitationRepository } from "./SupabaseVisitationRepository";
import { isBackendConfigured, requireSupabase } from "@/lib/supabase";
import { unwrap } from "@/lib/repository-helpers";
import type { Account } from "@/lib/domain";
import type { VisitActor, VisitationRepository } from "./types";

export const visitationRepository: VisitationRepository = isBackendConfigured ? new SupabaseVisitationRepository() : new InMemoryVisitationRepository();
export const visitationDemoMode = !isBackendConfigured;

export function bindVisitationSession(account: Account | null) {
  if (!isBackendConfigured) return;
  visitationRepository.bindSessionActor(account as VisitActor | null);
}

export async function getActiveVisitationCount(): Promise<number> {
  if (!isBackendConfigured) return 0;
  return unwrap(await requireSupabase().rpc("directory_visible_visit_count", {}));
}
