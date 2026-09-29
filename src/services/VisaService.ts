import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { normalizeVisaStatus, type VisaStatus } from "@/lib/visaStatus";

/**
 * Visa workflow data access — one module for every DB call the Admin Visa
 * workspace makes, so components stay presentational.
 *
 * Architectural rules enforced here:
 *  - Visa is NEVER a `cases.status`; nothing here writes `cases.status`.
 *  - Status lives in the canonical dynamic store (`visa_field_values` for the
 *    field whose `field_key = 'visa_status'`) — there is no second status.
 *  - Files stay in `documents`; `visa_application_documents` only links to an
 *    EXISTING row (never copies a file, never deletes one).
 *  - Audit goes through the existing `log_case_event` RPC.
 */

export interface VisaQueueRow {
  case_id: string;
  case_reference: string | null;
  student_user_id: string | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  assigned_to: string | null;
  assigned_name: string | null;
  enrolled_at: string | null;
  planned_arrival: string | null;
  actual_arrival: string | null;
  visa_status: string;
  visa_applied_at: string | null;
  visa_application_id: string | null;
  document_count: number;
  selected_document_count: number;
  created_at: string;
  updated_at: string;
}

export interface VisaField {
  id: string;
  field_key: string;
  label_en: string;
  label_ar: string;
  field_type: string;
  options_json: Array<{ value: string; en?: string; ar?: string }> | null;
  is_required: boolean;
  display_order: number;
}

export interface VisaDocument {
  id: string;
  file_name: string;
  file_url: string;
  category: string;
  file_size: number | null;
  file_type: string | null;
  notes: string | null;
  created_at: string;
  uploaded_by: string | null;
  uploader_name: string | null;
}

export interface VisaApplicationRow {
  id: string;
  case_id: string;
  student_user_id: string | null;
  arrived_in_germany_at: string | null;
  visa_applied_at: string | null;
  visa_outcome: string | null;
  additional_notes: string | null;
  visa_notes: string | null;
  health_insurance_url: string | null;
  accommodation_proof_url: string | null;
  bank_statement_url: string | null;
  submission_snapshot: Json | null;
}

export interface VisaProfileInfo {
  id: string;
  full_name: string | null;
  email: string | null;
  phone_number: string | null;
  university_name: string | null;
  arrival_date: string | null;
  eye_color: string | null;
  passport_expiry: string | null;
  nationality: string | null;
  has_changed_legal_name: boolean | null;
  previous_legal_name: string | null;
  has_criminal_record: boolean | null;
  criminal_record_details: string | null;
  has_dual_citizenship: boolean | null;
  second_passport_country: string | null;
}

export interface VisaDetail {
  application: VisaApplicationRow | null;
  profile: VisaProfileInfo | null;
  fields: VisaField[];
  values: Record<string, string>; // field_id → value
  documentIds: Record<string, string>; // field_id → visa_field_values.id
  documents: VisaDocument[];
  selectedDocumentIds: string[];
}

const toStoragePath = (fileUrl: string): string => {
  const marker = "/student-documents/";
  const idx = fileUrl.indexOf(marker);
  return idx !== -1 ? fileUrl.slice(idx + marker.length) : fileUrl;
};

const errMsg = (e: unknown): string =>
  e instanceof Error
    ? e.message
    : typeof e === "string"
      ? e
      : "Unexpected error";

const APPLICATION_COLUMNS =
  "id, case_id, student_user_id, arrived_in_germany_at, visa_applied_at, visa_outcome, additional_notes, visa_notes, health_insurance_url, accommodation_proof_url, bank_statement_url, submission_snapshot";

/* ─────────────────────────── Queue ─────────────────────────── */

export async function loadVisaQueue(): Promise<VisaQueueRow[]> {
  const { data, error } = await supabase.rpc("get_admin_visa_queue");
  if (error) throw error;
  return ((data ?? []) as VisaQueueRow[]).map((r) => ({
    ...r,
    visa_status: normalizeVisaStatus(r.visa_status),
    document_count: Number(r.document_count ?? 0),
    selected_document_count: Number(r.selected_document_count ?? 0),
  }));
}

/* ─────────────────────────── Detail ────────────────────────── */

