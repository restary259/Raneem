-- Unify the public map destination with the connected Google location.
--
-- `offices.map_url` and `office_google_profiles.google_maps_url` describe the
-- same place. Rather than teach every public component about Google internals,
-- the mapped Google Maps URL is mirrored onto `offices.map_url`, so the public
-- office card automatically points at the correct Google location. Offices
-- without a Google mapping keep their manually entered `map_url`.

CREATE OR REPLACE FUNCTION public.sync_office_map_url_from_google()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW.mapping_status = 'MAPPED'
     AND NEW.google_maps_url IS NOT NULL
     AND btrim(NEW.google_maps_url) <> '' THEN
    UPDATE public.offices
    SET map_url = NEW.google_maps_url
    WHERE id = NEW.office_id
      AND map_url IS DISTINCT FROM NEW.google_maps_url;
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.sync_office_map_url_from_google() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_office_map_url_from_google ON public.office_google_profiles;
CREATE TRIGGER trg_sync_office_map_url_from_google
AFTER INSERT OR UPDATE OF google_maps_url, mapping_status
ON public.office_google_profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_office_map_url_from_google();
