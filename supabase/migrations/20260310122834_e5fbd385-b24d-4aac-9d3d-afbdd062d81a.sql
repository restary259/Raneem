-- Backdate the partner reward so it passes the 20-day lock for payout testing
UPDATE public.rewards
SET created_at = now() - INTERVAL '21 days'
WHERE id = '96bb9c4f-ac92-4492-97bd-debe170c20cb'
  AND admin_notes LIKE 'Partner commission from case%';