/**
 * Everything the detail workspace needs, fetched in ONE parallel batch (no
 * N+1: documents are loaded only for the opened case, never for the queue).
 */
export async function loadVisaDetail(
  caseId: string,
  studentUserId: string,
): Promise<VisaDetail> {
  const [appRes, profileRes, fieldsRes, valuesRes, docsRes] = await Promise.all(
    [
      supabase
        .from("visa_applications")
        .select(APPLICATION_COLUMNS)
        .eq("case_id", caseId)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select(
          "id, full_name, email, phone_number, university_name, arrival_date, eye_color, passport_expiry, nationality, has_changed_legal_name, previous_legal_name, has_criminal_record, criminal_record_details, has_dual_citizenship, second_passport_country",
        )
        .eq("id", studentUserId)
        .maybeSingle(),
      supabase
        .from("visa_fields")
        .select(
          "id, field_key, label_en, label_ar, field_type, options_json, is_required, display_order",
        )
        .eq("is_active", true)
        .order("display_order"),
      supabase
        .from("visa_field_values")
        .select("id, field_id, value")
        .eq("student_user_id", studentUserId),
      supabase
        .from("documents")
        .select(
          "id, file_name, file_url, category, file_size, file_type, notes, created_at, uploaded_by",
        )
        .eq("student_id", studentUserId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
    ],
  );

  if (appRes.error && appRes.error.code !== "PGRST116") throw appRes.error;
  if (fieldsRes.error) throw fieldsRes.error;
  if (docsRes.error) throw docsRes.error;

  const fields = (fieldsRes.data ?? []) as VisaField[];
  const values: Record<string, string> = {};
  const documentIds: Record<string, string> = {};
  (
    (valuesRes.data ?? []) as Array<{
      id: string;
      field_id: string;
      value: string | null;
    }>
  ).forEach((v) => {
    values[v.field_id] = v.value ?? "";
    documentIds[v.field_id] = v.id;
  });

  // Resolve uploader display names for the document list (one batched query).
  const rawDocs = (docsRes.data ?? []) as Omit<VisaDocument, "uploader_name">[];
  const uploaderIds = [
    ...new Set(rawDocs.map((d) => d.uploaded_by).filter(Boolean) as string[]),
  ];
  const uploaderMap: Record<string, string> = {};
  if (uploaderIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", uploaderIds);
    (profs ?? []).forEach(
      (p: { id: string; full_name: string | null; email: string | null }) => {
        uploaderMap[p.id] = p.full_name || p.email || "";
      },
    );
  }
  const documents: VisaDocument[] = rawDocs.map((d) => ({
    ...d,
    uploader_name: d.uploaded_by ? uploaderMap[d.uploaded_by] || null : null,
  }));

  // Selected document links (only meaningful when an application row exists).
  let selectedDocumentIds: string[] = [];
  const application = (appRes.data ?? null) as VisaApplicationRow | null;
  if (application?.id) {
    const { data: links } = await supabase
      .from("visa_application_documents")
      .select("document_id")
      .eq("visa_application_id", application.id);
    selectedDocumentIds = ((links ?? []) as Array<{ document_id: string }>).map(
      (l) => l.document_id,
    );
  }

  return {
    application,
    profile: (profileRes.data ?? null) as VisaProfileInfo | null,
    fields,
    values,
    documentIds,
    documents,
    selectedDocumentIds,
  };
}

/* ─────────────────────── Arrival / workflow ────────────────────── */

/**
 * Create the `visa_applications` row if absent (lazily — never pre-created for
 * every enrolled case) and stamp the actual arrival. Leaves `cases.status`
 * untouched (`enrollment_paid` stays).
 */
export async function markStudentArrived(
  caseId: string,
  studentUserId: string,
  actorId: string | null,
): Promise<void> {
  const now = new Date().toISOString();
  const { data: existing, error: readErr } = await supabase
    .from("visa_applications")
    .select("id")
    .eq("case_id", caseId)
    .maybeSingle();
  if (readErr && readErr.code !== "PGRST116") throw readErr;

  if (existing?.id) {
    const { error } = await supabase
      .from("visa_applications")
      .update({ arrived_in_germany_at: now, updated_at: now })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("visa_applications").insert({
      case_id: caseId,
      student_user_id: studentUserId,
      arrived_in_germany_at: now,
      visa_outcome: "pending",
    });
    if (error) throw error;
  }

  await logEvent(caseId, "student_arrived_in_germany", {
    arrived_at: now,
    actor_id: actorId,
  });
}

/** Explicitly start the visa file for a case (idempotent — one row per case). */
export async function startVisaFile(
  caseId: string,
  studentUserId: string,
  actorId: string | null,
  arrivedAt: string | null,
): Promise<void> {
  const { data: existing, error: readErr } = await supabase
    .from("visa_applications")
    .select("id")
    .eq("case_id", caseId)
    .maybeSingle();
  if (readErr && readErr.code !== "PGRST116") throw readErr;
  if (existing?.id) return;

  const { error } = await supabase.from("visa_applications").insert({
    case_id: caseId,
    student_user_id: studentUserId,
    arrived_in_germany_at: arrivedAt,
    visa_outcome: "pending",
  });
  if (error) throw error;

  await logEvent(caseId, "visa_file_started", {
    actor_id: actorId,
    student_user_id: studentUserId,
  });
}

/**
 * Returns the application id, creating the row lazily on first use. This is the
 * single lazy-creation path — an application is never pre-created just to
 * populate the queue.
 */
export async function ensureVisaApplication(
  caseId: string,
  studentUserId: string,
  actorId: string | null,
  arrivedAt: string | null,
): Promise<string> {
  const { data: existing, error: readErr } = await supabase
    .from("visa_applications")
    .select("id")
    .eq("case_id", caseId)
    .maybeSingle();
  if (readErr && readErr.code !== "PGRST116") throw readErr;
  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from("visa_applications")
    .insert({
      case_id: caseId,
      student_user_id: studentUserId,
      arrived_in_germany_at: arrivedAt,
      visa_outcome: "pending",
    })
    .select("id")
    .single();
  if (error) throw error;

  await logEvent(caseId, "visa_file_started", {
    actor_id: actorId,
    student_user_id: studentUserId,
  });
  return created.id;
}

/** Update the recorded actual arrival (never touches the planned arrival). */
export async function updateActualArrival(
  applicationId: string,
  arrivedAt: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("visa_applications")
    .update({
      arrived_in_germany_at: arrivedAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", applicationId);
  if (error) throw error;
}

/* ─────────────────────────── Status ────────────────────────── */

export interface SetVisaStatusArgs {
  caseId: string;
  studentUserId: string;
  fieldId: string;
  valueId?: string;
  previousStatus: VisaStatus;
  newStatus: VisaStatus;
  applicationId: string | null;
  actorId: string | null;
  /** Immutable audit snapshot, captured ONLY when moving to `applied`. */
  snapshot?: Json;
}

/** Upsert one dynamic field value — the ONE writer for `visa_field_values`. */
async function writeFieldValue(params: {
  fieldId: string;
  studentUserId: string;
  value: string;
  valueId?: string;
}): Promise<void> {
  const row: {
    id?: string;
    field_id: string;
    student_user_id: string;
    value: string;
    updated_at: string;
  } = {
    field_id: params.fieldId,
    student_user_id: params.studentUserId,
    value: params.value,
    updated_at: new Date().toISOString(),
  };
  if (params.valueId) row.id = params.valueId;
  const { error } = await supabase
    .from("visa_field_values")
    .upsert(row, { onConflict: "field_id,student_user_id" });
  if (error) throw error;
}

/**
 * Persist a Visa status change on the canonical dynamic field and mirror the
 * (outcome / applied_at / immutable snapshot) onto the application row. Logs
 * the matching audit event. Never touches `cases.status`.
 */
export async function setVisaStatus(args: SetVisaStatusArgs): Promise<void> {
  const now = new Date().toISOString();

  await writeFieldValue({
    fieldId: args.fieldId,
    studentUserId: args.studentUserId,
    value: args.newStatus,
    valueId: args.valueId,
  });

  if (args.applicationId) {
    const patch: {
      updated_at: string;
      visa_applied_at?: string;
      visa_outcome?: string;
      submission_snapshot?: Json;
    } = { updated_at: now };
    if (args.newStatus === "applied") {
      patch.visa_applied_at = now;
      patch.visa_outcome = "pending";
      if (args.snapshot) patch.submission_snapshot = args.snapshot;
    }
    if (args.newStatus === "approved") patch.visa_outcome = "approved";
    if (args.newStatus === "rejected") patch.visa_outcome = "rejected";

    const { error: appErr } = await supabase
      .from("visa_applications")
      .update(patch)
      .eq("id", args.applicationId);
    if (appErr) throw appErr;
  }

  const eventType =
    args.newStatus === "applied"
      ? "visa_application_submitted"
      : args.newStatus === "approved"
        ? "visa_approved"
        : args.newStatus === "rejected"
          ? "visa_rejected"
          : args.newStatus === "received"
            ? "visa_received"
            : "visa_status_changed";

  await logEvent(args.caseId, eventType, {
    previous_status: args.previousStatus,
    new_status: args.newStatus,
  });
}

/** Persist edits to the non-status dynamic visa fields (admin consolidated view). */
export async function saveVisaFieldValues(params: {
  studentUserId: string;
  updates: Array<{ fieldId: string; value: string; valueId?: string }>;
}): Promise<void> {
  for (const update of params.updates) {
    await writeFieldValue({
      fieldId: update.fieldId,
      studentUserId: params.studentUserId,
      value: update.value,
      valueId: update.valueId,
    });
  }
}

/* ────────────────────────── Documents ──────────────────────── */

export async function attachVisaDocument(params: {
  applicationId: string;
  documentId: string;
  actorId: string | null;
  caseId: string;
  documentName: string;
  category: string;
}): Promise<void> {
  const { error } = await supabase.from("visa_application_documents").insert({
    visa_application_id: params.applicationId,
    document_id: params.documentId,
    added_by: params.actorId,
  });
  // 23505 = unique violation → already linked; treat as success (idempotent).
  if (error && error.code !== "23505") throw error;

  await logEvent(params.caseId, "visa_document_attached", {
    document_id: params.documentId,
    document_name: params.documentName,
    category: params.category,
  });
}

/** Removes ONLY the link row. The underlying `documents` row is never deleted. */
export async function detachVisaDocument(params: {
  applicationId: string;
  documentId: string;
  caseId: string;
  documentName: string;
  category: string;
}): Promise<void> {
  const { error } = await supabase
    .from("visa_application_documents")
    .delete()
    .eq("visa_application_id", params.applicationId)
    .eq("document_id", params.documentId);
  if (error) throw error;

  await logEvent(params.caseId, "visa_document_removed", {
    document_id: params.documentId,
    document_name: params.documentName,
    category: params.category,
  });
}

/* ──────────────────────────── Notes ─────────────────────────── */

export async function saveVisaNotes(
  applicationId: string,
  notes: string,
): Promise<void> {
  const { error } = await supabase
    .from("visa_applications")
    .update({ visa_notes: notes, updated_at: new Date().toISOString() })
    .eq("id", applicationId);
  if (error) throw error;
}

/* ──────────────────────── Signed URLs ───────────────────────── */

/**
 * Short-lived signed URL for a private `student-documents` object. The bucket is
 * private — a raw public URL is never exposed.
 */
export async function createVisaDocumentUrl(
  fileUrl: string,
  expiresInSeconds = 120,
): Promise<string> {
  const path = toStoragePath(fileUrl);
  const { data, error } = await supabase.storage
    .from("student-documents")
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

/**
 * Download via a signed URL into a blob, exactly like DocumentsPanel. Never
 * `window.open(publicUrl)`.
 */
export async function downloadVisaDocument(
  fileUrl: string,
  fileName: string,
): Promise<void> {
  const signedUrl = await createVisaDocumentUrl(fileUrl, 60);
  const resp = await fetch(signedUrl);
  if (!resp.ok) throw new Error("Failed to fetch file");
  const blob = await resp.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = window.document.createElement("a");
  a.href = blobUrl;
  a.download = fileName;
  a.style.display = "none";
  window.document.body.appendChild(a);
  a.click();
  window.document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

/* ──────────────────────────── Events ────────────────────────── */

async function logEvent(
  caseId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.rpc("log_case_event", {
    p_case_id: caseId,
    p_event_type: eventType,
    p_payload: payload as never,
    p_is_internal: true,
  });
  if (error) throw error;
}

export { errMsg as visaErrMsg, toStoragePath as visaStoragePath };
