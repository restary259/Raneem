import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { z, parseBody, uuid } from "../_shared/validate.ts";

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return new Response(
        JSON.stringify({
          error: "Supabase environment variables are not configured.",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    /*
     * Service-role client.
     *
     * Used only after the caller has been authenticated and authorized.
     */
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    /*
     * ------------------------------------------------------------
     * AUTHENTICATION
     * ------------------------------------------------------------
     */

    const authHeader = req.headers.get("Authorization") ?? "";

    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    /*
     * ------------------------------------------------------------
     * ADMIN AUTHORIZATION
     * ------------------------------------------------------------
     */

    const { data: roles, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .limit(1);

    if (roleError) {
      console.error("Failed to check admin role:", roleError);

      return new Response(
        JSON.stringify({
          error: "Unable to verify administrator permissions.",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    if (!roles?.length) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    /*
     * ------------------------------------------------------------
     * REQUEST VALIDATION
     * ------------------------------------------------------------
     */

    const parsed = await parseBody(
      req,
      z.object({
        case_id: uuid,
      }),
    );

    if (!parsed.ok) {
      return new Response(
        JSON.stringify({
          error: parsed.error,
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const { case_id } = parsed.data;

    /*
     * ------------------------------------------------------------
     * FETCH CASE
     * ------------------------------------------------------------
     */

    const { data: caseRow, error: caseError } = await supabaseAdmin
      .from("cases")
      .select("id, status, updated_at")
      .eq("id", case_id)
      .maybeSingle();

    if (caseError) {
      console.error("Failed to fetch case:", caseError);

      return new Response(
        JSON.stringify({
          error: "Unable to load case.",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    if (!caseRow) {
      return new Response(
        JSON.stringify({
          error: "Case not found",
        }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    /*
     * ------------------------------------------------------------
     * IDEMPOTENCY
     * ------------------------------------------------------------
     *
     * If the case is already enrolled, there is nothing else to do.
     *
     * This prevents duplicate commission/payment processing when
     * an Admin double-clicks or retries the request.
     */

    if (caseRow.status === "enrollment_paid") {
      return new Response(
        JSON.stringify({
          ok: true,
          already_enrolled: true,
          message: "Case is already marked as enrollment paid.",
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    /*
     * ------------------------------------------------------------
     * AUTHORITATIVE ENROLLMENT GATE
     * ------------------------------------------------------------
     *
     * IMPORTANT:
     *
     * The Edge Function does NOT decide whether Germany payments
     * are complete.
     *
     * The database function is the authoritative source.
     *
     * This prevents the client from bypassing:
     *
     *   - required course payment
     *   - required accommodation payment
     *   - required insurance payment
     *   - payment confirmation status
     *   - payment amount validation
     *
     * The function is called through the user's JWT so the
     * database can apply its own authorization rules.
     */

    const userClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const { data: gateResult, error: gateError } = await userClient.rpc("assert_case_ready_for_enrollment", {
      p_case_id: case_id,
    });

    if (gateError) {
      console.error("Enrollment gate rejected case:", gateError);

      return new Response(
        JSON.stringify({
          error: gateError.message || "Case is not ready for enrollment.",
          code: "ENROLLMENT_GATE_FAILED",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    /*
     * The RPC may return JSON describing the checks.
     * We intentionally do not trust the client for this decision;
     * the fact that the RPC succeeded is the authoritative result.
     */

    /*
     * ------------------------------------------------------------
     * RE-FETCH CASE
     * ------------------------------------------------------------
     *
     * Protect against a race where the case was changed between
     * the first read and the enrollment gate.
     */

    const { data: currentCase, error: currentCaseError } = await supabaseAdmin
      .from("cases")
      .select("id, status")
      .eq("id", case_id)
      .maybeSingle();

    if (currentCaseError) {
      console.error("Failed to re-fetch case:", currentCaseError);

      return new Response(
        JSON.stringify({
          error: "Unable to verify current case state.",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    if (!currentCase) {
      return new Response(
        JSON.stringify({
          error: "Case not found",
        }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    if (currentCase.status === "enrollment_paid") {
      return new Response(
        JSON.stringify({
          ok: true,
          already_enrolled: true,
          message: "Case is already marked as enrollment paid.",
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    /*
     * ------------------------------------------------------------
     * FINAL STATUS UPDATE
     * ------------------------------------------------------------
     *
     * At this point:
     *
     *   1. Caller is authenticated.
     *   2. Caller is Admin.
     *   3. Case exists.
     *   4. Database enrollment gate passed.
     *
     * Only now can the case become enrollment_paid.
     */

    const now = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from("cases")
      .update({
        status: "enrollment_paid",
        updated_at: now,
      })
      .eq("id", case_id)
      .neq("status", "enrollment_paid");

    if (updateError) {
      console.error("Failed to mark case as enrollment_paid:", updateError);

      throw updateError;
    }

    /*
     * ------------------------------------------------------------
     * UPDATE SUBMISSION MIRROR FIELDS
     * ------------------------------------------------------------
     *
     * These fields are retained for compatibility with existing
     * UI/reporting code.
     *
     * They are NOT the authoritative enrollment/payment source.
     *
     * The authoritative source is:
     *
     *   case_payments
     *   + database enrollment gate
     */

    const { error: submissionUpdateError } = await supabaseAdmin
      .from("case_submissions")
      .update({
        enrollment_paid_at: now,
        enrollment_paid_by: user.id,
      })
      .eq("case_id", case_id);

    if (submissionUpdateError) {
      /*
       * Do not roll back enrollment solely because legacy mirror
       * fields could not be updated.
       *
       * Log it so it can be repaired.
       */
      console.error("Failed to update case submission enrollment fields:", submissionUpdateError);
    }

    /*
     * ------------------------------------------------------------
     * ACTIVITY LOG
     * ------------------------------------------------------------
     *
     * Best effort only.
     * Failure here must never undo a successful enrollment.
     */

    try {
      const { error: activityError } = await supabaseAdmin.rpc("log_activity", {
        p_actor_id: user.id,
        p_actor_name: "Admin",
        p_action: "case_marked_paid",
        p_entity_type: "cases",
        p_entity_id: case_id,
        p_metadata: {
          paid_at: now,
          enrollment_gate: "passed",
        },
      });

      if (activityError) {
        console.error("Activity log failed:", activityError);
      }
    } catch (activityError) {
      console.error("Activity log exception:", activityError);
    }

    /*
     * ------------------------------------------------------------
     * AUDIT LOG
     * ------------------------------------------------------------
     *
     * Best effort only.
     */

    try {
      const { error: auditError } = await supabaseAdmin.from("admin_audit_log").insert({
        admin_id: user.id,
        action: "admin_mark_paid",
        target_id: case_id,
        target_table: "cases",
        details: `Admin marked case as enrollment_paid at ${now}`,
      });

      if (auditError) {
        console.error("Admin audit log failed:", auditError);
      }
    } catch (auditError) {
      console.error("Admin audit log exception:", auditError);
    }

    /*
     * ------------------------------------------------------------
     * ENROLLMENT-CONFIRMED EMAIL
     * ------------------------------------------------------------
     *
     * Best effort only. The student-facing confirmation email is a
     * nice-to-have next to the authoritative status change (the in-app
     * notification is already covered by the case_events trigger chain),
     * so a mail failure must never fail or roll back the enrollment.
     */

    try {
      const { data: enrollmentData, error: enrollmentDataError } = await supabaseAdmin
        .from("cases")
        .select("case_reference, full_name, student_user_id, email")
        .eq("id", case_id)
        .maybeSingle();

      if (enrollmentDataError) {
        console.error("Failed to fetch enrollment email data:", enrollmentDataError);
      } else {
        let studentEmail = enrollmentData?.email ?? null;

        if (!studentEmail) {
          const { data: submissionRow } = await supabaseAdmin
            .from("case_submissions")
            .select("student_email")
            .eq("case_id", case_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          studentEmail = submissionRow?.student_email ?? null;
        }

        if (!studentEmail && enrollmentData?.student_user_id) {
          const { data: profileRow } = await supabaseAdmin
            .from("profiles")
            .select("email")
            .eq("id", enrollmentData.student_user_id)
            .maybeSingle();
          studentEmail = profileRow?.email ?? null;
        }

        if (studentEmail) {
          const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({
              templateName: "enrollment-confirmed",
              recipientEmail: studentEmail,
              templateData: {
                studentName: enrollmentData?.full_name ?? undefined,
                caseReference: enrollmentData?.case_reference ?? undefined,
                dashboardUrl: "https://darb.agency/student",
              },
            }),
          });

          if (!emailRes.ok) {
            console.error("Enrollment-confirmed email failed:", {
              status: emailRes.status,
              error: await emailRes.text(),
            });
          }
        } else {
          console.warn("Enrollment-confirmed email skipped: no student email on case", {
            case_id,
          });
        }
      }
    } catch (emailError) {
      console.error("Enrollment-confirmed email exception:", emailError);
    }

    /*
     * ------------------------------------------------------------
     * SUCCESS
     * ------------------------------------------------------------
     */

    return new Response(
      JSON.stringify({
        ok: true,
        case_id,
        status: "enrollment_paid",
        enrollment_gate: gateResult ?? {
          ok: true,
        },
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (err) {
    console.error("admin-mark-paid failed:", err);

    const message = err instanceof Error ? err.message : "Unable to mark case as enrollment paid.";

    return new Response(
      JSON.stringify({
        error: message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
