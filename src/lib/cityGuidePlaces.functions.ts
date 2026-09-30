import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabase } from "@/integrations/supabase/client";
import { HEIDELBERG_CITY_GUIDE } from "@/data/studentCityGuides";
import { isCacheFresh } from "@/lib/cityGuideCache";

/** Attaches the signed-in user's bearer token to this server function call. */
const attachBearer = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
});

export interface CityGuidePlace {
  location_id: string;
  photo_uri: string | null;
  photo_attribution: string | null;
  rating: number | null;
  rating_count: number | null;
  open_now: boolean | null;
  lat: number | null;
  lng: number | null;
}

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

export const getCityGuidePlaces = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ cityId: z.literal("heidelberg") }).parse(input))
  .handler(async ({ context }): Promise<CityGuidePlace[]> => {
    const { data: cached, error } = await context.supabase
      .from("city_guide_place_cache" as never)
      .select("*");
    if (error) throw error;
    const rows = new Map<string, any>(((cached ?? []) as any[]).map((r) => [r.location_id, r]));

    const locations = HEIDELBERG_CITY_GUIDE.locations;
    const stale = locations.filter((l) => !isCacheFresh(rows.get(l.id)?.fetched_at));

    const LOVABLE_API_KEY = process.env["LOVABLE_API_KEY"];
    const GOOGLE_MAPS_API_KEY = process.env["GOOGLE_MAPS_API_KEY"];

    if (stale.length > 0 && LOVABLE_API_KEY && GOOGLE_MAPS_API_KEY) {
      const headers = {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
        "Content-Type": "application/json",
      };
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      // Bounded: at most 16 curated places, 4 at a time.
      for (let i = 0; i < stale.length; i += 4) {
        await Promise.all(
          stale.slice(i, i + 4).map(async (loc) => {
            try {
              const res = await fetch(`${GATEWAY_URL}/places/v1/places:searchText`, {
                method: "POST",
                headers: {
                  ...headers,
                  "X-Goog-FieldMask":
                    "places.id,places.location,places.rating,places.userRatingCount,places.currentOpeningHours.openNow,places.photos",
                },
                body: JSON.stringify({
                  textQuery: loc.mapQuery,
                  pageSize: 1,
                  locationBias: {
                    circle: { center: { latitude: 49.4093, longitude: 8.6937 }, radius: 15000 },
                  },
                }),
              });
              if (!res.ok) {
                console.error(`Places search failed [${res.status}]: ${await res.text()}`);
                return;
              }
              const place = (await res.json())?.places?.[0];
              if (!place) return;
              const photo = place.photos?.[0];
              let photoUri: string | null = null;
              if (photo?.name) {
                const pr = await fetch(
                  `${GATEWAY_URL}/places/v1/${photo.name}/media?maxWidthPx=800&skipHttpRedirect=true`,
                  { headers },
                );
                if (pr.ok) photoUri = (await pr.json())?.photoUri ?? null;
              }
              const row = {
                location_id: loc.id,
                place_id: place.id ?? null,
                photo_name: photo?.name ?? null,
                photo_uri: photoUri,
                photo_attribution: photo?.authorAttributions?.[0]?.displayName ?? null,
                rating: place.rating ?? null,
                rating_count: place.userRatingCount ?? null,
                open_now: place.currentOpeningHours?.openNow ?? null,
                lat: place.location?.latitude ?? null,
                lng: place.location?.longitude ?? null,
                fetched_at: new Date().toISOString(),
              };
              await supabaseAdmin.from("city_guide_place_cache" as never).upsert(row as never);
              rows.set(loc.id, row);
            } catch (e) {
              console.error("City guide place refresh failed", loc.id, e);
            }
          }),
        );
      }
    }

    return locations
      .map((l) => rows.get(l.id))
      .filter(Boolean)
      .map((r: any) => ({
        location_id: r.location_id,
        photo_uri: r.photo_uri ?? null,
        photo_attribution: r.photo_attribution ?? null,
        rating: r.rating != null ? Number(r.rating) : null,
        rating_count: r.rating_count ?? null,
        open_now: r.open_now ?? null,
        lat: r.lat ?? null,
        lng: r.lng ?? null,
      }));
  });
