import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabase } from "@/integrations/supabase/client";
import {
  collectAllPages,
  GbpError,
  GBP_LOCATION_READ_MASK,
  gbpGet,
  normalizeGbpLocation,
  type GbpRawLocation,
  type NormalizedGbpLocation,
} from "@/lib/googleBusinessGateway";

/**
 * Phase 3 server functions: discover Google Business locations for the DARB
 * connection, cache them, and map one to an office.
 *
 * Everything here is admin-gated server-side (never the browser). The gateway
 * holds the Google tokens — DARB never sees or stores them. Every write goes
 * through a Phase 3 RPC so the office isolation / uniqueness rules hold even if
 * a caller forges the payload.
 */

const attachBearer = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
  },
);

function adminCreds(): { lovableKey: string; connectionKey: string } | null {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["GOOGLE_BUSINESS_PROFILE_API_KEY"];
  if (!lovableKey || !connectionKey) return null;
  return { lovableKey, connectionKey };
}

type SupabaseCtx = {
  supabase: {
    rpc: (
      fn: string,
      args?: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message?: string } | null }>;
  };
  userId: string;
};

async function assertAdmin(context: SupabaseCtx) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || data !== true) {
    throw new Response("Forbidden", { status: 403 });
  }
}

async function rpcOrThrow<T>(
  context: SupabaseCtx,
  fn: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await context.supabase.rpc(fn, args);
  if (error) throw new Error(error.message || "Request failed");
  return data as T;
}

export interface DiscoveredLocation {
  resourceName: string;
  locationId: string;
  accountId: string;
  title: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  category: string | null;
  placeId: string | null;
  mapsUrl: string | null;
  verificationState: string | null;
  locationState: string | null;
  mappedOfficeId: string | null;
  mappedOfficeName: string | null;
}

export interface DiscoverResult {
  status: "connected" | "not_linked" | "error";
  syncedAt: string;
  accounts: { name: string; accountName: string | null }[];
  locations: DiscoveredLocation[];
  errorCode: string | null;
  errorMessage: string | null;
}

/**
 * Read-only discovery: list every location Google exposes to the DARB
 * connection, normalize it, cache it, then return it joined with its DARB
 * mapping state. Nothing is mapped here.
 */
export const discoverGoogleBusinessLocations = createServerFn({
  method: "POST",
})
  .middleware([attachBearer, requireSupabaseAuth])
  .handler(async ({ context }): Promise<DiscoverResult> => {
    await assertAdmin(context as unknown as SupabaseCtx);
    const syncedAt = new Date().toISOString();
    const creds = adminCreds();
    if (!creds) {
      return {
        status: "not_linked",
        syncedAt,
        accounts: [],
        locations: [],
        errorCode: "not_linked",
        errorMessage: null,
      };
    }

    try {
      // 1. Accounts visible to the connection.
      const { items: accounts } = await collectAllPages<{
        name?: string;
        accountName?: string;
      }>(async (pageToken) => {
        const q = new URLSearchParams({ pageSize: "20" });
        if (pageToken) q.set("pageToken", pageToken);
        const res = await gbpGet<{
          accounts?: { name?: string; accountName?: string }[];
          nextPageToken?: string;
        }>(`/account_management/v1/accounts?${q}`, creds);
        return { items: res.accounts ?? [], nextPageToken: res.nextPageToken };
      });
      const accountSummaries = accounts
        .filter((a): a is { name: string; accountName?: string } =>
          Boolean(a.name),
        )
        .map((a) => ({ name: a.name, accountName: a.accountName ?? null }));

      // 2. Locations per account. A location is filed under the account we
      //    verified it came from — never a client-supplied account id.
      const normalized: NormalizedGbpLocation[] = [];
      for (const account of accountSummaries) {
        const { items: raw } = await collectAllPages<GbpRawLocation>(
          async (pageToken) => {
            const q = new URLSearchParams({
              pageSize: "100",
              readMask: GBP_LOCATION_READ_MASK,
            });
            if (pageToken) q.set("pageToken", pageToken);
            const res = await gbpGet<{
              locations?: GbpRawLocation[];
              nextPageToken?: string;
            }>(`/business_information/v1/${account.name}/locations?${q}`, creds);
            return {
              items: res.locations ?? [],
              nextPageToken: res.nextPageToken,
            };
          },
        );
        for (const loc of raw) {
          const row = normalizeGbpLocation(account.name, loc);
          if (row) normalized.push(row);
        }
      }

      // 3. Cache the snapshot (admin-only RPC), then read it back joined with
      //    mapping state so the UI sees "mapped -> office" in one call.
      if (normalized.length) {
        await rpcOrThrow<number>(
          context as unknown as SupabaseCtx,
          "admin_sync_google_locations",
          {
            p_connection_id: null,
            p_locations: normalized,
          },
        );
      }
      const cached = await rpcOrThrow<CachedLocationRow[]>(
        context as unknown as SupabaseCtx,
        "admin_list_google_locations",
        {},
      );

      return {
        status: "connected",
        syncedAt,
        accounts: accountSummaries,
        locations: cached.map(toDiscovered),
        errorCode: null,
        errorMessage: null,
      };
    } catch (e) {
      const err =
        e instanceof GbpError
          ? e
          : new GbpError("upstream", 0, (e as Error).message);
      console.error(
        `Google location discovery failed [${err.status}]: ${err.message}`,
      );
      return {
        status: "error",
        syncedAt,
        accounts: [],
        locations: [],
        errorCode: err.code,
        errorMessage: err.message,
      };
    }
  });

