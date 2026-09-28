import type { FamilyChanges } from "@/features/family/family-repository";

type Category = "parents" | "spouse" | "children" | "siblings";
type Draft = { identity: string; changes: FamilyChanges; category: Category };

// A single in-memory handoff survives the trip to the full member form.
// It is consumed on return and never written to browser or device storage.
let handoff: Draft | null = null;

export function holdFamilyDraft(draft: Draft) { handoff = draft; }
export function clearFamilyDraft() { handoff = null; }
export function takeFamilyDraft(identity: string): Draft | null {
  const draft = handoff?.identity === identity ? handoff : null;
  handoff = null;
  return draft;
}
