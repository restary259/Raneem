/**
 * Client mirror of the server rule in `confirm_agency_service_payment`:
 * a bank transfer needs a transfer reference OR a receipt file; cash needs
 * neither. The server re-validates — this only gives instant feedback.
 */
export type AgencyPaymentMethod = "bank_transfer" | "cash";

export const MAX_TRANSFER_REFERENCE_LENGTH = 100;

export function agencyPaymentProofError(
  method: string,
  reference: string | null | undefined,
  hasReceipt: boolean,
): "required" | "tooLong" | null {
  const ref = (reference ?? "").trim();
  if (ref.length > MAX_TRANSFER_REFERENCE_LENGTH) return "tooLong";
  if (method === "bank_transfer" && ref.length === 0 && !hasReceipt) return "required";
  return null;
}

/** Storage path the server accepts: cases/<caseId>/receipts/<file>. */
export function receiptStoragePath(caseId: string, fileName: string, now = Date.now()): string {
  const ext = (fileName.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  return `cases/${caseId}/receipts/${now}.${ext}`;
}
