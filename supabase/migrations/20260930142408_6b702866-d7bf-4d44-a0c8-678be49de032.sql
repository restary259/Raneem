CREATE TABLE public.city_guide_place_cache (
  location_id text PRIMARY KEY,
  place_id text,
  photo_name text,
  photo_attribution text,
  rating numeric,
  rating_count integer,
  open_now boolean,
  lat double precision,
  lng double precision,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.city_guide_place_cache TO authenticated;
GRANT ALL ON public.city_guide_place_cache TO service_role;
ALTER TABLE public.city_guide_place_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read city guide cache" ON public.city_guide_place_cache FOR SELECT TO authenticated USING (true);