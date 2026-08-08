import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export interface PayoutPreviewCase {
  reward_id: string;
  case_id: string | null;
  case_reference: string | null;
  student_name: string | null;
  amount: number;
  unlock_at: string;
}

export interface PayoutPreview {
  eligible_amount: number;
  eligible_count: number;
  locked_amount: number;
  locked_count: number;
  next_unlock_at: string | null;
  has_open_request: boolean;
  cases: PayoutPreviewCase[];
}

export interface PayoutRequestCase {
  reward_id: string;
  reward_status: string;
  amount: number;
  eligible_at: string;
  case_id: string | null;
  case_reference: string | null;
  case_status: string | null;
  student_name: string | null;
}

export interface PayoutRequestDetail {
  id: string;
  payout_reference: string | null;
  partner_id: string;
  partner_name: string | null;
  partner_role: string | null;
  amount: number;
  status: string;
  requested_at: string;
  approved_at: string | null;
  paid_at: string | null;
  paid_by_name: string | null;
  payment_method: string | null;
  transaction_ref: string | null;
  reject_reason: string | null;
  thread_id: string | null;
  cases: PayoutRequestCase[];
}

/**
 * Everything about a payout is derived server-side from the caller's own
 * rewards: the amount, the eligible cases and the 20-day hold. The client
 * never supplies a figure.
 */
export async function getMyPayoutPreview(): Promise<PayoutPreview> {
  const { data, error } = await db.rpc("get_my_payout_preview");
  if (error) throw error;
  return {
    eligible_amount: Number(data?.eligible_amount ?? 0),
    eligible_count: Number(data?.eligible_count ?? 0),
    locked_amount: Number(data?.locked_amount ?? 0),
    locked_count: Number(data?.locked_count ?? 0),
    next_unlock_at: data?.next_unlock_at ?? null,
    has_open_request: !!data?.has_open_request,
    cases: (data?.cases ?? []) as PayoutPreviewCase[],
  };
}

/** Raises the request and posts the structured card into the admin thread. */
export async function requestPayoutViaChat(notes?: string): Promise<{
  request_id: string;
  thread_id: string;
  amount: number;
  case_count: number;
}> {
  const { data, error } = await db.rpc("request_payout_via_chat", {
    p_notes: notes ?? null,
  });
  if (error) throw error;
  return data;
}

export async function getPayoutRequestDetail(id: string): Promise<PayoutRequestDetail> {
  const { data, error } = await db.rpc("get_payout_request_detail", { p_request_id: id });
  if (error) throw error;
  return data as PayoutRequestDetail;
}

export async function adminRespondPayoutRequest(
  id: string,
  action: "approve" | "pay" | "reject",
  note?: string,
  transactionRef?: string,
): Promise<void> {
  const { error } = await db.rpc("admin_respond_payout_request", {
    p_request_id: id,
    p_action: action,
    p_note: note ?? null,
    p_transaction_ref: transactionRef ?? null,
  });
  if (error) throw error;
}
