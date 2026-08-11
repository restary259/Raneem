import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { serverErrorResponse } from "../_shared/errors.ts";
import { resolveIdentity } from "../_shared/identity.ts";
import { z, parseBody, email as emailField, uuid } from "../_shared/validate.ts";
import { createInvitation } from "../_shared/invitations.ts";

/**
 * Digits, spaces, dashes and parentheses are stripped before validation so
 * "05x-xxx xxxx" and "+972 5x ..." are both accepted.
 */
function normalisePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const cleaned = input.replace(/[\s()-.]/g, "");
  return cleaned.length >= 7 ? cleaned : null;
}

function jsonResponse(payload: Record<string, unknown>, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401, corsHeaders);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("create-student-from-case: missing Supabase environment variables");
      return jsonResponse(
        { error: "Server configuration error", code: "SERVER_CONFIGURATION_ERROR" },
        500,
        corsHeaders,
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // ── Validate caller ────────────────────────────────────────────────
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !userData?.user) {
      return jsonResponse({ error: "Invalid token", code: "INVALID_TOKEN" }, 401, corsHeaders);
    }

    const callerId = userData.user.id;

    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .in("role", ["admin", "team_member"]);

    if (rolesError) {
      console.error("create-student-from-case: failed to resolve caller role", {
        callerId,
        error: rolesError,
      });
      return jsonResponse(
        { error: "Unable to verify team member access", code: "ROLE_LOOKUP_FAILED" },
        500,
        corsHeaders,
      );
    }

    if (!roles?.length) {
      console.warn("create-student-from-case: caller has no staff role", { callerId });
      return jsonResponse({ error: "Team member access required", code: "FORBIDDEN" }, 403, corsHeaders);
    }

    const isAdmin = roles.some((role: { role: string }) => role.role === "admin");

    // ── Parse request ──────────────────────────────────────────────────
    // case_id is optional: a student can be invited with a case attached
    // (the common path, which pre-fills the account from the case data) or
    // on its own — the account is simply not linked to any case yet.
    const parsed = await parseBody(
      req,
      z.object({
        case_id: uuid.optional().nullable(),
        student_email: emailField,
        student_full_name: z.string().trim().min(2).max(100),
        student_phone: z.string().trim().max(30).optional().nullable(),
        confirm_transfer: z.boolean().optional(),
      }),
    );

    if (!parsed.ok) {
      console.warn("create-student-from-case: invalid body", parsed.error);
      return jsonResponse({ error: parsed.error, code: "INVALID_INPUT" }, 400, corsHeaders);
    }

    const body = parsed.data;
    const case_id = body.case_id ?? null;
    const student_email = body.student_email;
    const student_full_name = body.student_full_name;
    const student_phone = normalisePhone(body.student_phone);

    if (!student_email || !student_full_name) {
      return jsonResponse(
        { error: "student_email, student_full_name required", code: "MISSING_REQUIRED_FIELDS" },
        400,
        corsHeaders,
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(student_email)) {
      return jsonResponse({ error: "Invalid email format", code: "INVALID_EMAIL" }, 400, corsHeaders);
    }

    // ── Fetch full case data (only when a case is attached) ─────────────
    let caseData: {
      id: string;
      student_user_id: string | null;
      full_name: string;
      phone_number: string | null;
      city: string | null;
      education_level: string | null;
      passport_type: string | null;
      degree_interest: string | null;
      intake_notes: string | null;
      bagrut_score: number | null;
      english_units: number | null;
      math_units: number | null;
      english_level: string | null;
      source: string | null;
      partner_id: string | null;
      assigned_to: string | null;
      created_at: string;
    } | null = null;

    if (case_id) {
      const { data: fetchedCase, error: caseErr } = await supabaseAdmin
        .from("cases")
        .select(
          `id, student_user_id, full_name, phone_number, city,
           education_level, passport_type, degree_interest,
           intake_notes, bagrut_score, english_units, math_units,
           english_level, source, partner_id, assigned_to,
           created_at`,
        )
        .eq("id", case_id)
        .single();

      if (caseErr || !fetchedCase) {
        console.error("create-student-from-case: case lookup failed", { case_id, error: caseErr });
        return jsonResponse({ error: "Case not found", code: "CASE_NOT_FOUND" }, 404, corsHeaders);
      }

      // ── Ownership check ─────────────────────────────────────────────
      if (!isAdmin && fetchedCase.assigned_to !== callerId) {
        console.warn("create-student-from-case: case not assigned to caller", {
          callerId,
          case_id,
          assignedTo: fetchedCase.assigned_to,
        });
        return jsonResponse({ error: "This case is not assigned to you", code: "NOT_ASSIGNED" }, 403, corsHeaders);
      }

      caseData = fetchedCase;
    }

    // ── Durable activation invitation ────────────────────────────────────
    async function createActivationLink(email: string) {
      return await createInvitation(supabaseAdmin, {
        invitedEmail: email,
        invitationType: "student",
        intendedRole: "student",
        invitedName: student_full_name,
        inviterId: callerId,
        caseId: case_id ?? undefined,
      });
    }

    // ── Rate-limit duplicate activation mails ────────────────────────────
    const RESEND_WINDOW_MIN = 10;

    async function recentPendingInvite(email: string) {
      const since = new Date(Date.now() - RESEND_WINDOW_MIN * 60_000).toISOString();
      const { data, error } = await supabaseAdmin
        .from("user_invitations")
        .select("created_at")
        .eq("invited_email", email.toLowerCase())
        .eq("status", "pending")
        .is("accepted_at", null)
        .gt("expires_at", new Date().toISOString())
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn("create-student-from-case: invitation lookup failed", error);
        return null;
      }
      return data?.created_at ?? null;
    }