type CachedLocationRow = {
  google_location_id: string;
  google_location_resource_name: string;
  google_account_id: string;
  location_name: string | null;
  primary_category: string | null;
  address_json: Record<string, string | null> | null;
  phone: string | null;
  website_url: string | null;
  place_id: string | null;
  maps_url: string | null;
  verification_state: string | null;
  location_state: string | null;
  mapped_office_id: string | null;
  mapped_office_name: string | null;
};

function toDiscovered(row: CachedLocationRow): DiscoveredLocation {
  const addr = row.address_json ?? {};
  const parts = [
    addr.address_line_1,
    addr.postal_code,
    addr.city,
    addr.country,
  ].filter(Boolean);
  return {
    resourceName: row.google_location_resource_name,
    locationId: row.google_location_id,
    accountId: row.google_account_id,
    title: row.location_name,
    address: parts.length ? parts.join(", ") : null,
    phone: row.phone,
    website: row.website_url,
    category: row.primary_category,
    placeId: row.place_id,
    mapsUrl: row.maps_url,
    verificationState: row.verification_state,
    locationState: row.location_state,
    mappedOfficeId: row.mapped_office_id,
    mappedOfficeName: row.mapped_office_name,
  };
}

export interface MapLocationResult {
  ok: boolean;
  error: string | null;
}

const mapInput = z.object({
  officeId: z.string().uuid(),
  googleAccountId: z.string().trim().min(1).max(200),
  googleLocationResourceName: z.string().trim().min(1).max(400),
});

const unmapInput = z.object({ officeId: z.string().uuid() });

/**
 * Map an office to a Google location. The RPC is the authority: it re-validates
 * the office, the connection, that the location exists in the cache, that it
 * belongs to the named account, and that no other office holds it — all inside
 * one transaction. On rejection we record the audit event in a second
 * transaction (the failed one rolled back).
 */
export const mapOfficeGoogleLocation = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .inputValidator((input) => mapInput.parse(input))
  .handler(async ({ context, data }): Promise<MapLocationResult> => {
    const ctx = context as unknown as SupabaseCtx;
    await assertAdmin(ctx);

    const { error } = await ctx.supabase.rpc(
      "admin_map_office_google_location",
      {
        p_office_id: data.officeId,
        p_google_account_id: data.googleAccountId,
        p_google_location_resource_name: data.googleLocationResourceName,
      },
    );

    if (!error) return { ok: true, error: null };

    const message = error.message || "Request failed";
    const action = /already connected to another DARB office/i.test(message)
      ? "GOOGLE_LOCATION_ALREADY_MAPPED"
      : /not found/i.test(message)
        ? "GOOGLE_LOCATION_NOT_FOUND"
        : /does not belong/i.test(message)
          ? "GOOGLE_LOCATION_VALIDATION_FAILED"
          : null;
    if (action) {
      // Best effort: the mapping was correctly rejected either way.
      try {
        await ctx.supabase.rpc("admin_record_google_mapping_attempt", {
          p_office_id: data.officeId,
          p_action: action,
          p_google_location_resource_name: data.googleLocationResourceName,
          p_detail: { message },
        });
      } catch {
        /* audit is best effort */
      }
    }
    return { ok: false, error: message };
  });

/** Disconnect the office -> Google mapping. Never touches the Google profile. */
export const unmapOfficeGoogleLocation = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .inputValidator((input) => unmapInput.parse(input))
  .handler(async ({ context, data }): Promise<MapLocationResult> => {
    const ctx = context as unknown as SupabaseCtx;
    await assertAdmin(ctx);
    const { error } = await ctx.supabase.rpc(
      "admin_unmap_office_google_location",
      {
        p_office_id: data.officeId,
      },
    );
    return { ok: !error, error: error?.message ?? null };
  });
