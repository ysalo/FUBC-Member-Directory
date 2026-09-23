import { InMemoryVisitationRepository } from "./InMemoryVisitationRepository";
import { SupabaseVisitationRepository } from "./SupabaseVisitationRepository";
import { isBackendConfigured } from "@/lib/supabase";
import { getDirectoryVisitCount } from "@/features/directory/directory-repository";
import type { Account } from "@/lib/domain";
import type { VisitActor, VisitationRepository } from "./types";

export const visitationRepository: VisitationRepository = isBackendConfigured ? new SupabaseVisitationRepository() : new InMemoryVisitationRepository();
export const visitationDemoMode = !isBackendConfigured;

export function bindVisitationSession(account: Account | null) {
  if (!isBackendConfigured) return;
  visitationRepository.bindSessionActor(account as VisitActor | null);
}

export async function getActiveVisitationCount(): Promise<number> {
  return getDirectoryVisitCount();
}