// Captures the most recent activation link so the API can return it to  
    // staff (used by the "copy activation link" success card in the UI).  
    let capturedActivationUrl: string | null = null;  
  
    // ── Send invitation ───────────────────────────────────────────────────  
    async function sendInvite(email: string, name: string) {  
      try {  
        const alreadySent = await recentPendingInvite(email);  
        if (alreadySent) {  
          console.log("create-student-from-case: skipped duplicate invite", { email, alreadySent });  
          return "already_sent" as const;  
        }  
  
        const activationUrl = await createActivationLink(email);  
        capturedActivationUrl = activationUrl;
    // ── Send invitation ───────────────────────────────────────────────────
    async function sendInvite(email: string, name: string) {
      try {
        const alreadySent = await recentPendingInvite(email);
        if (alreadySent) {
          console.log("create-student-from-case: skipped duplicate invite", { email, alreadySent });
          return "already_sent" as const;
        }

        const activationUrl = await createActivationLink(email);

        let caseReference: string | null = null;
        if (case_id) {
          const { data: caseRef } = await supabaseAdmin
            .from("cases")
            .select("case_reference")
            .eq("id", case_id)
            .maybeSingle();
          caseReference = caseRef?.case_reference ?? null;
        }

        const response = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            templateName: "student-invite",
            recipientEmail: email,
            templateData: {
              studentName: name,
              email,
              caseReference,
              activationUrl,
            },
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("create-student-from-case: invitation email failed", {
            status: response.status,
            error: errorText,
          });
          return false;
        }

        return true;
      } catch (error) {
        console.error("create-student-from-case: invitation error", error);
        return false;
      }
    }

    // ── Existing linked account (case already has a student) ────────────
    if (case_id && caseData?.student_user_id) {
      const { data: linkedUser, error: linkedUserError } = await supabaseAdmin.auth.admin.getUserById(
        caseData.student_user_id,
      );
      const linkedEmail = linkedUser?.user?.email;

      if (linkedUserError || !linkedEmail) {
        return jsonResponse(
          { error: "Linked student account not found", code: "LINKED_ACCOUNT_NOT_FOUND" },
          409,
          corsHeaders,
        );
      }

      const { error: linkedRoleError } = await supabaseAdmin
        .from("user_roles")
        .upsert(
          { user_id: caseData.student_user_id, role: "student" },
          { onConflict: "user_id,role", ignoreDuplicates: true },
        );
      return jsonResponse(  
        {  
          success: true,  
          user_id: caseData.student_user_id,  
          email: linkedEmail,  
          invited: resent === true,  
          already_invited: resent === "already_sent",  
          invitation_failed: resent === false,  
          activation_url: capturedActivationUrl,  
          message:  
            resent === "already_sent"  
              ? "An activation link was already sent recently — ask the student to check their inbox"  
              : resent === true  
                ? "Student account linked and activation link sent"  
                : "Student account linked, but the activation email could not be sent. The invitation can be retried.",  
        },

      if (linkedRoleError) {
        console.error("create-student-from-case: failed to restore student role", linkedRoleError);
        return jsonResponse(
          { error: "Unable to assign student role", code: "ROLE_ASSIGNMENT_FAILED" },
          500,
          corsHeaders,
        );
      }

      const resent = await sendInvite(linkedEmail, student_full_name);

      return jsonResponse(
        {
          success: true,
          user_id: caseData.student_user_id,
          email: linkedEmail,
          invited: resent === true,
          already_invited: resent === "already_sent",
          invitation_failed: resent === false,
          message:
            resent === "already_sent"
              ? "An activation link was already sent recently — ask the student to check their inbox"
              : resent === true
                ? "Student account linked and activation link sent"
                : "Student account linked, but the activation email could not be sent. The invitation can be retried.",
        },
        200,
        corsHeaders,
      );
    }

    // ── Fetch case submission (only when a case is attached) ────────────
    let intakeMonth: string | null = null;
    let universityName: string | null = null;

    if (case_id) {
      const { data: submission } = await supabaseAdmin
        .from("case_submissions")
        .select(`program_id, program_start_date, program_end_date, accommodation_id, service_fee`)
        .eq("case_id", case_id)
        .maybeSingle();

      if (submission?.program_start_date) {
        intakeMonth = submission.program_start_date.substring(0, 7);
      } else if (caseData?.intake_notes) {
        const match = caseData.intake_notes.match(/\d{4}-\d{2}/);
        if (match) intakeMonth = match[0];
      }

      if (submission?.program_id) {
        const { data: programme } = await supabaseAdmin
          .from("master_services")
          .select("school_name, name")
          .eq("id", submission.program_id)
          .maybeSingle();
        universityName = programme?.school_name ?? programme?.name ?? null;
      }

      var submissionRef = submission;
    }

    // ── Resolve identity ──────────────────────────────────────────────────
    const identity = await resolveIdentity(supabaseAdmin, student_email);

    // An existing identity may only be reused when it is a student.
    if (identity.exists && identity.role && identity.role !== "student") {
      return jsonResponse(
        {
          error: "This email already belongs to another account.",
          code: "identity_conflict",
          existing_role: identity.role,
          deactivated: identity.deactivated,
        },
        409,
        corsHeaders,
      );
    }

    const existingUser = identity.exists && identity.userId ? { id: identity.userId } : null;

    // ── Existing student account ─────────────────────────────────────────
    let studentId: string;
    let accountCreated = false;

    if (existingUser) {
      if (case_id) {
        const { data: otherCase } = await supabaseAdmin
          .from("cases")
          .select("id, case_reference, status")
          .eq("student_user_id", existingUser.id)
          .neq("id", case_id)
          .not("status", "in", "(closed,cancelled,rejected)")
          .maybeSingle();

        if (otherCase && !body?.confirm_transfer) {
          return jsonResponse(
            {
              error: "This student already has an active case",
              code: "ALREADY_LINKED",
              existing_case_id: otherCase.id,
              existing_case_reference: otherCase.case_reference,
            },
            409,
            corsHeaders,
          );
        }
      }

      studentId = existingUser.id;
    } else {
      // The bootstrap credential is never returned or emailed.
      // The student chooses their password through the activation link.
      const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
      const bootstrapPassword =
        Array.from(crypto.getRandomValues(new Uint8Array(9)))
          .map((byte) => alphabet[byte % alphabet.length])
          .join("") + "Aa1!";

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: student_email,
        password: bootstrapPassword,
        email_confirm: true,
        user_metadata: {
          full_name: student_full_name,
          phone_number: student_phone ?? caseData?.phone_number ?? "",
        },
      });

      if (createError || !newUser?.user) {
        console.error("create-student-from-case: account creation failed", createError);
        return jsonResponse(
          { error: createError?.message ?? "Unable to create student account", code: "ACCOUNT_CREATION_FAILED" },
          400,
          corsHeaders,
        );
      }

      studentId = newUser.user.id;
      accountCreated = true;
    }

    // ── Assign student role ────────────────────────────────────────────────
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: studentId, role: "student" }, { onConflict: "user_id,role", ignoreDuplicates: true });

    if (roleError) {
      console.error("create-student-from-case: student role assignment failed", roleError);
      return jsonResponse({ error: "Unable to assign student role", code: "ROLE_ASSIGNMENT_FAILED" }, 500, corsHeaders);
    }

    // ── Upsert profile ──────────────────────────────────────────────────────
    const profileUpsert: Record<string, unknown> = {
      id: studentId,
      email: student_email,
      full_name: student_full_name,
      must_change_password: true,
      created_by: callerId,
    };

    if (case_id) profileUpsert.case_id = case_id;

    const phone = student_phone ?? caseData?.phone_number ?? null;
    if (phone) profileUpsert.phone_number = phone;
    if (caseData?.city) profileUpsert.city = caseData.city;
    if (intakeMonth) profileUpsert.intake_month = intakeMonth;
    if (universityName) profileUpsert.university_name = universityName;
    // deno-lint-ignore no-explicit-any
    if ((submissionRef as any)?.program_start_date) {
      // deno-lint-ignore no-explicit-any
      profileUpsert.arrival_date = (submissionRef as any).program_start_date;
    }
    if (caseData?.passport_type) profileUpsert.nationality = caseData.passport_type;

    const noteParts: string[] = [];
    if (caseData?.education_level) noteParts.push(`Education: ${caseData.education_level}`);
    if (caseData?.degree_interest) noteParts.push(`Interest: ${caseData.degree_interest}`);
    if (caseData?.english_level) noteParts.push(`English: ${caseData.english_level}`);
    if (noteParts.length > 0) profileUpsert.notes = noteParts.join(" | ");

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert(profileUpsert);

    if (profileError) {
      console.error("create-student-from-case: profile upsert failed", profileError);
      return jsonResponse(
        { error: "Unable to create student profile", code: "PROFILE_CREATION_FAILED" },
        500,
        corsHeaders,
      );
    }

    // ── Link case → student ──────────────────────────────────────────────
    if (case_id) {
      const { error: caseLinkError } = await supabaseAdmin
        .from("cases")
        .update({ student_user_id: studentId })
        .eq("id", case_id);

      if (caseLinkError) {
        console.error("create-student-from-case: failed to link case", caseLinkError);
        return jsonResponse({ error: "Unable to link student to case", code: "CASE_LINK_FAILED" }, 500, corsHeaders);
      }
    }

    // ── Audit log (non-fatal) ─────────────────────────────────────────────
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", callerId)
      .single();

    try {
      await supabaseAdmin.rpc("log_activity", {
        p_actor_id: callerId,
        p_actor_name: callerProfile?.full_name ?? "Team Member",
        p_action: "student_account_created",
        p_entity_type: case_id ? "case" : "profile",
        p_entity_id: case_id ?? studentId,
        p_metadata: {
          student_email,
          student_full_name,
          student_id: studentId,
          case_id,
          activation_link_issued: true,
          data_exported: {
            city: !!caseData?.city,
            intake_month: !!intakeMonth,
            university: !!universityName,
            // deno-lint-ignore no-explicit-any
            arrival_date: !!(submissionRef as any)?.program_start_date,
            phone: !!phone,
          },
        },
      });
    } catch (error) {
      console.warn("create-student-from-case: audit log failed", error);
    }

    // ── Invitation email ───────────────────────────────────────────────────
    const emailSent = await sendInvite(student_email, student_full_name);

    // IMPORTANT: the student account/case link has already succeeded.
    // A failed invitation email must NOT turn the whole operation into a
    // failed student creation.
    const responsePayload: Record<string, unknown> = {
      success: true,
      user_id: studentId,
      email: student_email,
      invited: emailSent === true,
      already_invited: emailSent === "already_sent",
      invitation_failed: emailSent === false,
      account_created: accountCreated,
      case_linked: !!case_id,
      message:
        emailSent === "already_sent"
          ? "An activation link was already sent recently — ask the student to check their inbox"
          : emailSent === true
            ? accountCreated
              ? "Student account created and activation link sent"
              : "Existing student account linked and activation link sent"
            : accountCreated
              ? "Student account created successfully, but the activation email could not be sent. The invitation can be retried."
              : "Student account linked successfully, but the activation email could not be sent. The invitation can be retried.",
    };

    return jsonResponse(responsePayload, 200, corsHeaders);
  } catch (error) {
    console.error("create-student-from-case: unhandled error", error);
    return serverErrorResponse(error, corsHeaders, "Failed to create student account");
  }
});
