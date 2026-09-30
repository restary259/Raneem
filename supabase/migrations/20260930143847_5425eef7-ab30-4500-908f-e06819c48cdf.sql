DROP POLICY IF EXISTS "Signed-in users read city guide cache" ON public.city_guide_place_cache;
REVOKE ALL ON public.city_guide_place_cache FROM authenticated, anon;