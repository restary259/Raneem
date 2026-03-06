// supabase/functions/selective-delete/index.ts
// ─────────────────────────────────────────────────────────────────────────
// Selective soft-delete (and admin-only hard-delete) for student records.
//
// POST /functions/v1/selective-delete
// Body: {
//   student_id: string,
//   categories: ("contact_info" | "documents" | "payments" | "case" | "all")[],
//   mode: "soft" | "hard",
//   password: string    // admin password for hard delete confirmation
// }
//
// "soft" mode: sets deleted_at timestamp on selected categories, hides from UI
// "hard" mode: permanently destroys data, admin-only, requires password
//
// Both modes write a snapshot to deletion_logs before acting.
// ─────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type DeleteCategory =
  | "contact_info"
  | "documents"
  | "payments"
  | "case"
  | "all";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Validate caller
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } =
      await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return json({ error: "Invalid token" }, 401);
    }

    const callerId = userData.user.id;
    const callerEmail = userData.user.email;

    // Must be admin
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin");

    if (!roles?.length) {
      return json({ error: "Admin access required" }, 403);
    }

    const body = await req.json();
    const {
      student_id,
      categories,
      mode,
      password,
    }: {
      student_id: string;
      categories: DeleteCategory[];
      mode: "soft" | "hard";
      password: string;
    } = body;

    if (!student_id || !categories?.length || !mode) {
      return json(
        { error: "student_id, categories[], and mode are required" },
        400
      );
    }

    if (!["soft", "hard"].includes(mode)) {
      return json({ error: 'mode must be "soft" or "hard"' }, 400);
    }

    // Hard delete always requires password re-verification
    if (mode === "hard") {
      if (!password) {
        return json({ error: "Password is required for hard delete" }, 400);
      }
      const supabaseAuth = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? ""
      );
      const { error: signInError } = await supabaseAuth.auth.signInWithPassword(
        { email: callerEmail!, password }
      );
      if (signInError) {
        return json({ error: "Incorrect password" }, 401);
      }
      await supabaseAuth.auth.signOut().catch(() => {});
    }

    const now = new Date().toISOString();
    const includeAll = categories.includes("all");
    const snapshot: Record<string, unknown> = {};

    // ── Collect snapshot data ────────────────────────────────────────
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", student_id)
      .single();
    snapshot.profile = profile;

    if (includeAll || categories.includes("documents")) {
      const { data: docs } = await supabaseAdmin
        .from("documents")
        .select("*")
        .eq("student_id", student_id);
      snapshot.documents = docs;
    }

    if (includeAll || categories.includes("case")) {
      const { data: caseData } = await supabaseAdmin
        .from("cases")
        .select("*, case_submissions(*)")
        .eq("student_user_id", student_id);
      snapshot.cases = caseData;
    }

    // ── Write deletion log BEFORE any destructive action ─────────────
    const { error: logError } = await supabaseAdmin
      .from("deletion_logs")
      .insert({
        deleted_by: callerId,
        target_type: "student",
        target_id: student_id,
        categories,
        mode,
        snapshot_json: snapshot,
      });

    if (logError) {
      console.error("Failed to write deletion log:", logError);
      return json({ error: "Failed to create audit log — aborting" }, 500);
    }

    const deleted: string[] = [];

    // ── Soft delete ──────────────────────────────────────────────────
    if (mode === "soft") {
      if (includeAll || categories.includes("contact_info")) {
        // Null out PII fields without removing the profile row
        await supabaseAdmin
          .from("profiles")
          .update({
            phone_number: null,
            emergency_contact: null,
            city: null,
            deleted_at: now,
          })
          .eq("id", student_id);
        deleted.push("contact_info");
      }

      if (includeAll || categories.includes("documents")) {
        await supabaseAdmin
          .from("documents")
          .update({ deleted_at: now })
          .eq("student_id", student_id);
        deleted.push("documents");
      }

      if (includeAll || categories.includes("case")) {
        // Soft-delete case_submissions linked to this student
        const { data: cases } = await supabaseAdmin
          .from("cases")
          .select("id")
          .eq("student_user_id", student_id);

        if (cases?.length) {
          const caseIds = cases.map((c: any) => c.id);
          await supabaseAdmin
            .from("case_submissions")
            .update({ deleted_at: now })
            .in("case_id", caseIds);
          await supabaseAdmin
            .from("cases")
            .update({ deleted_at: now })
            .in("id", caseIds);
        }
        deleted.push("case");
      }
    }

    // ── Hard delete ──────────────────────────────────────────────────
    if (mode === "hard") {
      // Delete in dependency order to avoid FK violations

      if (includeAll || categories.includes("documents")) {
        // Attempt to remove files from storage
        const { data: docs } = await supabaseAdmin
          .from("documents")
          .select("file_url")
          .eq("student_id", student_id);

        if (docs?.length) {
          const paths = docs
            .map((d: any) => {
              const parts = d.file_url?.split("/student-documents/");
              return parts?.[1] ?? null;
            })
            .filter(Boolean) as string[];

          if (paths.length > 0) {
            await supabaseAdmin.storage
              .from("student-documents")
              .remove(paths)
              .catch((e: any) => console.warn("Storage remove warning:", e));
          }
        }

        await supabaseAdmin
          .from("documents")
          .delete()
          .eq("student_id", student_id);
        deleted.push("documents");
      }

      if (includeAll || categories.includes("case")) {
        const { data: cases } = await supabaseAdmin
          .from("cases")
          .select("id")
          .eq("student_user_id", student_id);

        if (cases?.length) {
          const caseIds = cases.map((c: any) => c.id);
          await supabaseAdmin
            .from("case_submissions")
            .delete()
            .in("case_id", caseIds);
          await supabaseAdmin
            .from("cases")
            .delete()
            .in("id", caseIds);
        }
        deleted.push("case");
      }

      if (includeAll || categories.includes("contact_info")) {
        await supabaseAdmin
          .from("profiles")
          .delete()
          .eq("id", student_id);

        // Remove auth user — this is irreversible
        await supabaseAdmin.auth.admin.deleteUser(student_id);
        deleted.push("contact_info", "auth_user");
      }
    }

    // Audit log
    await supabaseAdmin.rpc("log_activity", {
      p_actor_id: callerId,
      p_actor_name: callerEmail ?? "Admin",
      p_action: mode === "hard" ? "student_hard_deleted" : "student_soft_deleted",
      p_entity_type: "student",
      p_entity_id: student_id,
      p_metadata: { categories, deleted },
    }).catch(() => {});

    return json(
      {
        success: true,
        mode,
        deleted,
        message: `${mode} delete completed for: ${deleted.join(", ")}`,
      },
      200
    );
  } catch (e) {
    console.error("selective-delete error:", e);
    return json({ error: "Server error" }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
