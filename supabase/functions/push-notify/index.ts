import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { serverErrorResponse } from "../_shared/errors.ts";
import { sendWebPush } from "../_shared/webpush.ts";


serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authenticatedUserId = claimsData.claims.sub;
    const { action, subscription, user_id, title, body, url, platform, browser } = await req.json();

    // Subscribe — only allow for own user_id
    if (action === "subscribe") {
      if (user_id !== authenticatedUserId) {
        return new Response(JSON.stringify({ error: "Cannot subscribe for another user" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // The endpoint is globally unique: re-subscribing on a device that was
      // previously revoked (or handed to another account) revives that row.
      const { error } = await supabaseAdmin.from("push_subscriptions").upsert({
        user_id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth_key: subscription.keys.auth,
        user_agent: req.headers.get("user-agent")?.slice(0, 400) ?? null,
        platform: typeof platform === "string" ? platform.slice(0, 60) : null,
        browser: typeof browser === "string" ? browser.slice(0, 60) : null,
        active: true,
        revoked_at: null,
        last_error_at: null,
        last_error_status: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "endpoint" });

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Unsubscribe — only allow for own user_id
    if (action === "unsubscribe") {
      if (user_id !== authenticatedUserId) {
        return new Response(JSON.stringify({ error: "Cannot unsubscribe another user" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabaseAdmin
        .from("push_subscriptions")
        .delete()
        .eq("user_id", user_id)
        .eq("endpoint", subscription.endpoint);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send a real push. Anyone may send a test to themselves; only admins may
    // target another user.
    if (action === "send" || action === "test") {
      const targetUserId = user_id || authenticatedUserId;

      if (targetUserId !== authenticatedUserId) {
        const { data: roles } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", authenticatedUserId)
          .eq("role", "admin");

        if (!roles?.length) {
          return new Response(JSON.stringify({ error: "Admin access required" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
      const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
      if (!vapidPublicKey || !vapidPrivateKey) {
        return new Response(JSON.stringify({ error: "push_not_configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: subs } = await supabaseAdmin
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth_key")
        .eq("user_id", targetUserId)
        .eq("active", true);

      if (!subs?.length) {
        return new Response(JSON.stringify({ success: false, reason: "no_subscription", sent: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const payload = {
        title: title || "درب",
        body: body || "إشعار تجريبي من منصة درب",
        url: url || "/",
        tag: "test",
        category: "system",
        priority: "high",
      };

      const results = await Promise.all(
        subs.map(async (sub) => {
          const result = await sendWebPush(
            { endpoint: sub.endpoint, p256dh: sub.p256dh, auth_key: sub.auth_key },
            payload,
            {
              publicKey: vapidPublicKey,
              privateKey: vapidPrivateKey,
              subject: Deno.env.get("VAPID_SUBJECT") ?? "mailto:info@darb.agency",
            },
            { ttl: 600, urgency: "high" },
          );
          if (result.gone) {
            await supabaseAdmin
              .from("push_subscriptions")
              .update({ active: false, revoked_at: new Date().toISOString(), last_error_status: result.status })
              .eq("id", sub.id);
          } else if (result.ok) {
            await supabaseAdmin
              .from("push_subscriptions")
              .update({ last_success_at: new Date().toISOString() })
              .eq("id", sub.id);
          }
          return result;
        }),
      );

      const sent = results.filter((r) => r.ok).length;
      return new Response(
        JSON.stringify({
          success: sent > 0,
          sent,
          failed: results.length - sent,
          errors: results.filter((r) => !r.ok).map((r) => ({ status: r.status, error: r.error })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return serverErrorResponse(e, corsHeaders, "Failed to send push notification");
  }
});
