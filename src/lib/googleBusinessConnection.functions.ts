import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabase } from "@/integrations/supabase/client";
import { GbpError, GBP_LOCATION_READ_MASK, gbpGet } from "@/lib/googleBusinessGateway";

const attachBearer = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
});

export interface GbpLocationSummary {
  name: string;
  title: string | null;
  address: string | null;
}
export interface GbpAccountSummary {
  name: string;
  accountName: string | null;
  type: string | null;
  verificationState: string | null;
  locations: GbpLocationSummary[];
  locationsError: string | null;
}
export interface GbpOverview {
  status: "connected" | "not_linked" | "error";
  checkedAt: string;
  accounts: GbpAccountSummary[];
  errorCode: string | null;
  errorMessage: string | null;
}

const MAX_PAGES = 5;

async function audit(actorId: string, action: string, after: Record<string, unknown>) {
  // Best effort: the audit table ships with the Phase 1 migration (manual deploy).
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("google_business_activity" as never).insert({
      actor_user_id: actorId,
      actor_role: "admin",
      action,
      resource_type: "connection",
      after_data: after,
    } as never);
    if (error) console.warn("google_business_activity insert skipped:", error.message);
  } catch (e) {
    console.warn("google_business_activity insert failed:", (e as Error).message);
  }
}

/** Admin-only: live connection health + read-only account/location discovery. */
export const getGoogleBusinessOverview = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .handler(async ({ context }): Promise<GbpOverview> => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError || isAdmin !== true) {
      throw new Response("Forbidden", { status: 403 });
    }

    const checkedAt = new Date().toISOString();
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const connectionKey = process.env["GOOGLE_BUSINESS_PROFILE_API_KEY"];
    if (!lovableKey || !connectionKey) {
      await audit(context.userId, "GOOGLE_HEALTH_CHECK", { status: "not_linked" });
      return { status: "not_linked", checkedAt, accounts: [], errorCode: "not_linked", errorMessage: null };
    }
    const creds = { lovableKey, connectionKey };

    try {
      const accounts: GbpAccountSummary[] = [];
      let pageToken: string | undefined;
      for (let page = 0; page < MAX_PAGES; page++) {
        const q = new URLSearchParams({ pageSize: "20" });
        if (pageToken) q.set("pageToken", pageToken);
        const res = await gbpGet<{ accounts?: any[]; nextPageToken?: string }>(
          `/account_management/v1/accounts?${q}`,
          creds,
        );
        for (const a of res.accounts ?? []) {
          accounts.push({
            name: String(a.name),
            accountName: a.accountName ?? null,
            type: a.type ?? null,
            verificationState: a.verificationState ?? null,
            locations: [],
            locationsError: null,
          });
        }
        pageToken = res.nextPageToken;
        if (!pageToken) break;
      }

      for (const account of accounts) {
        try {
          let token: string | undefined;
          for (let page = 0; page < MAX_PAGES; page++) {
            const q = new URLSearchParams({ pageSize: "100", readMask: GBP_LOCATION_READ_MASK });
            if (token) q.set("pageToken", token);
            const res = await gbpGet<{ locations?: any[]; nextPageToken?: string }>(
              `/business_information/v1/${account.name}/locations?${q}`,
              creds,
            );
            for (const l of res.locations ?? []) {
              const addr = l.storefrontAddress;
              account.locations.push({
                name: String(l.name),
                title: l.title ?? null,
                address: addr
                  ? [...(addr.addressLines ?? []), addr.locality, addr.regionCode].filter(Boolean).join(", ")
                  : null,
              });
            }
            token = res.nextPageToken;
            if (!token) break;
          }
        } catch (e) {
          account.locationsError = e instanceof GbpError ? `${e.status}: ${e.message}` : (e as Error).message;
        }
      }

      await audit(context.userId, "GOOGLE_DISCOVERY", {
        status: "connected",
        accounts: accounts.length,
        locations: accounts.reduce((n, a) => n + a.locations.length, 0),
      });
      return { status: "connected", checkedAt, accounts, errorCode: null, errorMessage: null };
    } catch (e) {
      // Non-GbpError = our own failure, not Google's; keep the attribution honest.
      const err = e instanceof GbpError ? e : new GbpError("internal", 0, (e as Error).message);
      console.error(`Google Business request failed [${err.status}]: ${err.message}`);
      await audit(context.userId, "GOOGLE_HEALTH_FAILED", { code: err.code, status: err.status });
      return { status: "error", checkedAt, accounts: [], errorCode: err.code, errorMessage: err.message };
    }
  });
