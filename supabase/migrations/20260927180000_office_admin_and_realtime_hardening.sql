-- DARB Office admin + notification realtime hardening
-- Full admin configuration RPC for offices. Keeps the legacy
-- save_office_configuration(...) contract untouched for older clients.

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.admin_save_office_configuration(
  p_office_id uuid,
  p_office jsonb,
  p_settings jsonb,
  p_hours jsonb,
  p_members jsonb DEFAULT '[]'::jsonb,
  p_routing_rules jsonb DEFAULT '[]'::jsonb,
  p_breaks jsonb DEFAULT '[]'::jsonb,
  p_blackouts jsonb DEFAULT '[]'::jsonb
)
RETURNS public.offices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_office public.offices%ROWTYPE;
  v_item jsonb;
  v_user uuid;
  v_service text;
  v_starts timestamptz;
  v_ends timestamptz;
  v_primary_count integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF NULLIF(trim(COALESCE(p_office->>'name_ar','')), '') IS NULL
     OR NULLIF(trim(COALESCE(p_office->>'name_en','')), '') IS NULL
     OR NULLIF(trim(COALESCE(p_office->>'city','')), '') IS NULL THEN
    RAISE EXCEPTION 'Office name and city are required';
  END IF;

  IF p_office_id IS NULL THEN
    INSERT INTO public.offices (
      name_ar,name_en,name_he,slug,office_code,office_type,country,city,
      address_line_1,address_line_2,postal_code,phone,email,map_url,timezone,
      public_description_ar,public_description_en,public_description_he,
      booking_enabled,is_active,display_order
    )
    VALUES (
      trim(p_office->>'name_ar'),
      trim(p_office->>'name_en'),
      COALESCE(trim(p_office->>'name_he'),''),
      trim(p_office->>'slug'),
      NULLIF(trim(p_office->>'office_code'),''),
      COALESCE(p_office->>'office_type','darb'),
      COALESCE(NULLIF(trim(p_office->>'country'),''),'IL'),
      trim(p_office->>'city'),
      NULLIF(trim(p_office->>'address_line_1'),''),
      NULLIF(trim(p_office->>'address_line_2'),''),
      NULLIF(trim(p_office->>'postal_code'),''),
      NULLIF(trim(p_office->>'phone'),''),
      NULLIF(trim(p_office->>'email'),''),
      NULLIF(trim(p_office->>'map_url'),''),
      COALESCE(NULLIF(trim(p_office->>'timezone'),''),'Asia/Jerusalem'),
      NULLIF(trim(p_office->>'public_description_ar'),''),
      NULLIF(trim(p_office->>'public_description_en'),''),
      NULLIF(trim(p_office->>'public_description_he'),''),
      false,
      COALESCE((p_office->>'is_active')::boolean,true),
      COALESCE((p_office->>'display_order')::integer,0)
    )
    RETURNING * INTO v_office;
  ELSE
    UPDATE public.offices
    SET name_ar=trim(p_office->>'name_ar'),
        name_en=trim(p_office->>'name_en'),
        name_he=COALESCE(trim(p_office->>'name_he'),''),
        slug=trim(p_office->>'slug'),
        office_code=NULLIF(trim(p_office->>'office_code'),''),
        office_type=COALESCE(p_office->>'office_type','darb'),
        country=COALESCE(NULLIF(trim(p_office->>'country'),''),'IL'),
        city=trim(p_office->>'city'),
        address_line_1=NULLIF(trim(p_office->>'address_line_1'),''),
        address_line_2=NULLIF(trim(p_office->>'address_line_2'),''),
        postal_code=NULLIF(trim(p_office->>'postal_code'),''),
        phone=NULLIF(trim(p_office->>'phone'),''),
        email=NULLIF(trim(p_office->>'email'),''),
        map_url=NULLIF(trim(p_office->>'map_url'),''),
        timezone=COALESCE(NULLIF(trim(p_office->>'timezone'),''),'Asia/Jerusalem'),
        public_description_ar=NULLIF(trim(p_office->>'public_description_ar'),''),
        public_description_en=NULLIF(trim(p_office->>'public_description_en'),''),
        public_description_he=NULLIF(trim(p_office->>'public_description_he'),''),
        is_active=COALESCE((p_office->>'is_active')::boolean,true),
        display_order=COALESCE((p_office->>'display_order')::integer,0),
        booking_enabled=false,
        updated_at=now()
    WHERE id=p_office_id AND deleted_at IS NULL
    RETURNING * INTO v_office;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Office not found';
    END IF;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_members,'[]'::jsonb))
  LOOP
    IF COALESCE((v_item->>'is_active')::boolean,true)
       AND COALESCE((v_item->>'is_primary')::boolean,false) THEN
      v_primary_count := v_primary_count + 1;
    END IF;
  END LOOP;

  IF v_primary_count > 1 THEN
    RAISE EXCEPTION 'Only one active primary team member is allowed';
  END IF;

  UPDATE public.office_members
  SET is_active=false, is_primary=false, updated_at=now()
  WHERE office_id=v_office.id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_members,'[]'::jsonb))
  LOOP
    v_user := NULLIF(v_item->>'user_id','')::uuid;
    IF v_user IS NULL OR NOT COALESCE((v_item->>'is_active')::boolean,true) THEN
      CONTINUE;
    END IF;

    IF NOT public.is_active_team_member(v_user) THEN
      RAISE EXCEPTION 'Only active team members can be assigned to an office';
    END IF;

    INSERT INTO public.office_members (
      office_id,user_id,membership_type,is_primary,is_active,priority
    )
    VALUES (
      v_office.id,
      v_user,
      CASE WHEN (v_item->>'membership_type') IN ('owner','operator','backup','staff')
           THEN v_item->>'membership_type' ELSE 'staff' END,
      COALESCE((v_item->>'is_primary')::boolean,false),
      true,
      GREATEST(1,COALESCE((v_item->>'priority')::integer,100))
    )
    ON CONFLICT (office_id,user_id) DO UPDATE
    SET membership_type=EXCLUDED.membership_type,
        is_primary=EXCLUDED.is_primary,
        is_active=true,
        priority=EXCLUDED.priority,
        updated_at=now();
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM public.office_members
    WHERE office_id=v_office.id AND is_active=true AND is_primary=true
  ) AND EXISTS (
    SELECT 1 FROM public.office_members
    WHERE office_id=v_office.id AND is_active=true
  ) THEN
    UPDATE public.office_members
    SET is_primary=true
    WHERE id=(
      SELECT id FROM public.office_members
      WHERE office_id=v_office.id AND is_active=true
      ORDER BY priority, created_at
      LIMIT 1
    );
  END IF;

  INSERT INTO public.office_booking_settings (
    office_id,slot_interval_minutes,default_duration_minutes,minimum_lead_minutes,maximum_days_ahead
  )
  VALUES (
    v_office.id,
    GREATEST(5,LEAST(120,COALESCE((p_settings->>'slot_interval_minutes')::integer,30))),
    GREATEST(15,LEAST(240,COALESCE((p_settings->>'default_duration_minutes')::integer,60))),
    GREATEST(0,COALESCE((p_settings->>'minimum_lead_minutes')::integer,120)),
    GREATEST(1,LEAST(90,COALESCE((p_settings->>'maximum_days_ahead')::integer,14)))
  )
  ON CONFLICT (office_id) DO UPDATE SET
    slot_interval_minutes=EXCLUDED.slot_interval_minutes,
    default_duration_minutes=EXCLUDED.default_duration_minutes,
    minimum_lead_minutes=EXCLUDED.minimum_lead_minutes,
    maximum_days_ahead=EXCLUDED.maximum_days_ahead,
    updated_at=now();

  DELETE FROM public.office_hours WHERE office_id=v_office.id;
  INSERT INTO public.office_hours (office_id,weekday,is_open,open_time,close_time)
  SELECT v_office.id,
         (x->>'weekday')::integer,
         COALESCE((x->>'is_open')::boolean,false),
         CASE WHEN COALESCE((x->>'is_open')::boolean,false) THEN NULLIF(x->>'open_time','')::time ELSE NULL END,
         CASE WHEN COALESCE((x->>'is_open')::boolean,false) THEN NULLIF(x->>'close_time','')::time ELSE NULL END
  FROM jsonb_array_elements(COALESCE(p_hours,'[]'::jsonb)) x
  WHERE (x->>'weekday')::integer BETWEEN 0 AND 6;

  DELETE FROM public.office_routing_rules WHERE office_id=v_office.id;
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_routing_rules,'[]'::jsonb))
  LOOP
    v_user := NULLIF(v_item->>'assigned_user_id','')::uuid;
    v_service := NULLIF(trim(v_item->>'service_type'),'');
    IF v_user IS NULL OR v_service IS NULL THEN CONTINUE; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.office_members
      WHERE office_id=v_office.id AND user_id=v_user AND is_active=true
    ) THEN
      RAISE EXCEPTION 'Routing target must be an active team member of the office';
    END IF;
    INSERT INTO public.office_routing_rules (
      office_id,service_type,assigned_user_id,priority,is_active
    ) VALUES (
      v_office.id,v_service,v_user,
      GREATEST(1,COALESCE((v_item->>'priority')::integer,100)),
      COALESCE((v_item->>'is_active')::boolean,true)
    );
  END LOOP;

  DELETE FROM public.office_breaks WHERE office_id=v_office.id;
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_breaks,'[]'::jsonb))
  LOOP
    IF (v_item->>'weekday')::integer BETWEEN 0 AND 6 THEN
      INSERT INTO public.office_breaks (
        office_id,weekday,start_time,end_time,label,is_active
      ) VALUES (
        v_office.id,
        (v_item->>'weekday')::integer,
        (v_item->>'start_time')::time,
        (v_item->>'end_time')::time,
        NULLIF(trim(v_item->>'label'),''),
        COALESCE((v_item->>'is_active')::boolean,true)
      );
    END IF;
  END LOOP;

  DELETE FROM public.office_blackouts WHERE office_id=v_office.id;
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_blackouts,'[]'::jsonb))
  LOOP
    v_starts := NULLIF(v_item->>'starts_at','')::timestamptz;
    v_ends := NULLIF(v_item->>'ends_at','')::timestamptz;
    IF v_starts IS NULL OR v_ends IS NULL OR v_ends <= v_starts THEN
      RAISE EXCEPTION 'Invalid office blackout range';
    END IF;
    INSERT INTO public.office_blackouts (
      office_id,starts_at,ends_at,reason,is_active
    ) VALUES (
      v_office.id,
      v_starts,
      v_ends,
      NULLIF(trim(v_item->>'reason'),''),
      COALESCE((v_item->>'is_active')::boolean,true)
    );
  END LOOP;

  UPDATE public.offices
  SET booking_enabled=COALESCE((p_office->>'booking_enabled')::boolean,false),
      updated_at=now()
  WHERE id=v_office.id
  RETURNING * INTO v_office;

  RETURN v_office;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_save_office_configuration(uuid,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_office_configuration(uuid,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)
  TO authenticated;
