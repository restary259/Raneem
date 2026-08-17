import { supabase } from "@/integrations/supabase/client";
import { getNextSteps, canTransition } from "@/lib/caseTransitions";
import { TERMINAL_STATUSES } from "@/lib/caseStatus";
import type { CaseStatus } from "@/lib/caseStatus";

/** Stages that are only reached through another flow, never by a manual click. */
export const AUTOMATED_STAGES: string[] = ["payment_confirmed", "submitted", "enrollment_paid"];

/** Forward stages a user may move this case to by hand. */
export function manualNextStages(current: string): CaseStatus[] {
  return getNextSteps(current).filter((s) => !AUTOMATED_STAGES.includes(s));
}

export type StageBlockReason =
  /** Pipeline is finished — nothing comes after this stage. */
  | { kind: "terminal" }
  /** Case is cancelled/forgotten and must be reopened first. */
  | { kind: "inactive" }
  /** A next stage exists but another flow sets it. */
  | { kind: "automated"; stage: string };

/**
 * Why the manual "move to next stage" control is unavailable, or `null` when
 * the user can move the case by hand.
 */
export function stageBlockReason(current: string): StageBlockReason | null {
  if (manualNextStages(current).length > 0) return null;

  if (current === "cancelled" || current === "forgotten") return { kind: "inactive" };

  const automated = getNextSteps(current).find((s) => AUTOMATED_STAGES.includes(s));
  if (automated) return { kind: "automated", stage: automated };

  return { kind: "terminal" };
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

/**
 * Permanently cancel a case. A side-exit, not a pipeline transition — it
 * bypasses the transition graph intentionally (cancelled is terminal), so
 * "Cancel" never surfaces as a suggested next step in the pipeline UI.
 * Records a `case_cancelled` timeline event carrying the current status and
 * the optional reason.
 */
export async function cancelCase(caseId: string, reason: string, currentStatus: string): Promise<void> {
  const { error } = await supabase.from("cases").update({ status: "cancelled" }).eq("id", caseId);
  if (error) throw error;

  const { error: logError } = await supabase.rpc("log_case_event", {
    p_case_id: caseId,
    p_event_type: "case_cancelled",
    p_payload: { from: currentStatus, reason: reason.trim() || null },
    p_is_internal: false,
  });
  if (logError) throw logError;
}
