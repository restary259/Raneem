import { createFileRoute } from "@tanstack/react-router";

/**
 * Phase 9 — background sync worker drain.
 *
 * pg_cron only ENQUEUES work (see `enqueue_google_reconciliation_jobs`); the
 * actual Google calls happen here, so the schedule never encodes Google auth
 * rules and a slow Google API cannot stall the database.
 *
 * Guarded by the same `cron_dispatch_secret` the other queue dispatchers use, so
 * an anonymous caller cannot drain or trigger Google traffic.
 */

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1)
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

export const Route = createFileRoute("/api/cron/google-business-worker")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const presented = request.headers.get("x-cron-secret") ?? "";
        if (!presented) return json({ error: "missing_cron_secret" }, 401);

        const { supabaseAdmin } =
          await import("@/integrations/supabase/client.server");
        const { data: expected, error } = await supabaseAdmin.rpc(
          "get_cron_dispatch_secret" as never,
        );
        if (error || typeof expected !== "string" || !expected) {
          console.error("google_worker_secret_unavailable", {
            message: error?.message,
          });
          return json({ error: "worker_not_configured" }, 503);
        }
        if (!timingSafeEqual(presented, expected)) {
          return json({ error: "forbidden" }, 403);
        }

        try {
          const { processGoogleBusinessSyncJobs } =
            await import("@/lib/googleBusinessRealtime.functions");
          const results = await processGoogleBusinessSyncJobs({ max: 25 });
          return json(
            {
              ok: true,
              processed: results.length,
              succeeded: results.filter((r) => r.status === "SUCCESS").length,
              partial: results.filter((r) => r.status === "PARTIAL").length,
              failed: results.filter((r) => r.status === "FAILED").length,
              jobs: results,
            },
            200,
          );
        } catch (e) {
          // A transient failure keeps the jobs queued; the next tick retries.
          const message = e instanceof Error ? e.message : "worker failed";
          console.error("google_worker_failed", { message });
          return json({ error: "worker_failed" }, 500);
        }
      },
    },
  },
});
