/**
 * Client mirror of the server rule in `confirm_agency_service_payment`.
 *
 * No proof is required to confirm a DARB payment: when staff leave the bank
 * reference empty, the server stores the case code as the payment reference
 * (it is the same memo the student is asked to wire with). The only client
 * rule left is the length cap, which the server also enforces.
 */
export type AgencyPaymentMethod = "bank_transfer" | "cash";

export const MAX_TRANSFER_REFERENCE_LENGTH = 100;

export function agencyPaymentProofError(
  _method: string,
  reference: string | null | undefined,
  _hasReceipt: boolean,
): "tooLong" | null {
  const ref = (reference ?? "").trim();
  if (ref.length > MAX_TRANSFER_REFERENCE_LENGTH) return "tooLong";
  return null;
}

/** Storage path the server accepts: cases/<caseId>/receipts/<file>. */
export function receiptStoragePath(caseId: string, fileName: string, now = Date.now()): string {
  const ext = (fileName.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  return `cases/${caseId}/receipts/${now}.${ext}`;
}
