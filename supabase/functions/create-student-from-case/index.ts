import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { serverErrorResponse } from "../_shared/errors.ts";
import { identityConflict, resolveIdentity } from "../_shared/identity.ts";
import { z, parseBody, email as emailField, uuid } from "../_shared/validate.ts";

/** Digits, spaces, dashes and parentheses are stripped before validation so
 *  "05x-xxx xxxx" and "+972 5x ..." are both accepted. */
function normalisePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const cleaned = input.replace(/[\s()\-.]/g, "");
  return cleaned.length >= 7 ? cleaned : null;
}
import { createInvitation } from "../_shared/invitations.ts";



serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // ── Validate caller ────────────────────────────────────────────────
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = userData.user.id;
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .in("role", ["admin", "team_member"]);
    if (!roles?.length) {
      console.warn("invite: caller has no staff role", { callerId });
      return new Response(JSON.stringify({ error: "Team member access required", code: "FORBIDDEN" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const isAdmin = roles.some((r: { role: string }) => r.role === "admin");


    // ── Parse request ──────────────────────────────────────────────────
    const parsed = await parseBody(req, z.object({
      case_id: uuid,
      student_email: emailField,
      // Arabic/Hebrew names, hyphens and apostrophes must all pass.
      student_full_name: z.string().trim().min(2).max(100),
      student_phone: z.string().trim().max(30).optional().nullable(),
      confirm_transfer: z.boolean().optional(),
    }));
    if (!parsed.ok) {
      console.warn("invite: invalid body", parsed.error);
      return new Response(JSON.stringify({ error: parsed.error, code: "INVALID_INPUT" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { case_id, student_email, student_full_name } = parsed.data;
    const student_phone = normalisePhone(parsed.data.student_phone);
    const body = parsed.data;

    if (!case_id || !student_email || !student_full_name) {
      return new Response(JSON.stringify({ error: "case_id, student_email, student_full_name required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(student_email)) {
      return new Response(JSON.stringify({ error: "Invalid email format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Fetch full case data ───────────────────────────────────────────
    // We pull every field that has a corresponding column on profiles so
    // the student account is pre-populated with as much data as possible.
    const { data: caseData, error: caseErr } = await supabaseAdmin
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

    if (caseErr || !caseData) {
      return new Response(JSON.stringify({ error: "Case not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ownership check: a non-admin team member may only create/link a student
    // account for a case that is assigned to them.
    if (!isAdmin && caseData.assigned_to !== callerId) {
      console.warn("invite: case not assigned to caller", { callerId, case_id });
      return new Response(JSON.stringify({ error: "This case is not assigned to you", code: "NOT_ASSIGNED" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }



    // Durable, re-openable activation link. The invitation row (not the URL)
    // carries the case link, so attribution survives refreshes and devices.
    async function createActivationLink(email: string) {
      return await createInvitation(supabaseAdmin, {
        invitedEmail: email,
        invitationType: "student",
        intendedRole: "student",
        inviterId: callerId,
        caseId: case_id,
      });
    }


    // Rate-limit duplicate activation mails: if a pending invitation for this
    // address was created in the last 10 minutes, don't send a second one.
    const RESEND_WINDOW_MIN = 10;
    async function recentPendingInvite(email: string) {
      const since = new Date(Date.now() - RESEND_WINDOW_MIN * 60_000).toISOString();
      const { data } = await supabaseAdmin
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
      return data?.created_at ?? null;
    }

    // Reusable activation mail. Returns true when the message was accepted.
    async function sendInvite(email: string, name: string) {
      try {
        const alreadySent = await recentPendingInvite(email);
        if (alreadySent) {
          console.log("invite: skipped duplicate send", { email, alreadySent });
          return "already_sent" as const;
        }
        const activationUrl = await createActivationLink(email);
        const { data: caseRef } = await supabaseAdmin
          .from("cases")
          .select("case_reference")
          .eq("id", case_id)
          .maybeSingle();
        const resp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-transactional-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            templateName: "student-invite",
            recipientEmail: email,
            templateData: {
              studentName: name,
              email,
              caseReference: caseRef?.case_reference ?? null,
              activationUrl,
            },
          }),
        });
        if (!resp.ok) console.error("invite email failed", await resp.text());
        return resp.ok;
      } catch (e) {
        console.error("invite email error", e);
        return false;
      }
    }

    // Account already linked — issue a fresh one-time activation link.
    if (caseData.student_user_id) {
      const { data: linkedUser, error: linkedUserError } = await supabaseAdmin.auth.admin.getUserById(
        caseData.student_user_id,
      );
      const linkedEmail = linkedUser?.user?.email;
      if (linkedUserError || !linkedEmail) {
        return new Response(JSON.stringify({ error: "Linked student account not found" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error: linkedRoleError } = await supabaseAdmin
        .from("user_roles")
        .upsert(
          { user_id: caseData.student_user_id, role: "student" },
          { onConflict: "user_id,role", ignoreDuplicates: true },
        );
      if (linkedRoleError) throw linkedRoleError;

      const resent = await sendInvite(linkedEmail, student_full_name);
      return new Response(
        JSON.stringify({
          success: true,
          user_id: caseData.student_user_id,
          email: linkedEmail,
          invited: resent === true,
          already_invited: resent === "already_sent",
          message:
            resent === "already_sent"
              ? "An activation link was already sent recently — ask the student to check their inbox"
              : "Student account linked and activation link sent",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }


    // ── Fetch case_submission for programme/school dates ──────────────
    const { data: submission } = await supabaseAdmin
      .from("case_submissions")
      .select(
        `program_id, program_start_date, program_end_date,
         accommodation_id, service_fee`,
      )
      .eq("case_id", case_id)
      .maybeSingle();

    // ── Resolve intake month from intake_notes or programme start date ─
    // intake_notes is a free-text field like "2026-05" or "May 2026"
    // programme start date (YYYY-MM-DD) is more reliable when available
    let intakeMonth: string | null = null;
    if (submission?.program_start_date) {
      // Extract YYYY-MM from ISO date
      intakeMonth = submission.program_start_date.substring(0, 7);
    } else if (caseData.intake_notes) {
      // Try to parse "YYYY-MM" pattern from intake_notes
      const m = caseData.intake_notes.match(/\d{4}-\d{2}/);
      if (m) intakeMonth = m[0];
    }

    // ── Resolve university/school name from programme ─────────────────
    let universityName: string | null = null;
    if (submission?.program_id) {
      const { data: programme } = await supabaseAdmin
        .from("master_services")
        .select("school_name, name")
        .eq("id", submission.program_id)
        .maybeSingle();
      if (programme?.school_name) universityName = programme.school_name;
      else if (programme?.name) universityName = programme.name;
    }

    // ── Check if auth user already exists ─────────────────────────────
    let studentId: string;
    let accountCreated = false;

    const identity = await resolveIdentity(supabaseAdmin, student_email);
    // An existing identity may only be reused when it is a student. A partner,
    // team member or admin email must never be turned into a student account.
    if (identity.exists && identity.role && identity.role !== "student") {
      return new Response(
        JSON.stringify({
          error: "This email already belongs to another account.",
          code: "identity_conflict",
          existing_role: identity.role,
          deactivated: identity.deactivated,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const existingUser = identity.exists && identity.userId
      ? { id: identity.userId }
      : null;


    if (existingUser) {
      // Reuse existing auth account — but never silently move a student that is
      // already the owner of another open case: that produces duplicate cases
      // with inconsistent back-links.
      const { data: otherCase } = await supabaseAdmin
        .from("cases")
        .select("id, case_reference, status")
        .eq("student_user_id", existingUser.id)
        .neq("id", case_id)
        .not("status", "in", "(closed,cancelled,rejected)")
        .maybeSingle();

      if (otherCase && !body?.confirm_transfer) {
        return new Response(
          JSON.stringify({
            error: "This student already has an active case",
            code: "ALREADY_LINKED",
            existing_case_id: otherCase.id,
            existing_case_reference: otherCase.case_reference,
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      studentId = existingUser.id;
    } else {
      // The random bootstrap credential is never returned or emailed. The
      // student chooses their own password through the one-time link below.
      const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
      const bootstrapPassword =
        Array.from(crypto.getRandomValues(new Uint8Array(9)))
          .map((b) => alphabet[b % alphabet.length])
          .join("") + "Aa1!";

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: student_email,
        password: bootstrapPassword,
        email_confirm: true, // skip email verification — admin handles onboarding
        user_metadata: {
          full_name: student_full_name,
          phone_number: student_phone ?? caseData.phone_number ?? "",
        },
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      studentId = newUser.user.id;
      accountCreated = true;
    }

    // ── Assign student role ────────────────────────────────────────────
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: studentId, role: "student" }, { onConflict: "user_id,role", ignoreDuplicates: true });

    // ── Upsert profile — export all available case data ───────────────
    // Only set values that actually exist on the cases record so we don't
    // overwrite existing profile fields with null.
    const profileUpsert: Record<string, unknown> = {
      id: studentId,
      email: student_email,
      full_name: student_full_name,
      must_change_password: true,
      case_id: case_id,
      created_by: callerId,
    };

    // Phone
    const phone = student_phone ?? caseData.phone_number ?? null;
    if (phone) profileUpsert.phone_number = phone;

    // City
    if (caseData.city) profileUpsert.city = caseData.city;

    // Intake month
    if (intakeMonth) profileUpsert.intake_month = intakeMonth;

    // University / school
    if (universityName) profileUpsert.university_name = universityName;

    // Arrival date — derive from programme start date if available
    if (submission?.program_start_date) {
      profileUpsert.arrival_date = submission.program_start_date;
    }

    // Nationality / passport type from case
    if (caseData.passport_type) profileUpsert.nationality = caseData.passport_type;

    // Notes — combine degree interest and education level as starter notes
    const noteParts: string[] = [];
    if (caseData.education_level) noteParts.push(`Education: ${caseData.education_level}`);
    if (caseData.degree_interest) noteParts.push(`Interest: ${caseData.degree_interest}`);
    if (caseData.english_level) noteParts.push(`English: ${caseData.english_level}`);
    if (noteParts.length > 0) profileUpsert.notes = noteParts.join(" | ");

    await supabaseAdmin.from("profiles").upsert(profileUpsert);

    // ── Link case → student ────────────────────────────────────────────
    await supabaseAdmin.from("cases").update({ student_user_id: studentId }).eq("id", case_id);

    // ── Audit log (non-fatal) ─────────────────────────────────────────
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
        p_entity_type: "case",
        p_entity_id: case_id,
        p_metadata: {
          student_email,
          student_full_name,
          student_id: studentId,
          activation_link_issued: true,
          data_exported: {
            city: !!caseData.city,
            intake_month: !!intakeMonth,
            university: !!universityName,
            arrival_date: !!submission?.program_start_date,
            phone: !!phone,
          },
        },
      });
    } catch (_e) {
      /* non-fatal */
    }

    // ── Invitation email ───────────────────────────────────────────────
    const emailSent = await sendInvite(student_email, student_full_name);


    // ── Response ───────────────────────────────────────────────────────
    const responsePayload: Record<string, unknown> = {
      success: true,
      user_id: studentId,
      email: student_email,
      invited: emailSent === true,
      already_invited: emailSent === "already_sent",
      message:
        emailSent === "already_sent"
          ? "An activation link was already sent recently — ask the student to check their inbox"
          : accountCreated
            ? "Student account created and activation link sent"
            : "Existing student account linked and activation link sent",
    };

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return serverErrorResponse(e, corsHeaders, "Failed to create student account");
  }
});
