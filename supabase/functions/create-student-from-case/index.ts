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

/**
 * Generates a readable temporary password for the "manual" creation mode.
 * The suffix guarantees Supabase's complexity requirements are always met.
 */
function generateTempPassword(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return (
    Array.from(crypto.getRandomValues(new Uint8Array(9)))
      .map((byte) => alphabet[byte % alphabet.length])
      .join("") + "Aa1!"
  );
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
    //
    // mode "invite" → email a branded activation link (no password returned).
    // mode "manual" → mint a one-time temp password returned to staff.
    const parsed = await parseBody(
      req,
      z.object({
        case_id: uuid.optional().nullable(),
        student_email: emailField,
        student_full_name: z.string().trim().min(2).max(100),
        student_phone: z.string().trim().max(30).optional().nullable(),
        confirm_transfer: z.boolean().optional(),
        mode: z.enum(["invite", "manual"]).optional().default("invite"),
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
    const mode = body.mode ?? "invite";

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

    // ── Captured activation link (invite mode) + temp password (manual) ──
    let capturedActivationUrl: string | null = null;
    let tempPassword: string | null = null;

    // ── Durable activation invitation ────────────────────────────────────
    async function createActivationLink(email: string) {
      const url = await createInvitation(supabaseAdmin, {
        invitedEmail: email,
        invitationType: "student",
        intendedRole: "student",
        invitedName: student_full_name,
        inviterId: callerId,
        caseId: case_id ?? undefined,
      });
      capturedActivationUrl = url;
      return url;
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

    // ── Resets an existing account's password for the manual path ────────
    // C2: this overwrites a LIVE student password. It must only ever run for
    // accounts this function created moments ago, or by an admin.
    async function resetManualPassword(userId: string) {
      const pwd = generateTempPassword();
      const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: pwd,
      });
      if (pwErr) {
        console.error("create-student-from-case: manual password reset failed", pwErr);
        return null;
      }
      // Force a password change at first sign-in.
      await supabaseAdmin.from("profiles").upsert({ id: userId, must_change_password: true });

      // Security event: record who minted a working credential for the account.
      try {
        await supabaseAdmin.from("admin_audit_log").insert({
          admin_id: callerId,
          action: "student_manual_password_issued",
          target_table: "auth.users",
          target_id: userId,
          details: `Manual password issued for ${student_email} (mode: ${mode}) by ${isAdmin ? "admin" : "team member"}`,
        });
      } catch (error) {
        console.warn("create-student-from-case: password audit log failed", error);
      }

      return pwd;
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

      // onConflict targets the single-column unique index user_roles_one_role_per_user.
      const { error: linkedRoleError } = await supabaseAdmin
        .from("user_roles")
        .upsert(
          { user_id: caseData.student_user_id, role: "student" },
          { onConflict: "user_id", ignoreDuplicates: true },
        );

      if (linkedRoleError) {
        console.error("create-student-from-case: failed to restore student role", linkedRoleError);
        return jsonResponse(
          { error: "Unable to assign student role", code: "ROLE_ASSIGNMENT_FAILED" },
          500,
          corsHeaders,
        );
      }

      // Manual path: reset the linked account's password and return it.
      // A live student account must not be handed to a non-admin caller.
      if (mode === "manual") {
        if (!isAdmin) {
          return jsonResponse(
            {
              error:
                "This student already has an account. Resetting its password is restricted to admins — use the invitation mode instead.",
              code: "PASSWORD_RESET_FORBIDDEN",
            },
            403,
            corsHeaders,
          );
        }
        tempPassword = await resetManualPassword(caseData.student_user_id);
        if (!tempPassword) {
          return jsonResponse(
            { error: "Unable to set a temporary password", code: "PASSWORD_RESET_FAILED" },
            500,
            corsHeaders,
          );
        }
        return jsonResponse(
          {
            success: true,
            user_id: caseData.student_user_id,
            email: linkedEmail,
            mode: "manual",
            account_created: false,
            case_linked: true,
            temp_password: tempPassword,
            message: "Student account linked. Share the temporary password with the student.",
          },
          200,
          corsHeaders,
        );
      }

      // The linked student already has an activated auth account, so an
      // activation invite would be a dead link: accept-invitation rejects any
      // email that already belongs to an account. Do not email one; the case
      // is already linked, so just confirm that.
      return jsonResponse(
        {
          success: true,
          user_id: caseData.student_user_id,
          email: linkedEmail,
          mode: "invite",
          account_created: false,
          case_linked: true,
          invited: false,
          already_activated: true,
          message: "This student already has an activated account; no activation email was sent.",
        },
        200,
        corsHeaders,
      );
    }

    // ── Fetch case submission (only when a case is attached) ────────────
    let intakeMonth: string | null = null;
    let universityName: string | null = null;
    let programStartDate: string | null = null;
    let dateOfBirth: string | null = null;

    if (case_id) {
      const { data: submission } = await supabaseAdmin
        .from("case_submissions")
        .select(`program_id, program_start_date, program_end_date, accommodation_id, service_fee, extra_data`)
        .eq("case_id", case_id)
        .maybeSingle();

      if (submission?.program_start_date) {
        programStartDate = submission.program_start_date;
        intakeMonth = submission.program_start_date.substring(0, 7);
      } else if (caseData?.intake_notes) {
        const match = caseData.intake_notes.match(/\d{4}-\d{2}/);
        if (match) intakeMonth = match[0];
      }

      const extra = submission?.extra_data as Record<string, unknown> | null;
      if (extra && typeof extra.date_of_birth === "string" && extra.date_of_birth) {
        dateOfBirth = extra.date_of_birth;
      }

      if (submission?.program_id) {
        const { data: programme } = await supabaseAdmin
          .from("programs")
          .select("name_ar, name_en")
          .eq("id", submission.program_id)
          .maybeSingle();
        universityName = programme?.name_en ?? programme?.name_ar ?? null;
      }
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
    let studentId: string | null = null;
    let accountCreated = false;

    if (existingUser) {
      if (case_id) {
        const { data: otherCase } = await supabaseAdmin
          .from("cases")
          .select("id, case_reference, status, assigned_to")
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

        // H4: only an admin, or a team member assigned to the student's
        // current case, may move the student between active cases.
        if (otherCase && body?.confirm_transfer && !isAdmin && otherCase.assigned_to !== callerId) {
          console.warn("create-student-from-case: case transfer denied", {
            callerId,
            case_id,
            otherCaseId: otherCase.id,
            otherCaseAssignedTo: otherCase.assigned_to,
          });
          return jsonResponse(
            {
              error: "This student is assigned to a case you do not own. Only an admin can transfer them.",
              code: "TRANSFER_FORBIDDEN",
            },
            403,
            corsHeaders,
          );
        }
      }

      studentId = existingUser.id;

      // Manual path: reset the existing account's password and return it.
      // A live student account must not be handed to a non-admin caller.
      if (mode === "manual") {
        if (!isAdmin) {
          return jsonResponse(
            {
              error:
                "This email already belongs to a student account. Resetting its password is restricted to admins — use the invitation mode instead.",
              code: "PASSWORD_RESET_FORBIDDEN",
            },
            403,
            corsHeaders,
          );
        }
        tempPassword = await resetManualPassword(studentId);
        if (!tempPassword) {
          return jsonResponse(
            { error: "Unable to set a temporary password", code: "PASSWORD_RESET_FAILED" },
            500,
            corsHeaders,
          );
        }
      } else {
        // Invite mode + an existing STUDENT account that is already activated:
        // accept-invitation would reject the email, so a fresh activation link is
        // dead. Link the case now and return without emailing.
        if (case_id) {
          await supabaseAdmin
            .from("cases")
            .update({ student_user_id: studentId })
            .eq("id", case_id);
        }
        return jsonResponse(
          {
            success: true,
            user_id: studentId,
            email: student_email,
            mode: "invite",
            account_created: false,
            case_linked: !!case_id,
            invited: false,
            already_activated: true,
            message: "This student already has an activated account; no activation email was sent.",
          },
          200,
          corsHeaders,
        );
      }
    } else {
      // Brand-new email. Manual mode must still create the auth account and
      // return a temp password. Invite mode no longer pre-creates the auth
      // account: the durable invitation (createInvitation) + activation email
      // are enough, and accept-invitation creates the account, assigns the
      // student role, upserts the profile, and links the case at activation.
      // Pre-creating here would let a resend race produce an "email already
      // belongs to an account" rejection from accept-invitation.
      if (mode === "manual") {
        const password = generateTempPassword();
        tempPassword = password;

        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: student_email,
          password,
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
      } else {
        // Invite mode: no auth account is created yet. sendInvite (below) mints
        // the durable invitation via createInvitation — which carries case_id,
        // intended_role = "student" and invited_name so activation can rebuild
        // the account. The role/profile/case-link steps below are skipped (they
        // require a studentId) and happen at activation time instead.
      }
    }

    // Role assignment, profile seeding and case linking only run when an auth
    // account exists (manual mode, or an already-activated existing student
    // handled above). In invite-new mode there is no user_id yet, so skip.
    if (!studentId) {
      // Invite mode for a brand-new email: send the activation email and
      // return. No account was created, so account_created is false.
      const emailSent = await sendInvite(student_email, student_full_name);
      const inviteActivationUrl = emailSent === false && isAdmin ? capturedActivationUrl : null;
      return jsonResponse(
        {
          success: true,
          user_id: null,
          email: student_email,
          mode: "invite",
          invited: emailSent === true,
          already_invited: emailSent === "already_sent",
          invitation_failed: emailSent === false,
          account_created: false,
          case_linked: !!case_id,
          activation_url: inviteActivationUrl,
          message:
            emailSent === "already_sent"
              ? "An activation link was already sent recently — ask the student to check their inbox"
              : emailSent === true
                ? "Activation link sent"
                : "The activation email could not be sent. The invitation can be retried.",
        },
        200,
        corsHeaders,
      );
    }

    // ── Assign student role ────────────────────────────────────────────────
    // onConflict targets the single-column unique index user_roles_one_role_per_user.
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: studentId, role: "student" }, { onConflict: "user_id", ignoreDuplicates: true });

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
    if (programStartDate) profileUpsert.arrival_date = programStartDate;
    if (caseData?.passport_type) profileUpsert.nationality = caseData.passport_type;
    if (dateOfBirth) profileUpsert.date_of_birth = dateOfBirth;

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
          mode,
          activation_link_issued: mode === "invite",
          data_exported: {
            city: !!caseData?.city,
            intake_month: !!intakeMonth,
            university: !!universityName,
            arrival_date: !!programStartDate,
            phone: !!phone,
          },
        },
      });
    } catch (error) {
      console.warn("create-student-from-case: audit log failed", error);
    }

    // ── Manual mode: return the temp password, no email ─────────────────
    if (mode === "manual") {
      return jsonResponse(
        {
          success: true,
          user_id: studentId,
          email: student_email,
          mode: "manual",
          account_created: accountCreated,
          case_linked: !!case_id,
          temp_password: tempPassword,
          message: accountCreated
            ? "Student account created. Share the temporary password with the student."
            : "Student account updated. Share the temporary password with the student.",
        },
        200,
        corsHeaders,
      );
    }

    // ── Invite mode: send the activation email ──────────────────────────
    // All invite paths return above (linked account, existing student, new
    // email). This is a defensive fallback for any manual-mode path that did
    // not return — it never executes in practice.
    return jsonResponse(
      {
        success: true,
        user_id: studentId,
        email: student_email,
        mode: "invite",
        account_created: false,
        case_linked: !!case_id,
        message: "Activation link sent",
      },
      200,
      corsHeaders,
    );
  } catch (error) {
    console.error("create-student-from-case: unhandled error", error);
    return serverErrorResponse(error, corsHeaders, "Failed to create student account");
  }
});
