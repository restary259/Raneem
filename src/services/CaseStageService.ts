import { supabase } from "@/integrations/supabase/client";
import { getNextSteps, canTransition } from "@/lib/caseTransitions";
import type { CaseStatus } from "@/lib/caseStatus";

/** Stages that are only reached through another flow, never by a manual click. */
export const AUTOMATED_STAGES: string[] = ["payment_confirmed", "submitted", "enrollment_paid"];

/** Forward stages a user may move this case to by hand. */
export function manualNextStages(current: string): CaseStatus[] {
  return getNextSteps(current).filter((s) => !AUTOMATED_STAGES.includes(s));
}

/**
 * Move a case to the next pipeline stage and record it on the timeline.
 * Throws when the transition is not allowed or the write fails.
 */
export async function advanceCaseStage(
  caseId: string,
  from: string,
  to: string,
): Promise<void> {
  if (!canTransition(from, to)) {
    throw new Error(`Transition ${from} -> ${to} is not allowed`);
  }

  const { error } = await supabase.from("cases").update({ status: to }).eq("id", caseId);
  if (error) throw error;

  const { error: logError } = await supabase.rpc("log_case_event", {
    p_case_id: caseId,
    p_event_type: "stage_advanced",
    p_payload: { from, to },
    p_is_internal: false,
  });
  if (logError) throw logError;
}
