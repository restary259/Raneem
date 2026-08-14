-- Set the agent per-recruit commission to ₪500.
--
-- `platform_settings.agent_commission_rate` is the flat admin-set amount an
-- Agent earns (carved out of the partner pool FIRST via
-- get_effective_agent_split → record_case_commission) when a student brought
-- by a partner/ambassador they recruited reaches enrollment_paid. It was
-- previously seeded at ₪200; product decision 2026-08-14: raise it to ₪500.
--
-- get_effective_agent_split clamps the amount to the partner pool
-- (GREATEST(0, LEAST(amount, pool))), so with the default partner pool of
-- ₪500 the agent now earns the full ₪500 and the referring partner receives
-- the remainder (pool − agent = ₪0 unless a master-partner share applies,
-- which is then capped at pool − agent). Per-agent overrides in
-- agent_commission_overrides still win over this global default.
--
-- Idempotent: sets the column default AND updates the single platform_settings
-- row so existing installs reflect the new rate immediately. The validate
-- trigger still rejects values exceeding partner_commission_rate.

ALTER TABLE public.platform_settings
  ALTER COLUMN agent_commission_rate SET DEFAULT 500;

UPDATE public.platform_settings
  SET agent_commission_rate = 500
  WHERE agent_commission_rate IS DISTINCT FROM 500
    AND COALESCE(agent_commission_rate, 0) <= COALESCE(partner_commission_rate, 0);
